# Cours : cycles de turbine à gaz (Brayton)

Niveau : L3 / M1 / école d'ingénieurs. 18 diapositives, avec des notes du présentateur (dont le corrigé de l'exercice).

| Fichier | Rôle |
| --- | --- |
| `Cours_Turbines_a_Gaz_Brayton.pptx` | Diaporama modifiable (16:9) |
| `Cours_Turbines_a_Gaz_Brayton.pdf` | Rendu PDF (LibreOffice) |
| `calc/brayton.py` | Modèle (air froid et CoolProp « Air »), exemples, 9 vérifications automatiques |
| `calc/results.json` | Toutes les valeurs numériques reprises dans les diapositives |
| `calc/figures.py`, `calc/equations.py` | Figures et équations (PNG) |
| `build_deck.js` | Construction du PPTX (PptxGenJS 4.0.1) à partir de `results.json` |

## Régénérer

```bash
pip install CoolProp matplotlib numpy pillow      # testé avec CoolProp 8.0.0, Python 3.13
cd calc && python brayton.py && python figures.py && python equations.py
python -c "from PIL import Image;import glob,json;print(json.dumps({p.split('/')[-1][:-4]:Image.open(p).size for p in glob.glob('../figures/eq/*.png')+glob.glob('../figures/*.png')}))" > ../figures/sizes.json
cd .. && npm i pptxgenjs@4.0.1 && node build_deck.js
```

## Vérifications effectuées (par calcul, pas expérimentales)

1. La formule fermée du rendement idéal coïncide avec le calcul pas à pas.
2. Premier principe : w_net = q_in − q_out pour tous les cycles.
3. Le cycle idéal CoolProp est bien isentropique.
4. Second principe : s_gen > 0 dans le compresseur et la turbine réels.
5. Le bilan d'exergie est fermé (résidu ≈ 1e−10 J/kg).
6. Le rendement reste inférieur à celui de Carnot.
7. L'écart entre air froid et CoolProp est inférieur à 6 %.
8. La régénération est autorisée seulement si T₄ > T₂.
9. L'exemple du manuel Çengel & Boles est retrouvé (r = 8 ; η = 0,426 / 0,266 ; bwr = 0,403 / 0,592). Les valeurs du manuel sont citées de mémoire : il faut les contrôler dans l'édition utilisée.

## Limites du modèle

Le modèle « air standard » néglige :

- la composition des gaz brûlés et le débit de combustible ;
- les pertes de charge ;
- le refroidissement des aubes ;
- la destruction d'exergie dans la combustion.
