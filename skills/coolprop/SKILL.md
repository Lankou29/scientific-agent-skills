---
name: coolprop
description: Computes real-fluid thermodynamic properties with CoolProp and analyses steady-flow power and refrigeration cycles - Rankine steam cycles, vapour-compression refrigerators and heat pumps, transcritical CO2 (R744) cycles with gas cooler and optimal high pressure, air-standard Brayton gas turbines - with first-law closure, entropy-generation and Carnot checks and equation-of-state validity limits. Use for PropsSI or AbstractState lookups, steam tables, refrigerant p-h and T-s states (R134a, R1234yf, R290, R32, R744, ammonia), saturation domes for diagrams, cycle efficiency or COP, isentropic efficiencies, quality at turbine exit, exergy destruction, humid-air psychrometrics with HAPropsSI, or checking textbook thermodynamics exercises against a reference equation of state.
license: MIT
compatibility: Requires Python 3.12+ with CoolProp 8.0.0 (pip wheel, no compiler needed). Runs locally without network access or credentials. REFPROP backends need a separately licensed NIST REFPROP installation and are not covered by the tests.
metadata:
  version: "1.0"
  skill-author: N. Bourbigot
  tested-package-version: "8.0.0"
  last-reviewed: "2026-10-18"
---

# CoolProp: real-fluid properties and thermodynamic cycles

## When to use

Use this skill when a calculation needs thermodynamic properties of a real working fluid
(water/steam, refrigerants, CO2, hydrocarbons, air, nitrogen, ammonia...) or when a power or
refrigeration cycle must be evaluated state by state:

- property lookups: `PropsSI`, `PhaseSI`, the faster `AbstractState` interface, saturation data;
- simple Rankine cycle (pump, boiler, turbine, condenser), with or without superheat;
- single-stage vapour-compression refrigerator or heat pump (COP, discharge temperature,
  mass flow for a given capacity);
- transcritical CO2 (R744) refrigerator or heat pump with gas cooler, imposed or
  COP-optimal high pressure;
- closed air-standard Brayton cycle with real-gas air, optional regenerator;
- saturation domes exported as CSV for T-s and p-h diagrams;
- humid-air (psychrometric) properties with `HAPropsSI` for HVAC and building physics;
- checking a textbook or exam solution against a reference equation of state.

It does not cover combustion chemistry (use `cantera`), multi-stage, ejector or cascade
cycles, internal heat exchangers, or transient component models. For unit handling
and measurement uncertainty on the inputs use `uncertainty-and-units`; for plotting use
`scientific-visualization`.

## Install and verify

Tested 2026-10-18 with **CoolProp 8.0.0** (git revision `ae81610e`) on CPython 3.13, Linux x86-64.

```bash
uv pip install "CoolProp==8.0.0"
python -c "import CoolProp; print(CoolProp.__version__)"   # 8.0.0
```

CoolProp 8 keeps the 6.x/7.x Python API used here (`CoolProp.CoolProp.PropsSI`,
`AbstractState`, `CoolProp.HumidAirProp.HAPropsSI`). Record the version with every result:
the equations of state and default reference states can change between releases.

## Core rules

1. **Everything is SI**: K, Pa, J/kg, J/(kg K), kg/m3. `PropsSI("H", ...)` returns J/kg,
   not kJ/kg; a temperature of 25 must be written 298.15. Convert at the boundary only.
2. **CoolProp extrapolates silently.** `PropsSI("H","P",1e5,"T",5000,"Water")` returns a
   number although Water is only valid up to 2000 K. Compare every state with
   `Tmin`, `Tmax`, `pmax` (the bundled script does this and refuses such states).
3. **Quality is -1 outside the dome**, not 0 or 1. Test `0 <= Q <= 1` before using it,
   and use `PhaseSI` to name the phase (`liquid`, `gas`, `twophase`, `supercritical_gas`...).
4. **Only differences of h and s are meaningful** across sources. Water follows the IAPWS-95
   convention (u = s = 0 for saturated liquid at the triple point); refrigerants use the IIR
   convention (h = 200 kJ/kg, s = 1 kJ/(kg K) for saturated liquid at 0 C). Air (Lemmon 2000)
   has yet another reference. Align references before comparing with printed tables.
5. **Choose input pairs that fix the state.** `(P, T)` is singular inside the dome; use
   `(P, Q)` or `(T, Q)` for saturated states and `(P, H)` or `(P, S)` after a process.
6. **Blends are pseudo-pure models** (`R410A`, `R407C`, `R404A`...): dew and bubble pressures
   differ at the same temperature (glide). State which one defines the evaporating and
   condensing temperatures.
7. Report the EOS reference (`get_fluid_param_string(fluid, "BibTeX-EOS")`) and the CoolProp
   version with the numbers; distinguish computed values from tabulated or measured ones.

Details, fluid names, backends and pitfalls: [references/fluids-and-validity.md](references/fluids-and-validity.md).

## Workflow for a cycle

1. Draw the cycle, number the states, and state the hypotheses: steady flow, kinetic and
   potential energy neglected, isobaric heat exchangers, adiabatic turbomachines with
   isentropic efficiency, isenthalpic throttling. Write the sign convention
   (here: q > 0 received by the fluid, w > 0 delivered by the fluid in turbines,
   w > 0 absorbed by pumps and compressors, all per kg of working fluid).
2. Fix the two independent properties of each state. Outlet of a real turbomachine:
   compute the isentropic state `(p_out, s_in)` first, then
   `h_out = h_in - eta_t (h_in - h_out,s)` (turbine) or `h_out = h_in + (h_out,s - h_in)/eta_c`
   (pump, compressor), then the state from `(p_out, h_out)`.
3. Apply the steady-flow energy equation to each component, then the cycle balance.
4. Check: energy closure `q_in - q_out - w_net = 0`; entropy generation of each adiabatic
   component `>= 0`; efficiency or COP below the Carnot value between the same extreme
   temperatures; turbine exit quality; compressor inlet superheated.
5. Report states in a table (T, p, h, s, x, phase), specific works and heats, performance,
   checks and assumptions. Equations and the second-law bookkeeping are in
   [references/cycle-models.md](references/cycle-models.md).

## Bundled helper: `scripts/thermo_cycles.py`

Standard argparse CLI and importable module (`rankine`, `refrigeration`, `transcritical`, `brayton`, `state`,
`saturation_dome`). Inputs accept unit suffixes (`350C`, `623.15K`, `30bar`, `3MPa`, `10kPa`,
`1atm`); bare numbers are SI. Write negative values with `=`: `--t-evap=-10C`.
Text output by default, full JSON with `--json`. Exit code 0 when every check passes,
1 when a first- or second-law check fails, 2 for invalid input or a state outside the EOS range.

```bash
S=skills/coolprop/scripts/thermo_cycles.py

# One state point (saturated vapour at 1 bar)
python $S state Water P=1bar Q=1

# Rankine: 30 bar / 350 C, condenser 10 kPa, eta_t = 0.85, eta_p = 0.80,
# heat source at 600 C and cooling water at 30 C for the entropy-generation budget
python $S rankine --p-high 30bar --p-low 10kPa --t-turbine-in 350C \
    --eta-turbine 0.85 --eta-pump 0.80 --t-source 600C --t-sink 30C

# Refrigerator R134a: -10 C / 40 C, 5 K superheat, 3 K subcooling, eta_s = 0.75, 5 kW cooling
python $S refrigeration --fluid R134a --t-evap=-10C --t-cond 40C --superheat 5 \
    --subcooling 3 --eta-compressor 0.75 --q-evap 5000 --t-cold=-2C --t-hot 30C

# Transcritical CO2: evaporation -5 C, gas-cooler outlet 35 C, 5 K superheat, eta_s = 0.70,
# optimal gas-cooler pressure searched in (p_crit, 140 bar], sized for 10 kW heating
python $S transcritical --t-evap=-5C --t-gc-out 35C --superheat 5 \
    --eta-compressor 0.70 --q-heating 10000
# same cycle at an imposed gas-cooler pressure
python $S transcritical --t-evap=-5C --t-gc-out 35C --p-gc 100bar --eta-compressor 0.70

# Brayton: r = 8, T1 = 300 K, T3 = 1300 K, eta_c = 0.85, eta_t = 0.88, regenerator 0.8
python $S brayton --pressure-ratio 8 --t-turbine-in 1300 \
    --eta-compressor 0.85 --eta-turbine 0.88 --regenerator 0.8

# Saturation dome for a T-s or p-h diagram
python $S dome R134a --points 80 --output r134a_dome.csv
```

Results obtained with CoolProp 8.0.0 (computed values, not measurements):

| Case | Key results |
| --- | --- |
| Ideal Rankine 3 MPa / 350 C / 10 kPa | eta_th = 0.3344, x4 = 0.813, w_pump = 3.02 kJ/kg |
| Same, eta_t = 0.85, eta_p = 0.80 | eta_th = 0.2839, x4 = 0.874 (erosion warning), s_gen,turbine = 0.461 kJ/(kg K) |
| R134a -10 C / 40 C, SH 5 K, SC 3 K, eta_s = 0.75 | COP_R = 3.13, T_discharge = 61.9 C, m = 0.0345 kg/s for 5 kW |
| R744 -5 C / gas cooler 35 C, ideal compressor | p_gc,opt = 88.8 bar (Liao 2000 correlation: 88.7 bar), COP_R = 3.01 |
| Same, SH 5 K, eta_s = 0.70, 10 kW heating | p_gc,opt = 88.3 bar, COP_R = 2.12, COP_HP = 3.12, T_discharge = 95.6 C |
| Brayton ideal, r = 10, 300 K / 1400 K | eta_th = 0.457 (real gas) vs 0.482 (cold-air standard, k = 1.40) |

The JSON contains `states`, `ideal_states` (isentropic outlets), `specific` (J/kg),
`performance`, `checks` and `warnings`. With `--t-source/--t-sink` (Rankine) or
`--t-cold/--t-hot` (refrigeration), the script adds the heat-transfer entropy generation
against the reservoirs, so that `T0 * s_gen,total` equals the lost work (Gouy-Stodola);
the test suite verifies this identity.

### Composing other cycles

The functions return plain dictionaries, so variants (reheat, open feedwater heater,
two-stage compression, ORC with another fluid) are built from `state()` in a few lines;
see the reheat example in [references/cycle-models.md](references/cycle-models.md).
Any fluid from `CoolProp.CoolProp.FluidsList()` can be passed with `--fluid`
(e.g. an ORC with `--fluid R245fa`, a propane heat pump with `--fluid R290`).

## Direct API recipes

```python
import CoolProp.CoolProp as CP
from CoolProp.CoolProp import PropsSI, PhaseSI

T_sat = PropsSI("T", "P", 101325, "Q", 0, "Water")         # 373.124 K
h_v = PropsSI("Hmass", "P", 1e5, "Q", 1, "Water")          # 2.67495e6 J/kg
p_evap = PropsSI("P", "T", 263.15, "Q", 1, "R134a")        # 2.006e5 Pa
phase = PhaseSI("P", 3e7, "T", 700, "Water")               # 'supercritical'

# Faster repeated calls (loops, plots): one AbstractState object
AS = CP.AbstractState("HEOS", "R134a")
AS.update(CP.PQ_INPUTS, 5e5, 1.0)
print(AS.T(), AS.hmass(), AS.smass())

# Psychrometrics (moist air, total pressure P)
from CoolProp.HumidAirProp import HAPropsSI
W = HAPropsSI("W", "T", 298.15, "P", 101325, "R", 0.5)     # 9.93e-3 kg/kg dry air
```

Humid-air inputs, outputs and caveats for building and HVAC work are in
[references/psychrometrics.md](references/psychrometrics.md).

## Validation and reporting checklist

- Spot-check one state against an independent source (IAPWS-IF97 steam tables, ASHRAE or
  NIST refrigerant tables): water `T_sat(101325 Pa) = 373.12 K`, `T_sat(10 kPa) = 45.81 C`;
  R134a `p_sat(0 C) = 292.8 kPa`. Reference-state offsets aside, h and s differences agree
  with tables to the table's printed precision.
- Energy closure below 1e-9 relative, all adiabatic `s_gen >= 0`, efficiency below Carnot.
- Ideal (eta = 1) runs have `s_gen = 0` to round-off: a useful regression for exercises.
- Flag turbine exit quality below about 0.88 (a usual design guideline, not a standard) and
  saturated or wet compressor suction.
- Never present a CoolProp value as a measurement; cite the EOS (for example Wagner and
  Pruss 2002 for water, Tillner-Roth and Baehr 1994 for R134a, Lemmon et al. 2000 for air)
  and the CoolProp version.
