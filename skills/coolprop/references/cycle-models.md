# Cycle models, equations and second-law bookkeeping

All quantities are per kilogram of working fluid. Hypotheses common to every model:
steady state, one inlet and one outlet per component, kinetic and potential energy
changes neglected, isobaric heat exchangers (no pressure drop), adiabatic pumps,
compressors and turbines, adiabatic isenthalpic throttling valve.

## Steady-flow balances

For a control volume with one inlet `i` and one outlet `e`:

- Energy: `q - w = h_e - h_i` with q [J/kg] received by the fluid and w [J/kg] delivered
  by the fluid (shaft work).
- Entropy: `s_e - s_i = sum(q_k / T_k) + s_gen`, with `s_gen >= 0`. `T_k` is the temperature
  at the boundary where `q_k` crosses it.
- Adiabatic component: `s_gen = s_e - s_i`.
- Heat exchanger between the fluid and a reservoir at `T_R`: `s_gen = (s_e - s_i) - q / T_R`.

## Isentropic efficiencies

Defined from the isentropic outlet state at the same outlet pressure:

- Turbine: `eta_t = (h_in - h_out) / (h_in - h_out,s)`.
- Pump or compressor: `eta_c = (h_out,s - h_in) / (h_out - h_in)`.

The efficiencies relate actual and ideal enthalpy changes. They are not polytropic
efficiencies; for large pressure ratios the two differ (reheat factor).

## Rankine (subcommand `rankine`)

States: 1 saturated liquid at `p_low`; 2 compressed liquid at `p_high`;
3 turbine inlet at `p_high` (`T3` given, or saturated vapour); 4 turbine outlet at `p_low`.

```
w_pump = h2 - h1          q_in  = h3 - h2
w_turb = h3 - h4          q_out = h4 - h1
w_net  = w_turb - w_pump  eta_th = w_net / q_in      bwr = w_pump / w_turb
eta_Carnot,internal = 1 - T1 / T3
```

The pump work `w_pump ~ v1 (p_high - p_low)` is a useful hand check (3.0 kJ/kg for
water between 10 kPa and 3 MPa). `eta_Carnot,internal` uses the extreme fluid
temperatures; `eta_Carnot,reservoirs = 1 - T_sink / T_source` uses the reservoirs and is
the true upper bound for the plant.

## Vapour compression (subcommand `refrigeration`)

States: 1 compressor inlet (`p_evap`, saturated vapour or `T_evap + superheat`);
2 compressor outlet at `p_cond`; 3 condenser outlet (saturated liquid or
`T_cond - subcooling`); 4 valve outlet, `h4 = h3` at `p_evap`.

```
q_L = h1 - h4   w_c = h2 - h1   q_H = h2 - h3 = q_L + w_c
COP_R = q_L / w_c     COP_HP = q_H / w_c = COP_R + 1
COP_R,Carnot = T_evap / (T_cond - T_evap)        (saturation temperatures)
COP_R,Carnot,reservoirs = T_cold / (T_hot - T_cold)
m_dot = Q_evap / q_L
```

`COP_HP = COP_R + 1` holds only per kilogram of the same cycle; a heat pump designed for
heating is specified by `q_H`. Superheat raises the discharge temperature `T2` (lubricant
limit, often around 120-140 C depending on the compressor, check the manufacturer data).
Transcritical operation (`T_cond >= T_crit`, typical for R744 in summer) is refused by
this subcommand: use `transcritical` below.

## Transcritical CO2 (subcommand `transcritical`)

Above the critical pressure (7.377 MPa for CO2, T_crit = 31.0 C) heat is rejected in a
**gas cooler** without condensation: the fluid temperature falls continuously from `T2`
to `T3`, and the gas-cooler pressure `p_gc` and outlet temperature `T3` are independent.
States: 1 compressor inlet (`p_evap`, saturated vapour or `T_evap + superheat`);
2 compressor outlet at `p_gc > p_crit`; 3 gas-cooler outlet (`p_gc`, `T3`);
4 valve outlet, `h4 = h3` at `p_evap` (must be two-phase).

```
q_L = h1 - h4   w_c = h2 - h1   q_H = h2 - h3
COP_R = q_L / w_c     COP_HP = q_H / w_c
COP_R,bound  = T1 / (T3 - T1)                      (heat absorbed at T <= T1, rejected at T >= T3)
T_m,L = q_L / (s1 - s4)   T_m,H = q_H / (s2 - s3)  (entropic mean temperatures)
COP_R,Lorenz = T_m,L / (T_m,H - T_m,L)
```

Both references are upper bounds of the actual COP: the cycle entropy balance
`(s2 - s3) - (s1 - s4) = s_gen,compressor + s_gen,valve >= 0` gives
`q_H / T_m,H >= q_L / T_m,L`. The Lorenz value is the meaningful one for a gliding
heat rejection; the Carnot bound with the gas-cooler outlet temperature is much looser.

**Optimal high pressure.** Raising `p_gc` increases the compressor work but also lowers
`h3` near the critical region (the isotherms of supercritical CO2 are strongly curved),
which increases `q_L`. The COP therefore has a maximum. With `--p-gc` omitted, the script
scans 200 pressures in `(1.001 p_crit, p_gc_max]` and refines the best bracket by
golden-section search, then warns if the optimum lies on a bound. With a constant
isentropic efficiency the optimum pressure does not depend on `eta_s` (the work is scaled
by `1/eta_s`); a pressure-ratio-dependent efficiency would shift it.

For CO2 the output includes, as a comparison value, the correlation of Liao, Zhao and
Jakobsen (2000), *Applied Thermal Engineering* 20(9), 831-841:

```
p_opt [bar] = (2.778 - 0.0157 t_e) t_gc + (0.381 t_e - 9.34)     (t_e, t_gc in C)
```

Computed with CoolProp 8.0.0, ideal compressor, no superheat (computed values):

| t_e [C] | t_gc [C] | p_opt script [bar] | Liao [bar] | COP_R at optimum |
| --- | --- | --- | --- | --- |
| -10 | 35 | 89.7 | 89.6 | 2.61 |
| -5 | 35 | 88.8 | 88.7 | 3.01 |
| 0 | 40 | 102.2 | 101.8 | 2.79 |
| 5 | 45 | 115.9 | 114.0 | 2.59 |
| -5 | 50 | 135.9 | 131.6 | 1.72 |

Agreement is within 1 bar up to t_gc = 40 C and degrades to about 4.5 bar at 50 C.
Using the correlation pressure instead of the computed optimum costs 0.18 % of COP at
-5 C / 50 C. The curve is asymmetric close to the critical region: at -5 C / 35 C, running
4 bar below the optimum loses 1.7 % of COP, 4 bar above only 0.75 %; at 50 C both sides
are flat (0.16 % and 0.12 %).

Practical points: compressor discharge temperatures are high (about 95 C for the
10 kW heat-pump example), design pressures of 120-140 bar are common for the high side,
and an internal heat exchanger or an ejector/expander (not modelled) is often used to
reduce the throttling loss, which is large for CO2 (`s_gen,valve` comparable to the
compressor's in the examples).

## Brayton (subcommand `brayton`)

Closed air-standard cycle: combustion is replaced by external heat addition and the
exhaust by heat rejection at `p_low`; the composition change caused by combustion is
ignored. States: 1 compressor inlet, 2 compressor outlet at `r p1`, 3 turbine inlet,
4 turbine outlet at `p1`.

```
w_c = h2 - h1   w_t = h3 - h4   w_net = w_t - w_c
q_reg = eps * min(h(p2, T4) - h2, h4 - h(p1, T2))   (0 if T4 <= T2)
q_in = h3 - h2 - q_reg     eta_th = w_net / q_in
eta_cold-air,ideal = 1 - r^(-(k-1)/k)   (k = cp0/cv0 at state 1, comparison only)
```

The real-gas ideal efficiency (0.457 for r = 10, 300 K/1400 K) is below the cold-air value
(0.482) because cp of air increases with temperature. With component losses the
back-work ratio is large (0.4-0.6): a few points of compressor efficiency change the net
work strongly.

## Gouy-Stodola check

With reservoirs at `T_source` (or `T_cold`) and `T_sink` (or `T_hot`) and the environment at
`T0 = T_sink` (Rankine) or `T0 = T_hot` (refrigeration):

- Rankine: `W_rev - w_net = T_sink * s_gen,total`, with `W_rev = q_in (1 - T_sink/T_source)`.
- Refrigeration: `w_c - W_min = T_hot * s_gen,total`, with `W_min = q_L (T_hot/T_cold - 1)`.

These identities follow from the cycle energy and entropy balances; the tests verify them
numerically for the bundled models. The component `s_gen` values give the exergy
destruction `T0 s_gen` per component, which ranks the improvement potential.

## Composing a variant: Rankine with reheat

```python
import sys
sys.path.insert(0, "skills/coolprop/scripts")
from thermo_cycles import state

f, eta_t, eta_p = "Water", 0.85, 1.0
p_hi, p_rh, p_lo, T_max = 80e5, 8e5, 10e3, 773.15


def expand(s_in, p_out, eta):
    """Adiabatic turbine stage with isentropic efficiency eta."""
    h_s = state(f, "P", p_out, "Smass", s_in["s_J_per_kgK"])["h_J_per_kg"]
    return s_in["h_J_per_kg"] - eta * (s_in["h_J_per_kg"] - h_s)


s1 = state(f, "P", p_lo, "Q", 0, "1")
h2s = state(f, "P", p_hi, "Smass", s1["s_J_per_kgK"])["h_J_per_kg"]
h2 = s1["h_J_per_kg"] + (h2s - s1["h_J_per_kg"]) / eta_p
s3 = state(f, "P", p_hi, "T", T_max, "3")
h4 = expand(s3, p_rh, eta_t)
s5 = state(f, "P", p_rh, "T", T_max, "5")
s6 = state(f, "P", p_lo, "Hmass", expand(s5, p_lo, eta_t), "6")
w_net = (s3["h_J_per_kg"] - h4) + (s5["h_J_per_kg"] - s6["h_J_per_kg"]) - (h2 - s1["h_J_per_kg"])
q_in = (s3["h_J_per_kg"] - h2) + (s5["h_J_per_kg"] - h4)
print(f"eta_th = {w_net / q_in:.4f}, x6 = {s6['quality']}, T6 = {s6['T_K']:.1f} K ({s6['phase']})")
```

Run from the collection root. This illustrative case (ideal pump, eta_t = 0.85 for both
stages, 8 MPa / 500 C, reheat at 0.8 MPa to 500 C, condenser 10 kPa) prints
`eta_th = 0.3539, x6 = None, T6 = 349.6 K (gas)` with CoolProp 8.0.0: the turbine exhaust
is slightly superheated, so the quality is `None` and the condenser also removes some
superheat. Close each composed cycle with the same checks as the bundled models: energy closure,
`s_gen >= 0` per adiabatic component, and the Carnot bound.
