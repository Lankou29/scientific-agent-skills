# Fluids, backends, reference states and validity

Verified with CoolProp 8.0.0. Values below are CoolProp outputs, not measurements.

## Naming fluids

- `CoolProp.CoolProp.FluidsList()` lists the 136 fluids of the HEOS library in 8.0.0.
- Names and aliases are accepted: `Water`, `R134a`, `R1234yf`, `R1234ze(E)`, `R290` (propane),
  `R600a` (isobutane), `R717`/`Ammonia`, `R744`/`CarbonDioxide`, `R32`, `R245fa`, `Air`,
  `Nitrogen`, `Hydrogen`, `Methane`.
- Canonical name and metadata: `get_fluid_param_string(fluid, key)` with keys `name`,
  `aliases`, `CAS`, `pure` (`"true"`/`"false"`), `BibTeX-EOS`, `BibTeX-CONDUCTIVITY`,
  `BibTeX-VISCOSITY`.
- An unknown name raises `ValueError` (`key [...] was not found in string_to_index_map`).

| Fluid | EOS reference key | T_crit [K] | p_crit [MPa] | T range [K] | p_max [MPa] |
| --- | --- | --- | --- | --- | --- |
| Water | Wagner-JPCRD-2002 (IAPWS-95) | 647.096 | 22.064 | 273.16-2000 | 1000 |
| R134a | TillnerRoth-JPCRD-1994 | 374.21 | 4.059 | 169.85-455 | 70 |
| R1234yf | Lemmon-IJT-2022 | 367.85 | 3.384 | 121.6-410 | 100 |
| R290 | Lemmon-JCED-2009 | 369.89 | 4.251 | 85.53-650 | 1000 |
| R744 | Span-JPCRD-1996 | 304.13 | 7.377 | 216.59-2000 | 800 |
| R32 | TillnerRoth-JPCRD-1997 | 351.26 | 5.783 | 136.34-435 | 70 |
| Air (pseudo-pure) | Lemmon-JPCRD-2000 | 132.53 | 3.786 | 59.75-2000 | 2000 |

Query the limits rather than copying this table: `PropsSI("Tmin", fluid)`, `"Tmax"`,
`"pmax"`, `"Tcrit"`, `"pcrit"`, `"Ttriple"`.

## Backends

| Backend string | Use |
| --- | --- |
| `HEOS::Water` (default) | Helmholtz-energy reference EOS. Most accurate, slowest. |
| `BICUBIC&HEOS::R134a`, `TTSE&HEOS::...` | Tabulated interpolation of HEOS; much faster in loops. Tables are built on first call (seconds) and cached in `~/.CoolProp`. Check a few points against HEOS. |
| `INCOMP::MEG[0.3]` | Incompressible liquids and secondary coolants (here 30 % mass monoethylene glycol). Only (T, P) inputs, liquid phase. |
| `IF97::Water` | IAPWS-IF97 industrial formulation, to reproduce printed industrial steam tables. |
| `REFPROP::R134a` | NIST REFPROP, requires a licensed installation. Not tested here. |
| `PR::`, `SRK::` | Cubic equations of state, for mixtures without a reference model. Lower accuracy. |

## Reference states

Absolute h and s depend on a conventional zero. Defaults in CoolProp 8.0.0:

| Fluid family | Default reference | Check |
| --- | --- | --- |
| Water | IAPWS-95: u = 0 and s = 0 for saturated liquid at the triple point | `h(273.16 K, Q=0) = 0.61 J/kg`, `s = 0` |
| Refrigerants | IIR: h = 200 kJ/kg, s = 1 kJ/(kg K), saturated liquid at 0 C | `h(273.15 K, Q=0, R134a) = 200000 J/kg` |
| Air | Lemmon 2000 reference | `h(300 K, 1 atm) = 426.3 kJ/kg` (not the 300.2 kJ/kg of ideal-gas air tables) |

Some textbook tables use ASHRAE (h = s = 0 for saturated liquid at -40 C) for refrigerants or
h = 0 at 0 K or 298 K for air. Differences `h2 - h1` agree; absolute values do not. To match
a table, change the reference with `CP.set_reference_state(fluid, "ASHRAE")`, `"IIR"`,
`"NBP"` or `"DEF"`, and reset it afterwards: the setting is global for the process.

## Input pairs and phase

- Valid pairs include `(T,P)`, `(P,Q)`, `(T,Q)`, `(P,H)`, `(P,S)`, `(H,S)`, `(D,T)`, `(D,P)`.
- `(T,P)` cannot fix a two-phase state: on the saturation line the result is one of the
  saturated phases, arbitrarily. Use `Q` for saturated states.
- `Q` is returned as `-1` for single-phase states (subcooled, superheated, supercritical).
- `PhaseSI` returns strings such as `liquid`, `gas`, `twophase`, `supercritical`,
  `supercritical_gas`, `supercritical_liquid`. Air at ambient conditions is
  `supercritical_gas` because it is far above its critical temperature.
- Near the critical point (within about 0.05 % of T_crit) iterations can fail or be slow;
  the bundled dome stops at 0.9995 T_crit.

## Silent extrapolation

CoolProp does not stop at the validity limits:

```python
PropsSI("Hmass", "P", 1e5, "T", 5000, "Water")   # returns a value, but Tmax = 2000 K
```

Always compare the state with `Tmin <= T <= Tmax` and `p <= pmax`. The bundled
`thermo_cycles.state()` raises `CycleError` outside this box. Extrapolated values may look
plausible and must never be reported as reference data.

## Blends and glide

`R410A`, `R407C`, `R404A`, `R507A` are pseudo-pure fluid models (`pure == "false"`).
They reproduce dew and bubble lines but not composition shift. For R407C at 0 C, CoolProp
gives a dew pressure of 460.7 kPa and a bubble pressure of 567.9 kPa: a glide of several kelvin.
The bundled refrigeration model takes the evaporator pressure from the dew point at
`t_evap` and the condenser pressure from the bubble point at `t_cond`; other conventions
(mean temperature, mid-point) give different pressures and COP, so state the convention.

## Transport properties

`PropsSI("V", ...)` dynamic viscosity [Pa s], `"L"` thermal conductivity [W/(m K)],
`"Prandtl"` [-], `"C"` or `"Cpmass"` isobaric heat capacity [J/(kg K)]. For water at
300 K and 1 bar: mu = 8.54e-4 Pa s, lambda = 0.609 W/(m K), Pr = 5.86. Transport
correlations have their own validity ranges and references (`BibTeX-VISCOSITY`,
`BibTeX-CONDUCTIVITY`); some fluids have no transport model and raise an error.
