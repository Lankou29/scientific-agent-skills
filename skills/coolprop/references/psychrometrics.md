# Humid air with HAPropsSI

`CoolProp.HumidAirProp.HAPropsSI(output, name1, value1, name2, value2, name3, value3)`
implements the real-gas moist-air model of Herrmann, Kretzschmar and Gatley (outcome of ASHRAE
research project RP-1485). The CoolProp 8.0.0 documentation
(<https://coolprop.org/fluid_properties/HumidAir.html>) gives its range as 0.01 kPa to 10 MPa,
-143.15 C to 350 C, and humidity ratio 0 to 10 kg/kg_da. Three inputs are required, one of
which is normally the total pressure `P`. Verified with CoolProp 8.0.0.

## Keys (SI)

| Key | Quantity | Unit |
| --- | --- | --- |
| `T` (`Tdb`) | dry-bulb temperature | K |
| `B` (`Twb`) | wet-bulb temperature | K |
| `D` (`Tdp`) | dew-point temperature | K |
| `P` | total pressure | Pa |
| `P_w` | partial pressure of water vapour | Pa |
| `R` (`RH`) | relative humidity | - (0 to 1, not %) |
| `W` (`Omega`) | humidity ratio | kg water / kg dry air |
| `H` (`Hda`) | mixture enthalpy per kg of **dry** air | J/kg_da |
| `Hha` | mixture enthalpy per kg of humid air | J/kg_ha |
| `V` (`Vda`) | mixture volume per kg of dry air | m3/kg_da |
| `C` (`cp`) | heat capacity per kg of dry air | J/(kg_da K) |

Balances on air-handling units are written per kg of **dry** air (the dry-air mass flow is
conserved), so use `H`, `V`, `W` on a dry-air basis. The enthalpy reference makes
`H = 0` for dry air at 0 C and 101325 Pa.

## Examples (CoolProp 8.0.0 outputs)

```python
from CoolProp.HumidAirProp import HAPropsSI
P = 101325.0

# State at 25 C, 50 % RH
W = HAPropsSI("W", "T", 298.15, "P", P, "R", 0.5)     # 9.926e-3 kg/kg_da
Tdp = HAPropsSI("D", "T", 298.15, "P", P, "R", 0.5)   # 287.02 K (13.87 C)
Twb = HAPropsSI("B", "T", 298.15, "P", P, "R", 0.5)   # 291.03 K (17.88 C)
h = HAPropsSI("H", "T", 298.15, "P", P, "R", 0.5)     # 50.42 kJ/kg_da
v = HAPropsSI("V", "T", 298.15, "P", P, "R", 0.5)     # 0.8578 m3/kg_da

# Cooling and dehumidifying coil: 30 C / 50 % -> saturated at 12 C, then reheat to 20 C
W1 = HAPropsSI("W", "T", 303.15, "P", P, "R", 0.5)    # 0.013373
h1 = HAPropsSI("H", "T", 303.15, "P", P, "R", 0.5)    # 64.36 kJ/kg_da
W2 = HAPropsSI("W", "T", 285.15, "P", P, "R", 1.0)    # 0.008768
h2 = HAPropsSI("H", "T", 285.15, "P", P, "R", 1.0)    # 34.18 kJ/kg_da
q_coil = h1 - h2                                      # 30.17 kJ/kg_da (condensate enthalpy neglected)
m_condensate = W1 - W2                                # 4.61e-3 kg/kg_da
RH3 = HAPropsSI("R", "T", 293.15, "P", P, "W", W2)    # 0.600 after reheat
```

The exact coil balance is `q = h1 - h2 - (W1 - W2) h_w`, where `h_w` is the enthalpy of the
condensate (liquid water at about the coil surface temperature, ~50 kJ/kg at 12 C): the
correction is 0.23 kJ/kg_da here, below 1 %.

## Caveats

- `R` is a fraction: `R = 50` raises `ValueError` ("outside the range of validity: (0) to (1)").
- Altitude matters: use the local total pressure (about 89.9 kPa at 1000 m in the standard
  atmosphere) instead of 101325 Pa.
- Supersaturated states (fog, `W > W_sat`) are outside the model; check `R <= 1`.
- Below 0 C the saturation is over ice; dew point becomes frost point.
- For building-energy calculations, document whether a textbook ideal-gas psychrometric
  formula or this real-gas model is used: the two differ by a fraction of a percent at
  ambient conditions, more at high temperature and pressure.
