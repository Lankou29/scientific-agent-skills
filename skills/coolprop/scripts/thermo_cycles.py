#!/usr/bin/env python3
"""Steady-flow thermodynamic cycle analysis with CoolProp real-fluid properties.

Subcommands
-----------
state       one state point from two independent properties (T, P, H, S, D, Q)
dome        saturation curve (T, p, h, s of both phases) as CSV, for T-s / p-h plots
rankine     simple Rankine cycle: pump, boiler, turbine, condenser
refrigeration  single-stage vapour-compression cycle (refrigerator or heat pump)
transcritical  transcritical CO2 (R744) cycle with gas cooler, optional optimal high pressure
brayton     closed air-standard Brayton cycle, optional regenerator

Every cycle is solved per kilogram of working fluid with the steady-flow energy
equation (kinetic and potential terms neglected): q - w = h_out - h_in. The
script then checks the first law (energy closure), the second law (entropy
generation of each adiabatic component >= 0 and efficiency below the Carnot
bound) and the validity range of the equation of state, because CoolProp
itself extrapolates silently beyond Tmax and pmax.

Inputs accept unit suffixes: temperatures "350C", "623.15K"; pressures "30bar",
"3MPa", "10kPa", "101325Pa". A bare number is SI (K or Pa). Outputs are SI.

Example
-------
    python thermo_cycles.py rankine --fluid Water --p-high 30bar --p-low 10kPa \
        --t-turbine-in 350C --eta-turbine 0.85 --eta-pump 0.80
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys

#: Relative tolerance on the first-law closure of a cycle.
CLOSURE_TOL = 1e-9
#: Entropy generation below -SGEN_TOL [J/(kg K)] is flagged as a second-law violation.
SGEN_TOL = 1e-6
#: Turbine exit quality below which moisture erosion is usually a design concern.
#: A common design guideline (not a standard); adjust to the course or vendor value.
MIN_TURBINE_EXIT_QUALITY = 0.88

T_ZERO_C = 273.15

_UNIT = re.compile(r"^\s*([-+]?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|[-+]?\.\d+(?:[eE][-+]?\d+)?)\s*([A-Za-z°]*)\s*$")
_TEMPERATURE_UNITS = {"": 0.0, "K": 0.0, "C": T_ZERO_C, "DEGC": T_ZERO_C, "°C": T_ZERO_C}
_PRESSURE_UNITS = {"": 1.0, "PA": 1.0, "KPA": 1e3, "MPA": 1e6, "BAR": 1e5, "MBAR": 1e2, "ATM": 101325.0}

PROPERTY_KEYS = {"T": "T", "P": "P", "H": "Hmass", "S": "Smass", "D": "Dmass", "Q": "Q"}


class CycleError(ValueError):
    """Raised for inputs outside the model's or the equation of state's domain."""


def _coolprop():
    """Import CoolProp lazily so that `--help` works without it."""
    try:
        import CoolProp.CoolProp as CP
    except ImportError as exc:  # pragma: no cover - exercised only without CoolProp
        raise SystemExit("CoolProp is not installed: pip install CoolProp==8.0.0") from exc
    return CP


# ---------------------------------------------------------------------------
# Input parsing
# ---------------------------------------------------------------------------

def parse_temperature(text: str | float) -> float:
    """Return an absolute temperature in K from '350C', '623.15K' or a bare number (K)."""
    if isinstance(text, (int, float)):
        value = float(text)
    else:
        match = _UNIT.match(str(text))
        if not match:
            raise CycleError(f"cannot read temperature {text!r}; use e.g. 350C or 623.15K")
        unit = match.group(2).upper().replace("°C", "C")
        if unit not in _TEMPERATURE_UNITS:
            raise CycleError(f"unknown temperature unit in {text!r}; use K or C")
        value = float(match.group(1)) + _TEMPERATURE_UNITS[unit]
    if value <= 0:
        raise CycleError(f"absolute temperature must be positive, got {value} K")
    return value


def parse_pressure(text: str | float) -> float:
    """Return an absolute pressure in Pa from '30bar', '3MPa', '10kPa' or a bare number (Pa)."""
    if isinstance(text, (int, float)):
        value = float(text)
    else:
        match = _UNIT.match(str(text))
        if not match:
            raise CycleError(f"cannot read pressure {text!r}; use e.g. 30bar or 3MPa")
        unit = match.group(2).upper()
        if unit not in _PRESSURE_UNITS:
            raise CycleError(f"unknown pressure unit in {text!r}; use Pa, kPa, MPa, bar, mbar or atm")
        value = float(match.group(1)) * _PRESSURE_UNITS[unit]
    if value <= 0:
        raise CycleError(f"absolute pressure must be positive, got {value} Pa")
    return value


def parse_pair(text: str) -> tuple[str, float]:
    """Parse 'P=30bar', 'T=350C', 'Q=1', 'H=2.8e6' into (CoolProp key, SI value)."""
    if "=" not in text:
        raise CycleError(f"state input {text!r} must look like NAME=VALUE, e.g. T=350C")
    name, raw = (part.strip() for part in text.split("=", 1))
    name = name.upper()
    if name not in PROPERTY_KEYS:
        raise CycleError(f"unsupported input property {name!r}; use one of {sorted(PROPERTY_KEYS)}")
    if name == "T":
        return "T", parse_temperature(raw)
    if name == "P":
        return "P", parse_pressure(raw)
    value = float(raw)
    if name == "Q" and not 0.0 <= value <= 1.0:
        raise CycleError(f"vapour quality must lie in [0, 1], got {value}")
    return PROPERTY_KEYS[name], value


# ---------------------------------------------------------------------------
# Fluid metadata and state points
# ---------------------------------------------------------------------------

def fluid_info(fluid: str) -> dict:
    """Canonical name, limits and equation-of-state reference of a CoolProp fluid."""
    CP = _coolprop()
    try:
        name = CP.get_fluid_param_string(fluid, "name")
    except ValueError as exc:
        raise CycleError(f"unknown CoolProp fluid {fluid!r}; see CoolProp.CoolProp.FluidsList()") from exc

    def scalar(key: str) -> float:
        return float(CP.PropsSI(key, fluid))

    return {
        "fluid": name,
        "pure": CP.get_fluid_param_string(fluid, "pure") == "true",
        "eos_reference": CP.get_fluid_param_string(fluid, "BibTeX-EOS"),
        "T_min_K": scalar("Tmin"),
        "T_max_K": scalar("Tmax"),
        "p_max_Pa": scalar("pmax"),
        "T_crit_K": scalar("Tcrit"),
        "p_crit_Pa": scalar("pcrit"),
        "coolprop_version": CP.get_global_param_string("version"),
    }


def state(fluid: str, key1: str, value1: float, key2: str, value2: float, label: str = "") -> dict:
    """Return a state point and refuse it if it lies outside the EOS validity range.

    Quality `Q` is None for single-phase states (CoolProp reports -1 there).
    """
    CP = _coolprop()
    info = fluid_info(fluid)
    try:
        T = CP.PropsSI("T", key1, value1, key2, value2, fluid)
        P = CP.PropsSI("P", key1, value1, key2, value2, fluid)
        h = CP.PropsSI("Hmass", key1, value1, key2, value2, fluid)
        s = CP.PropsSI("Smass", key1, value1, key2, value2, fluid)
        rho = CP.PropsSI("Dmass", key1, value1, key2, value2, fluid)
        Q = CP.PropsSI("Q", key1, value1, key2, value2, fluid)
        phase = CP.PhaseSI(key1, value1, key2, value2, fluid)
    except ValueError as exc:
        raise CycleError(f"CoolProp could not solve state {label or ''} ({key1}={value1}, {key2}={value2}): {exc}") from exc
    if not info["T_min_K"] <= T <= info["T_max_K"] * (1 + 1e-12):
        raise CycleError(
            f"state {label}: T = {T:.2f} K outside the EOS range "
            f"[{info['T_min_K']:.2f}, {info['T_max_K']:.2f}] K for {info['fluid']}"
        )
    if P > info["p_max_Pa"]:
        raise CycleError(f"state {label}: p = {P:.4g} Pa above the EOS limit {info['p_max_Pa']:.4g} Pa")
    two_phase = 0.0 <= Q <= 1.0
    return {
        "label": label,
        "T_K": T,
        "p_Pa": P,
        "h_J_per_kg": h,
        "s_J_per_kgK": s,
        "rho_kg_per_m3": rho,
        "quality": Q if two_phase else None,
        "phase": phase,
    }


def saturation_dome(fluid: str, points: int = 60) -> list[dict]:
    """Saturated-liquid and saturated-vapour properties from Tmin to just below Tcrit."""
    CP = _coolprop()
    info = fluid_info(fluid)
    if points < 2:
        raise CycleError("the dome needs at least 2 points")
    T_low = max(info["T_min_K"], float(CP.PropsSI("Ttriple", fluid)))
    T_high = info["T_crit_K"] * 0.9995  # stay off the critical point, where iterations struggle
    rows = []
    for i in range(points):
        T = T_low + (T_high - T_low) * i / (points - 1)
        row = {"T_K": T}
        for q, tag in ((0, "l"), (1, "v")):
            row[f"p_{tag}_Pa"] = CP.PropsSI("P", "T", T, "Q", q, fluid)
            row[f"h_{tag}_J_per_kg"] = CP.PropsSI("Hmass", "T", T, "Q", q, fluid)
            row[f"s_{tag}_J_per_kgK"] = CP.PropsSI("Smass", "T", T, "Q", q, fluid)
        rows.append(row)
    return rows


def _check_efficiency(name: str, eta: float) -> None:
    if not 0.0 < eta <= 1.0:
        raise CycleError(f"{name} must lie in (0, 1], got {eta}")


def _second_law(components: dict[str, float]) -> dict:
    violations = {k: v for k, v in components.items() if v < -SGEN_TOL}
    return {"s_gen_J_per_kgK": components, "passed": not violations, "violations": violations}


# ---------------------------------------------------------------------------
# Cycles
# ---------------------------------------------------------------------------

def rankine(
    fluid: str = "Water",
    p_high: float = 30e5,
    p_low: float = 10e3,
    t_turbine_in: float | None = None,
    eta_turbine: float = 1.0,
    eta_pump: float = 1.0,
    w_net_target: float | None = None,
    t_source: float | None = None,
    t_sink: float | None = None,
) -> dict:
    """Simple Rankine cycle. States: 1 pump inlet (saturated liquid at p_low),
    2 pump outlet, 3 turbine inlet (p_high, t_turbine_in or saturated vapour),
    4 turbine outlet (p_low). Heat exchangers are isobaric."""
    _check_efficiency("eta_turbine", eta_turbine)
    _check_efficiency("eta_pump", eta_pump)
    info = fluid_info(fluid)
    if p_low >= p_high:
        raise CycleError("p_low must be below p_high")
    if p_low >= info["p_crit_Pa"]:
        raise CycleError("condenser pressure must be subcritical: condensation needs a two-phase region")
    warnings: list[str] = []

    s1 = state(fluid, "P", p_low, "Q", 0, "1")
    s2s = state(fluid, "P", p_high, "Smass", s1["s_J_per_kgK"], "2s")
    h2 = s1["h_J_per_kg"] + (s2s["h_J_per_kg"] - s1["h_J_per_kg"]) / eta_pump
    s2 = state(fluid, "P", p_high, "Hmass", h2, "2")

    if t_turbine_in is None:
        if p_high >= info["p_crit_Pa"]:
            raise CycleError("supercritical boiler pressure: give --t-turbine-in")
        s3 = state(fluid, "P", p_high, "Q", 1, "3")
    else:
        if p_high < info["p_crit_Pa"]:
            T_sat = _coolprop().PropsSI("T", "P", p_high, "Q", 1, fluid)
            if t_turbine_in < T_sat - 1e-6:
                raise CycleError(
                    f"turbine inlet {t_turbine_in:.2f} K is below T_sat({p_high:.4g} Pa) = {T_sat:.2f} K: "
                    "the boiler would not produce vapour"
                )
            if abs(t_turbine_in - T_sat) < 1e-3:
                warnings.append("turbine inlet within 1 mK of saturation: using saturated vapour")
                t_turbine_in = None
        s3 = (
            state(fluid, "P", p_high, "Q", 1, "3")
            if t_turbine_in is None
            else state(fluid, "P", p_high, "T", t_turbine_in, "3")
        )

    s4s = state(fluid, "P", p_low, "Smass", s3["s_J_per_kgK"], "4s")
    h4 = s3["h_J_per_kg"] - eta_turbine * (s3["h_J_per_kg"] - s4s["h_J_per_kg"])
    s4 = state(fluid, "P", p_low, "Hmass", h4, "4")

    w_pump = s2["h_J_per_kg"] - s1["h_J_per_kg"]
    q_in = s3["h_J_per_kg"] - s2["h_J_per_kg"]
    w_turbine = s3["h_J_per_kg"] - s4["h_J_per_kg"]
    q_out = s4["h_J_per_kg"] - s1["h_J_per_kg"]
    w_net = w_turbine - w_pump
    if w_net <= 0:
        raise CycleError("net work is not positive: check pressures and efficiencies")
    eta_th = w_net / q_in
    eta_carnot = 1.0 - s1["T_K"] / s3["T_K"]

    if s4["quality"] is not None and s4["quality"] < MIN_TURBINE_EXIT_QUALITY:
        warnings.append(
            f"turbine exit quality x4 = {s4['quality']:.3f} < {MIN_TURBINE_EXIT_QUALITY}: "
            "risk of blade erosion (design guideline); consider superheat or reheat"
        )

    sgen = {
        "pump": s2["s_J_per_kgK"] - s1["s_J_per_kgK"],
        "turbine": s4["s_J_per_kgK"] - s3["s_J_per_kgK"],
    }
    reservoir_note = None
    if t_source is not None and t_sink is not None:
        if t_source < s3["T_K"]:
            raise CycleError(f"source at {t_source:.2f} K cannot heat the fluid to {s3['T_K']:.2f} K")
        if t_sink > s1["T_K"]:
            raise CycleError(f"sink at {t_sink:.2f} K cannot condense the fluid at {s1['T_K']:.2f} K")
        sgen["boiler_with_source"] = (s3["s_J_per_kgK"] - s2["s_J_per_kgK"]) - q_in / t_source
        sgen["condenser_with_sink"] = (s1["s_J_per_kgK"] - s4["s_J_per_kgK"]) + q_out / t_sink
        sgen["total"] = sum(sgen.values())
        eta_carnot_reservoirs = 1.0 - t_sink / t_source
    else:
        eta_carnot_reservoirs = None
        reservoir_note = "give both t_source and t_sink to evaluate heat-transfer irreversibilities"

    m_dot = w_net_target / w_net if w_net_target else None
    result = {
        "cycle": "rankine",
        "fluid": info,
        "inputs": {
            "p_high_Pa": p_high, "p_low_Pa": p_low, "t_turbine_in_K": t_turbine_in,
            "eta_turbine": eta_turbine, "eta_pump": eta_pump,
            "t_source_K": t_source, "t_sink_K": t_sink,
        },
        "states": [s1, s2, s3, s4],
        "ideal_states": [s2s, s4s],
        "specific": {
            "w_pump_J_per_kg": w_pump, "q_in_J_per_kg": q_in, "w_turbine_J_per_kg": w_turbine,
            "q_out_J_per_kg": q_out, "w_net_J_per_kg": w_net,
        },
        "performance": {
            "eta_thermal": eta_th,
            "back_work_ratio": w_pump / w_turbine,
            "eta_carnot_internal": eta_carnot,
            "eta_carnot_reservoirs": eta_carnot_reservoirs,
            "second_law_efficiency_internal": eta_th / eta_carnot,
            "m_dot_kg_per_s": m_dot,
        },
        "checks": {
            "energy_closure_relative": (q_in - q_out - w_net) / q_in,
            "below_carnot": eta_th < eta_carnot + 1e-12,
            "second_law": _second_law(sgen),
        },
        "warnings": warnings + ([reservoir_note] if reservoir_note else []),
    }
    return _finalise(result)


def refrigeration(
    fluid: str = "R134a",
    t_evap: float = 263.15,
    t_cond: float = 313.15,
    superheat: float = 0.0,
    subcooling: float = 0.0,
    eta_compressor: float = 1.0,
    q_evap_target: float | None = None,
    t_cold: float | None = None,
    t_hot: float | None = None,
) -> dict:
    """Single-stage vapour-compression cycle. States: 1 compressor inlet,
    2 compressor outlet, 3 condenser outlet, 4 expansion-valve outlet.

    Evaporator pressure is the dew pressure at t_evap, condenser pressure the
    bubble pressure at t_cond (identical for pure fluids; differs for zeotropic
    blends, which are treated as CoolProp pseudo-pure fluids)."""
    _check_efficiency("eta_compressor", eta_compressor)
    if superheat < 0 or subcooling < 0:
        raise CycleError("superheat and subcooling are temperature differences >= 0 K")
    if t_evap >= t_cond:
        raise CycleError("t_evap must be below t_cond")
    CP = _coolprop()
    info = fluid_info(fluid)
    if t_cond >= info["T_crit_K"]:
        raise CycleError(
            f"t_cond = {t_cond:.2f} K >= T_crit = {info['T_crit_K']:.2f} K: transcritical cycle "
            "(gas cooler, e.g. R744): use the transcritical subcommand"
        )
    warnings: list[str] = []
    if not info["pure"]:
        warnings.append(
            f"{info['fluid']} is a pseudo-pure blend model: temperature glide is approximated; "
            "evaporator pressure from the dew point, condenser pressure from the bubble point"
        )

    p_evap = CP.PropsSI("P", "T", t_evap, "Q", 1, fluid)
    p_cond = CP.PropsSI("P", "T", t_cond, "Q", 0, fluid)
    s1 = (
        state(fluid, "P", p_evap, "Q", 1, "1")
        if superheat == 0
        else state(fluid, "P", p_evap, "T", t_evap + superheat, "1")
    )
    s2s = state(fluid, "P", p_cond, "Smass", s1["s_J_per_kgK"], "2s")
    h2 = s1["h_J_per_kg"] + (s2s["h_J_per_kg"] - s1["h_J_per_kg"]) / eta_compressor
    s2 = state(fluid, "P", p_cond, "Hmass", h2, "2")
    s3 = (
        state(fluid, "P", p_cond, "Q", 0, "3")
        if subcooling == 0
        else state(fluid, "P", p_cond, "T", t_cond - subcooling, "3")
    )
    s4 = state(fluid, "P", p_evap, "Hmass", s3["h_J_per_kg"], "4")  # isenthalpic throttling

    q_L = s1["h_J_per_kg"] - s4["h_J_per_kg"]
    w_c = s2["h_J_per_kg"] - s1["h_J_per_kg"]
    q_H = s2["h_J_per_kg"] - s3["h_J_per_kg"]
    if q_L <= 0:
        raise CycleError("no refrigeration effect: check temperatures and subcooling")
    cop_r = q_L / w_c
    cop_hp = q_H / w_c
    cop_r_carnot = t_evap / (t_cond - t_evap)

    sgen = {
        "compressor": s2["s_J_per_kgK"] - s1["s_J_per_kgK"],
        "expansion_valve": s4["s_J_per_kgK"] - s3["s_J_per_kgK"],
    }
    if t_cold is not None and t_hot is not None:
        if t_cold <= s4["T_K"]:
            raise CycleError(f"cold space at {t_cold:.2f} K cannot heat the evaporator at {s4['T_K']:.2f} K")
        if t_hot >= s3["T_K"]:
            raise CycleError(f"hot sink at {t_hot:.2f} K cannot cool the condenser outlet at {s3['T_K']:.2f} K")
        sgen["evaporator_with_cold_space"] = (s1["s_J_per_kgK"] - s4["s_J_per_kgK"]) - q_L / t_cold
        sgen["condenser_with_hot_sink"] = (s3["s_J_per_kgK"] - s2["s_J_per_kgK"]) + q_H / t_hot
        sgen["total"] = sum(sgen.values())
        cop_r_reservoirs = t_cold / (t_hot - t_cold)
    else:
        cop_r_reservoirs = None
        warnings.append("give both t_cold and t_hot to evaluate heat-transfer irreversibilities")
    if s1["quality"] is not None:
        warnings.append("compressor inlet is saturated vapour: no superheat margin against liquid slugging")

    m_dot = q_evap_target / q_L if q_evap_target else None
    result = {
        "cycle": "refrigeration",
        "fluid": info,
        "inputs": {
            "t_evap_K": t_evap, "t_cond_K": t_cond, "superheat_K": superheat, "subcooling_K": subcooling,
            "eta_compressor": eta_compressor, "t_cold_K": t_cold, "t_hot_K": t_hot,
        },
        "states": [s1, s2, s3, s4],
        "ideal_states": [s2s],
        "specific": {"q_evap_J_per_kg": q_L, "w_compressor_J_per_kg": w_c, "q_cond_J_per_kg": q_H},
        "performance": {
            "COP_cooling": cop_r,
            "COP_heating": cop_hp,
            "COP_cooling_carnot_saturation": cop_r_carnot,
            "COP_cooling_carnot_reservoirs": cop_r_reservoirs,
            "second_law_efficiency_saturation": cop_r / cop_r_carnot,
            "pressure_ratio": p_cond / p_evap,
            "discharge_temperature_K": s2["T_K"],
            "m_dot_kg_per_s": m_dot,
            "compressor_power_W": m_dot * w_c if m_dot else None,
        },
        "checks": {
            "energy_closure_relative": (q_H - q_L - w_c) / q_H,
            "below_carnot": cop_r < cop_r_carnot + 1e-12,
            "second_law": _second_law(sgen),
        },
        "warnings": warnings,
    }
    return _finalise(result)


def _transcritical_cop(fluid: str, h1: float, s1: float, p_evap: float, p_gc: float,
                       t_gc_out: float, eta_compressor: float) -> float:
    """Cooling COP at gas-cooler pressure p_gc (objective of the pressure optimisation)."""
    CP = _coolprop()
    h2s = CP.PropsSI("Hmass", "P", p_gc, "Smass", s1, fluid)
    h2 = h1 + (h2s - h1) / eta_compressor
    h3 = CP.PropsSI("Hmass", "P", p_gc, "T", t_gc_out, fluid)
    q_L = h1 - h3  # h4 = h3
    return q_L / (h2 - h1) if q_L > 0 else -math.inf


def optimal_gas_cooler_pressure(fluid: str, h1: float, s1: float, p_evap: float, t_gc_out: float,
                                eta_compressor: float, p_min: float, p_max: float) -> tuple[float, bool]:
    """Maximise the cooling COP over p_gc in [p_min, p_max].

    A 200-point scan brackets the maximum (the COP curve is sharp just above
    p_crit and flat beyond the optimum), then a golden-section search refines it.
    Returns (p_opt, at_bound), at_bound True when the optimum sits on an interval end.
    """
    n = 200
    grid = [p_min + (p_max - p_min) * i / (n - 1) for i in range(n)]
    cops = [_transcritical_cop(fluid, h1, s1, p_evap, p, t_gc_out, eta_compressor) for p in grid]
    i_best = max(range(n), key=cops.__getitem__)
    if not math.isfinite(cops[i_best]):
        raise CycleError("no gas-cooler pressure in the search interval gives a refrigeration effect")
    lo, hi = grid[max(i_best - 1, 0)], grid[min(i_best + 1, n - 1)]
    ratio = (math.sqrt(5.0) - 1.0) / 2.0
    a, b = lo + (1 - ratio) * (hi - lo), lo + ratio * (hi - lo)
    fa = _transcritical_cop(fluid, h1, s1, p_evap, a, t_gc_out, eta_compressor)
    fb = _transcritical_cop(fluid, h1, s1, p_evap, b, t_gc_out, eta_compressor)
    while hi - lo > 1.0:  # 1 Pa resolution, far below any practical control accuracy
        if fa > fb:
            hi, b, fb = b, a, fa
            a = lo + (1 - ratio) * (hi - lo)
            fa = _transcritical_cop(fluid, h1, s1, p_evap, a, t_gc_out, eta_compressor)
        else:
            lo, a, fa = a, b, fb
            b = lo + ratio * (hi - lo)
            fb = _transcritical_cop(fluid, h1, s1, p_evap, b, t_gc_out, eta_compressor)
    p_opt = 0.5 * (lo + hi)
    return p_opt, i_best in (0, n - 1)


def liao_optimal_pressure(t_evap: float, t_gc_out: float) -> float:
    """Optimal CO2 gas-cooler pressure [Pa] from the Liao, Zhao and Jakobsen (2000) correlation.

    p_opt [bar] = (2.778 - 0.0157 t_e) t_gc + (0.381 t_e - 9.34), temperatures in C
    (Applied Thermal Engineering 20(9), 831-841). Comparison value only: the
    correlation was fitted to a specific cycle model, the scripted optimum is computed.
    """
    t_e, t_gc = t_evap - T_ZERO_C, t_gc_out - T_ZERO_C
    return ((2.778 - 0.0157 * t_e) * t_gc + (0.381 * t_e - 9.34)) * 1e5


def transcritical(
    fluid: str = "R744",
    t_evap: float = 268.15,
    t_gc_out: float = 308.15,
    p_gc: float | None = None,
    superheat: float = 0.0,
    eta_compressor: float = 1.0,
    q_evap_target: float | None = None,
    q_heating_target: float | None = None,
    p_gc_max: float = 140e5,
) -> dict:
    """Single-stage transcritical vapour-compression cycle (typically CO2 / R744).

    States: 1 compressor inlet (p_evap, saturated vapour or t_evap + superheat),
    2 compressor outlet at the supercritical gas-cooler pressure p_gc,
    3 gas-cooler outlet (p_gc, t_gc_out), 4 throttling-valve outlet (p_evap, h4 = h3).
    Above the critical pressure there is no condensation: the gas-cooler outlet
    temperature and pressure are independent, and the COP has a maximum in p_gc.
    If p_gc is None it is optimised for maximum cooling COP in (p_crit, p_gc_max].
    """
    _check_efficiency("eta_compressor", eta_compressor)
    if superheat < 0:
        raise CycleError("superheat is a temperature difference >= 0 K")
    if t_gc_out <= t_evap:
        raise CycleError("t_gc_out must be above t_evap")
    CP = _coolprop()
    info = fluid_info(fluid)
    if t_evap >= info["T_crit_K"]:
        raise CycleError("evaporation needs t_evap below the critical temperature")
    warnings: list[str] = []
    if not info["pure"]:
        warnings.append(f"{info['fluid']} is a pseudo-pure blend model: evaporator pressure from the dew point")

    p_evap = CP.PropsSI("P", "T", t_evap, "Q", 1, fluid)
    s1 = (
        state(fluid, "P", p_evap, "Q", 1, "1")
        if superheat == 0
        else state(fluid, "P", p_evap, "T", t_evap + superheat, "1")
    )
    p_min = info["p_crit_Pa"] * 1.001
    optimised = p_gc is None
    if optimised:
        if p_gc_max <= p_min:
            raise CycleError("p_gc_max must exceed the critical pressure")
        p_gc, at_bound = optimal_gas_cooler_pressure(
            fluid, s1["h_J_per_kg"], s1["s_J_per_kgK"], p_evap, t_gc_out, eta_compressor, p_min, p_gc_max
        )
        if at_bound:
            warnings.append("optimum gas-cooler pressure lies on the search bound: widen --p-gc-max or check inputs")
    elif p_gc <= info["p_crit_Pa"]:
        raise CycleError(
            f"p_gc = {p_gc:.4g} Pa is not above p_crit = {info['p_crit_Pa']:.4g} Pa: "
            "subcritical heat rejection, use the refrigeration subcommand"
        )

    s2s = state(fluid, "P", p_gc, "Smass", s1["s_J_per_kgK"], "2s")
    h2 = s1["h_J_per_kg"] + (s2s["h_J_per_kg"] - s1["h_J_per_kg"]) / eta_compressor
    s2 = state(fluid, "P", p_gc, "Hmass", h2, "2")
    s3 = state(fluid, "P", p_gc, "T", t_gc_out, "3")
    s4 = state(fluid, "P", p_evap, "Hmass", s3["h_J_per_kg"], "4")
    if s4["quality"] is None:
        raise CycleError("valve outlet is not two-phase: no evaporation, raise p_gc or lower t_gc_out")

    q_L = s1["h_J_per_kg"] - s4["h_J_per_kg"]
    w_c = s2["h_J_per_kg"] - s1["h_J_per_kg"]
    q_H = s2["h_J_per_kg"] - s3["h_J_per_kg"]
    cop_r = q_L / w_c
    # Upper bound: heat is absorbed at T <= T1 and rejected at T >= T3, so the entropy
    # balance of any cycle between these fluid temperatures gives COP_R <= T1 / (T3 - T1).
    cop_r_bound = s1["T_K"] / (s3["T_K"] - s1["T_K"])
    # Lorenz reference: entropic mean temperatures of heat absorption and rejection.
    t_mean_L = q_L / (s1["s_J_per_kgK"] - s4["s_J_per_kgK"])
    t_mean_H = q_H / (s2["s_J_per_kgK"] - s3["s_J_per_kgK"])
    cop_lorenz = t_mean_L / (t_mean_H - t_mean_L)

    sgen = {
        "compressor": s2["s_J_per_kgK"] - s1["s_J_per_kgK"],
        "expansion_valve": s4["s_J_per_kgK"] - s3["s_J_per_kgK"],
    }
    if s1["quality"] is not None:
        warnings.append("compressor inlet is saturated vapour: no superheat margin against liquid slugging")
    if p_gc > p_gc_max:
        warnings.append(f"p_gc = {p_gc / 1e5:.1f} bar exceeds p_gc_max = {p_gc_max / 1e5:.1f} bar")

    p_liao = liao_optimal_pressure(t_evap, t_gc_out) if info["fluid"] == "CarbonDioxide" else None

    if q_evap_target and q_heating_target:
        raise CycleError("give either a cooling or a heating capacity, not both")
    m_dot = q_evap_target / q_L if q_evap_target else (q_heating_target / q_H if q_heating_target else None)
    result = {
        "cycle": "transcritical",
        "fluid": info,
        "inputs": {
            "t_evap_K": t_evap, "t_gc_out_K": t_gc_out, "p_gc_Pa": p_gc, "p_gc_optimised": optimised,
            "p_gc_max_Pa": p_gc_max, "superheat_K": superheat, "eta_compressor": eta_compressor,
        },
        "states": [s1, s2, s3, s4],
        "ideal_states": [s2s],
        "specific": {"q_evap_J_per_kg": q_L, "w_compressor_J_per_kg": w_c, "q_gas_cooler_J_per_kg": q_H},
        "performance": {
            "COP_cooling": cop_r,
            "COP_heating": q_H / w_c,
            "COP_cooling_carnot_bound": cop_r_bound,
            "COP_cooling_lorenz": cop_lorenz,
            "T_mean_absorption_K": t_mean_L,
            "T_mean_rejection_K": t_mean_H,
            "p_gas_cooler_Pa": p_gc,
            "p_gc_opt_liao_2000_Pa": p_liao,
            "pressure_ratio": p_gc / p_evap,
            "discharge_temperature_K": s2["T_K"],
            "m_dot_kg_per_s": m_dot,
            "compressor_power_W": m_dot * w_c if m_dot else None,
        },
        "checks": {
            "energy_closure_relative": (q_H - q_L - w_c) / q_H,
            "below_carnot": cop_r < cop_r_bound + 1e-12,
            "second_law": _second_law(sgen),
        },
        "warnings": warnings,
    }
    return _finalise(result)


def brayton(
    fluid: str = "Air",
    t_compressor_in: float = 300.0,
    p_low: float = 101325.0,
    pressure_ratio: float = 10.0,
    t_turbine_in: float = 1400.0,
    eta_compressor: float = 1.0,
    eta_turbine: float = 1.0,
    regenerator_effectiveness: float = 0.0,
) -> dict:
    """Closed air-standard Brayton cycle with real-gas properties.
    States: 1 compressor inlet, 2 compressor outlet, 3 turbine inlet, 4 turbine outlet.
    Combustion is replaced by external heat addition (air-standard assumption)."""
    _check_efficiency("eta_compressor", eta_compressor)
    _check_efficiency("eta_turbine", eta_turbine)
    if pressure_ratio <= 1:
        raise CycleError("pressure_ratio must exceed 1")
    if not 0.0 <= regenerator_effectiveness < 1.0:
        raise CycleError("regenerator_effectiveness must lie in [0, 1)")
    CP = _coolprop()
    info = fluid_info(fluid)
    warnings: list[str] = []
    p_high = p_low * pressure_ratio

    s1 = state(fluid, "P", p_low, "T", t_compressor_in, "1")
    if s1["quality"] is not None or ("gas" not in s1["phase"] and "supercritical" not in s1["phase"]):
        raise CycleError(f"compressor inlet is not a gas ({s1['phase']})")
    s2s = state(fluid, "P", p_high, "Smass", s1["s_J_per_kgK"], "2s")
    h2 = s1["h_J_per_kg"] + (s2s["h_J_per_kg"] - s1["h_J_per_kg"]) / eta_compressor
    s2 = state(fluid, "P", p_high, "Hmass", h2, "2")
    if t_turbine_in <= s2["T_K"]:
        raise CycleError("turbine inlet must be hotter than the compressor outlet")
    s3 = state(fluid, "P", p_high, "T", t_turbine_in, "3")
    s4s = state(fluid, "P", p_low, "Smass", s3["s_J_per_kgK"], "4s")
    h4 = s3["h_J_per_kg"] - eta_turbine * (s3["h_J_per_kg"] - s4s["h_J_per_kg"])
    s4 = state(fluid, "P", p_low, "Hmass", h4, "4")

    q_regen = 0.0
    if regenerator_effectiveness > 0:
        if s4["T_K"] <= s2["T_K"]:
            warnings.append("T4 <= T2: a regenerator cannot recover heat, effectiveness ignored")
        else:
            cold_max = CP.PropsSI("Hmass", "P", p_high, "T", s4["T_K"], fluid) - s2["h_J_per_kg"]
            hot_max = s4["h_J_per_kg"] - CP.PropsSI("Hmass", "P", p_low, "T", s2["T_K"], fluid)
            q_regen = regenerator_effectiveness * min(cold_max, hot_max)

    w_c = s2["h_J_per_kg"] - s1["h_J_per_kg"]
    w_t = s3["h_J_per_kg"] - s4["h_J_per_kg"]
    w_net = w_t - w_c
    q_in = s3["h_J_per_kg"] - s2["h_J_per_kg"] - q_regen
    q_out = s4["h_J_per_kg"] - s1["h_J_per_kg"] - q_regen
    if w_net <= 0:
        raise CycleError("net work is not positive: pressure ratio too high or efficiencies too low")
    eta_th = w_net / q_in
    eta_carnot = 1.0 - t_compressor_in / t_turbine_in

    # Cold-air-standard reference (constant k evaluated at state 1): only a comparison value.
    k1 = CP.PropsSI("Cp0mass", "P", p_low, "T", t_compressor_in, fluid) / (
        CP.PropsSI("Cp0mass", "P", p_low, "T", t_compressor_in, fluid)
        - CP.PropsSI("gas_constant", fluid) / CP.PropsSI("molar_mass", fluid)
    )
    eta_cold_air_ideal = 1.0 - pressure_ratio ** (-(k1 - 1.0) / k1)

    sgen = {
        "compressor": s2["s_J_per_kgK"] - s1["s_J_per_kgK"],
        "turbine": s4["s_J_per_kgK"] - s3["s_J_per_kgK"],
    }
    result = {
        "cycle": "brayton",
        "fluid": info,
        "inputs": {
            "t_compressor_in_K": t_compressor_in, "p_low_Pa": p_low, "pressure_ratio": pressure_ratio,
            "t_turbine_in_K": t_turbine_in, "eta_compressor": eta_compressor, "eta_turbine": eta_turbine,
            "regenerator_effectiveness": regenerator_effectiveness,
        },
        "states": [s1, s2, s3, s4],
        "ideal_states": [s2s, s4s],
        "specific": {
            "w_compressor_J_per_kg": w_c, "w_turbine_J_per_kg": w_t, "w_net_J_per_kg": w_net,
            "q_in_J_per_kg": q_in, "q_out_J_per_kg": q_out, "q_regenerator_J_per_kg": q_regen,
        },
        "performance": {
            "eta_thermal": eta_th,
            "back_work_ratio": w_c / w_t,
            "eta_carnot_internal": eta_carnot,
            "eta_cold_air_standard_ideal": eta_cold_air_ideal,
            "k_at_state_1": k1,
        },
        "checks": {
            "energy_closure_relative": (q_in - q_out - w_net) / q_in,
            "below_carnot": eta_th < eta_carnot + 1e-12,
            "second_law": _second_law(sgen),
        },
        "warnings": warnings,
    }
    return _finalise(result)


def _finalise(result: dict) -> dict:
    checks = result["checks"]
    checks["energy_closure_passed"] = abs(checks["energy_closure_relative"]) < CLOSURE_TOL
    checks["passed"] = checks["energy_closure_passed"] and checks["below_carnot"] and checks["second_law"]["passed"]
    return result


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def format_states(states: list[dict]) -> str:
    header = f"{'state':>5} {'T [K]':>9} {'T [C]':>8} {'p [bar]':>10} {'h [kJ/kg]':>10} {'s [kJ/kg/K]':>11} {'x [-]':>7}  phase"
    lines = [header, "-" * len(header)]
    for st in states:
        x = "-" if st["quality"] is None else f"{st['quality']:.4f}"
        lines.append(
            f"{st['label']:>5} {st['T_K']:9.2f} {st['T_K'] - T_ZERO_C:8.2f} {st['p_Pa'] / 1e5:10.4f} "
            f"{st['h_J_per_kg'] / 1e3:10.2f} {st['s_J_per_kgK'] / 1e3:11.4f} {x:>7}  {st['phase']}"
        )
    return "\n".join(lines)


def format_report(result: dict) -> str:
    info = result["fluid"]
    lines = [
        f"{result['cycle']} cycle -- {info['fluid']} (EOS: {info['eos_reference']}, CoolProp {info['coolprop_version']})",
        "",
        format_states(result["states"]),
        "",
    ]
    for key, value in result["specific"].items():
        lines.append(f"  {key:<28} {value / 1e3:12.3f} kJ/kg")
    for key, value in result["performance"].items():
        if value is not None:
            lines.append(f"  {key:<28} {value:12.5g}")
    checks = result["checks"]
    status = "[OK]" if checks["passed"] else "[FAIL]"
    lines.append("")
    lines.append(f"{status} energy closure {checks['energy_closure_relative']:.2e}, "
                 f"below Carnot: {checks['below_carnot']}, second law: {checks['second_law']['passed']}")
    for key, value in checks["second_law"]["s_gen_J_per_kgK"].items():
        lines.append(f"  s_gen {key:<28} {value:12.4f} J/(kg K)")
    for warning in result["warnings"]:
        lines.append(f"-> warning: {warning}")
    return "\n".join(lines)


def _emit(result: dict, as_json: bool) -> None:
    print(json.dumps(result, indent=2) if as_json else format_report(result))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Real-fluid thermodynamic cycles with CoolProp (SI outputs).",
        epilog="Temperatures accept K or C suffixes (350C); pressures accept Pa, kPa, MPa, bar, mbar, atm. Write negative values as --t-evap=-10C.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_state = sub.add_parser("state", help="one state point from two inputs, e.g. P=1bar Q=1")
    p_state.add_argument("fluid")
    p_state.add_argument("inputs", nargs=2, metavar="NAME=VALUE", help="two of T, P, H, S, D, Q")
    p_state.add_argument("--json", action="store_true")

    p_dome = sub.add_parser("dome", help="saturation curve as CSV for T-s or p-h diagrams")
    p_dome.add_argument("fluid")
    p_dome.add_argument("--points", type=int, default=60)
    p_dome.add_argument("--output", help="CSV path (default: stdout)")

    p_rk = sub.add_parser("rankine", help="simple Rankine cycle")
    p_rk.add_argument("--fluid", default="Water")
    p_rk.add_argument("--p-high", required=True, type=parse_pressure)
    p_rk.add_argument("--p-low", required=True, type=parse_pressure)
    p_rk.add_argument("--t-turbine-in", type=parse_temperature, help="omit for saturated vapour")
    p_rk.add_argument("--eta-turbine", type=float, default=1.0)
    p_rk.add_argument("--eta-pump", type=float, default=1.0)
    p_rk.add_argument("--w-net", type=float, help="target net power [W] to size the mass flow")
    p_rk.add_argument("--t-source", type=parse_temperature, help="heat-source temperature")
    p_rk.add_argument("--t-sink", type=parse_temperature, help="heat-sink temperature")
    p_rk.add_argument("--json", action="store_true")

    p_rf = sub.add_parser("refrigeration", help="vapour-compression refrigerator / heat pump")
    p_rf.add_argument("--fluid", default="R134a")
    p_rf.add_argument("--t-evap", required=True, type=parse_temperature, help="evaporating (dew) temperature")
    p_rf.add_argument("--t-cond", required=True, type=parse_temperature, help="condensing (bubble) temperature")
    p_rf.add_argument("--superheat", type=float, default=0.0, help="K")
    p_rf.add_argument("--subcooling", type=float, default=0.0, help="K")
    p_rf.add_argument("--eta-compressor", type=float, default=1.0, help="isentropic efficiency")
    p_rf.add_argument("--q-evap", type=float, help="target cooling capacity [W] to size the mass flow")
    p_rf.add_argument("--t-cold", type=parse_temperature, help="cold-space temperature")
    p_rf.add_argument("--t-hot", type=parse_temperature, help="heat-sink temperature")
    p_rf.add_argument("--json", action="store_true")

    p_tc = sub.add_parser("transcritical", help="transcritical cycle with gas cooler (CO2 / R744)")
    p_tc.add_argument("--fluid", default="R744")
    p_tc.add_argument("--t-evap", required=True, type=parse_temperature, help="evaporating (dew) temperature")
    p_tc.add_argument("--t-gc-out", required=True, type=parse_temperature, help="gas-cooler outlet temperature")
    p_tc.add_argument("--p-gc", type=parse_pressure, help="gas-cooler pressure; omit to optimise the COP")
    p_tc.add_argument("--p-gc-max", type=parse_pressure, default=140e5,
                      help="upper bound of the optimisation and design limit (default 140bar)")
    p_tc.add_argument("--superheat", type=float, default=0.0, help="K")
    p_tc.add_argument("--eta-compressor", type=float, default=1.0, help="isentropic efficiency")
    capacity = p_tc.add_mutually_exclusive_group()
    capacity.add_argument("--q-evap", type=float, help="target cooling capacity [W] to size the mass flow")
    capacity.add_argument("--q-heating", type=float, help="target heating capacity [W] to size the mass flow")
    p_tc.add_argument("--json", action="store_true")

    p_br = sub.add_parser("brayton", help="closed air-standard Brayton cycle")
    p_br.add_argument("--fluid", default="Air")
    p_br.add_argument("--t-compressor-in", type=parse_temperature, default=300.0)
    p_br.add_argument("--p-low", type=parse_pressure, default=101325.0)
    p_br.add_argument("--pressure-ratio", type=float, required=True)
    p_br.add_argument("--t-turbine-in", type=parse_temperature, required=True)
    p_br.add_argument("--eta-compressor", type=float, default=1.0)
    p_br.add_argument("--eta-turbine", type=float, default=1.0)
    p_br.add_argument("--regenerator", type=float, default=0.0, help="effectiveness in [0, 1)")
    p_br.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        if args.command == "state":
            (k1, v1), (k2, v2) = (parse_pair(text) for text in args.inputs)
            result = state(args.fluid, k1, v1, k2, v2, "A")
            print(json.dumps(result, indent=2) if args.json else format_states([result]))
            return 0
        if args.command == "dome":
            rows = saturation_dome(args.fluid, args.points)
            handle = open(args.output, "w", newline="", encoding="utf-8") if args.output else sys.stdout
            try:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            finally:
                if args.output:
                    handle.close()
            return 0
        if args.command == "rankine":
            result = rankine(args.fluid, args.p_high, args.p_low, args.t_turbine_in, args.eta_turbine,
                             args.eta_pump, args.w_net, args.t_source, args.t_sink)
        elif args.command == "refrigeration":
            result = refrigeration(args.fluid, args.t_evap, args.t_cond, args.superheat, args.subcooling,
                                   args.eta_compressor, args.q_evap, args.t_cold, args.t_hot)
        elif args.command == "transcritical":
            result = transcritical(args.fluid, args.t_evap, args.t_gc_out, args.p_gc, args.superheat,
                                   args.eta_compressor, args.q_evap, args.q_heating, args.p_gc_max)
        else:
            result = brayton(args.fluid, args.t_compressor_in, args.p_low, args.pressure_ratio,
                             args.t_turbine_in, args.eta_compressor, args.eta_turbine, args.regenerator)
    except CycleError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 2
    _emit(result, args.json)
    return 0 if result["checks"]["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
