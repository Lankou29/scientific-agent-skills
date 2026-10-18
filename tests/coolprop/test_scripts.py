"""Tests for the coolprop skill's cycle helper (CoolProp 8.0.0, network-free)."""

import csv
import importlib.util
import io
import json
from contextlib import redirect_stdout
from pathlib import Path

import pytest
import skill_contract

SKILL_ROOT = Path(__file__).resolve().parents[2] / "skills" / "coolprop"
CliHelpTests = skill_contract.cli.help_test_case(SKILL_ROOT)

spec = importlib.util.spec_from_file_location("coolprop_thermo_cycles", SKILL_ROOT / "scripts" / "thermo_cycles.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


# ---------------------------------------------------------------------------
# Unit parsing: standard library only, runs everywhere
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text,expected",
    [("350C", 623.15), ("-10C", 263.15), ("623.15K", 623.15), ("300", 300.0), ("25°C", 298.15)],
)
def test_parse_temperature(text, expected):
    assert module.parse_temperature(text) == pytest.approx(expected)


@pytest.mark.parametrize(
    "text,expected",
    [("30bar", 30e5), ("3MPa", 3e6), ("10kPa", 1e4), ("1atm", 101325.0), ("500mbar", 5e4), ("2e5", 2e5)],
)
def test_parse_pressure(text, expected):
    assert module.parse_pressure(text) == pytest.approx(expected)


@pytest.mark.parametrize("text", ["-300C", "0K", "12F", "abc"])
def test_parse_temperature_rejects(text):
    with pytest.raises(module.CycleError):
        module.parse_temperature(text)


@pytest.mark.parametrize("text", ["-1bar", "3psi", ""])
def test_parse_pressure_rejects(text):
    with pytest.raises(module.CycleError):
        module.parse_pressure(text)


def test_parse_pair():
    assert module.parse_pair("p=1bar") == ("P", 1e5)
    assert module.parse_pair("H=2.8e6") == ("Hmass", 2.8e6)
    with pytest.raises(module.CycleError):
        module.parse_pair("Q=1.5")
    with pytest.raises(module.CycleError):
        module.parse_pair("X=3")


# ---------------------------------------------------------------------------
# Physics: needs CoolProp
# ---------------------------------------------------------------------------

CP = pytest.importorskip("CoolProp.CoolProp")


def test_reference_saturation_points():
    """Independent table values: IAPWS-95 water and R134a saturation."""
    water = module.state("Water", "P", 101325.0, "Q", 0, "a")
    assert water["T_K"] == pytest.approx(373.124, abs=1e-3)
    condenser = module.state("Water", "P", 10e3, "Q", 0, "b")
    assert condenser["T_K"] - 273.15 == pytest.approx(45.81, abs=0.01)
    assert condenser["h_J_per_kg"] == pytest.approx(191.81e3, abs=50)
    r134a = module.state("R134a", "T", 273.15, "Q", 1, "c")
    assert r134a["p_Pa"] == pytest.approx(292.8e3, rel=1e-3)


def test_state_quality_none_outside_dome_and_range_guard():
    vapour = module.state("Water", "P", 1e5, "T", 500.0, "v")
    assert vapour["quality"] is None
    assert vapour["phase"] == "gas"
    with pytest.raises(module.CycleError, match="outside the EOS range"):
        module.state("Water", "P", 1e5, "T", 5000.0, "hot")
    with pytest.raises(module.CycleError, match="unknown CoolProp fluid"):
        module.fluid_info("Unobtainium")


def test_ideal_rankine_is_reversible_and_matches_regression():
    result = module.rankine("Water", 30e5, 10e3, 623.15)
    perf, checks = result["performance"], result["checks"]
    assert checks["passed"]
    assert abs(checks["energy_closure_relative"]) < 1e-12
    for value in checks["second_law"]["s_gen_J_per_kgK"].values():
        assert abs(value) < 1e-6
    assert perf["eta_thermal"] == pytest.approx(0.3344, abs=5e-4)
    assert result["states"][3]["quality"] == pytest.approx(0.813, abs=1e-3)
    # pump work ~ v dp for an incompressible liquid
    v1 = 1.0 / result["states"][0]["rho_kg_per_m3"]
    assert result["specific"]["w_pump_J_per_kg"] == pytest.approx(v1 * (30e5 - 10e3), rel=2e-3)
    assert any("quality" in w for w in result["warnings"])


def test_real_rankine_gouy_stodola():
    t_source, t_sink = 873.15, 303.15
    result = module.rankine("Water", 30e5, 10e3, 623.15, 0.85, 0.80, None, t_source, t_sink)
    spec_ = result["specific"]
    sgen = result["checks"]["second_law"]["s_gen_J_per_kgK"]
    assert result["checks"]["passed"]
    assert sgen["turbine"] > 0 and sgen["pump"] > 0
    w_rev = spec_["q_in_J_per_kg"] * (1 - t_sink / t_source)
    assert w_rev - spec_["w_net_J_per_kg"] == pytest.approx(t_sink * sgen["total"], rel=1e-9)
    assert result["performance"]["eta_thermal"] < result["performance"]["eta_carnot_reservoirs"]


def test_rankine_rejects_subsaturated_turbine_inlet_and_supercritical_without_temperature():
    with pytest.raises(module.CycleError, match="below T_sat"):
        module.rankine("Water", 30e5, 10e3, 450.0)
    with pytest.raises(module.CycleError, match="supercritical"):
        module.rankine("Water", 250e5, 10e3, None)


def test_refrigeration_balances_and_gouy_stodola():
    t_cold, t_hot = 271.15, 303.15
    result = module.refrigeration("R134a", 263.15, 313.15, 5.0, 3.0, 0.75, 5000.0, t_cold, t_hot)
    perf, spec_ = result["performance"], result["specific"]
    sgen = result["checks"]["second_law"]["s_gen_J_per_kgK"]
    assert result["checks"]["passed"]
    assert perf["COP_heating"] == pytest.approx(perf["COP_cooling"] + 1.0, rel=1e-12)
    assert perf["COP_cooling"] == pytest.approx(3.132, abs=2e-3)
    assert perf["m_dot_kg_per_s"] * spec_["q_evap_J_per_kg"] == pytest.approx(5000.0)
    assert result["states"][1]["T_K"] > result["states"][2]["T_K"]
    w_min = spec_["q_evap_J_per_kg"] * (t_hot / t_cold - 1)
    assert spec_["w_compressor_J_per_kg"] - w_min == pytest.approx(t_hot * sgen["total"], rel=1e-9)


def test_ideal_refrigeration_only_valve_generates_entropy():
    result = module.refrigeration("R134a", 263.15, 313.15)
    sgen = result["checks"]["second_law"]["s_gen_J_per_kgK"]
    assert abs(sgen["compressor"]) < 1e-6
    assert sgen["expansion_valve"] > 0
    assert result["performance"]["COP_cooling"] < result["performance"]["COP_cooling_carnot_saturation"]


def test_refrigeration_refuses_transcritical_and_flags_blends():
    with pytest.raises(module.CycleError, match="transcritical"):
        module.refrigeration("R744", 268.15, 308.15)
    blend = module.refrigeration("R407C", 273.15, 318.15, 5.0)
    assert any("pseudo-pure" in w for w in blend["warnings"])
    assert blend["checks"]["passed"]


def test_brayton_ideal_vs_cold_air_and_regenerator():
    ideal = module.brayton("Air", 300.0, 101325.0, 10.0, 1400.0)
    perf = ideal["performance"]
    assert ideal["checks"]["passed"]
    assert perf["k_at_state_1"] == pytest.approx(1.40, abs=2e-3)
    assert perf["eta_cold_air_standard_ideal"] == pytest.approx(1 - 10 ** (-(perf["k_at_state_1"] - 1) / perf["k_at_state_1"]))
    # real-gas cp rises with temperature, so the real-gas ideal efficiency is lower
    assert perf["eta_thermal"] < perf["eta_cold_air_standard_ideal"]
    plain = module.brayton("Air", 300.0, 101325.0, 8.0, 1300.0, 0.85, 0.88, 0.0)
    regen = module.brayton("Air", 300.0, 101325.0, 8.0, 1300.0, 0.85, 0.88, 0.8)
    assert regen["specific"]["w_net_J_per_kg"] == pytest.approx(plain["specific"]["w_net_J_per_kg"])
    assert regen["performance"]["eta_thermal"] > plain["performance"]["eta_thermal"]
    assert regen["checks"]["passed"]


def test_saturation_dome_is_consistent():
    rows = module.saturation_dome("R134a", 12)
    assert len(rows) == 12
    for row in rows:
        assert row["p_l_Pa"] == pytest.approx(row["p_v_Pa"], rel=1e-6)
        assert row["s_v_J_per_kgK"] > row["s_l_J_per_kgK"]
        assert row["h_v_J_per_kg"] > row["h_l_J_per_kg"]
    assert rows[-1]["T_K"] < CP.PropsSI("Tcrit", "R134a")


def test_cli_json_and_exit_codes(tmp_path):
    out = io.StringIO()
    with redirect_stdout(out):
        code = module.main(["refrigeration", "--fluid", "R134a", "--t-evap=-10C", "--t-cond", "40C", "--json"])
    assert code == 0
    assert json.loads(out.getvalue())["cycle"] == "refrigeration"

    assert module.main(["state", "Water", "P=1bar", "T=3000C"]) == 2

    target = tmp_path / "dome.csv"
    assert module.main(["dome", "Water", "--points", "5", "--output", str(target)]) == 0
    with target.open(newline="") as handle:
        assert len(list(csv.DictReader(handle))) == 5
