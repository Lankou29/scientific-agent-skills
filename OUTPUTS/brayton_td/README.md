# TD : cycles de turbine à gaz (Brayton)

Ce TD accompagne le cours `../brayton_cours/`. Durée indicative : 4 h, dont 1 h sur ordinateur.

| Fichier | Rôle |
| --- | --- |
| `TD_Turbines_a_Gaz_Enonce.docx` / `.pdf` | Sujet étudiant : 5 exercices progressifs et un formulaire (3 pages) |
| `TD_Turbines_a_Gaz_Corrige.docx` / `.pdf` | Corrigé enseignant (12 pages). Chaque exercice comprend : D. raisonnement, E. résultats, F. vérifications, G. erreurs fréquentes |
| `calc/td_calc.py` | Calcul de toutes les valeurs et vérifications automatiques |
| `calc/td_results.json` | Valeurs numériques reprises dans le corrigé |
| `build_td.js` | Génération des deux fichiers Word (bibliothèque docx) |
| `figures/` | Figures du corrigé (diagramme T–s, régénération) |

## Exercices

1. Cycle idéal en air standard froid, avec le rapport de pression optimal r_opt.
2. Cycle réel de 30 MW : débit d'air, débit de combustible, consommation spécifique, sensibilité à η_c.
3. Même cycle avec l'air réel calculé par CoolProp, sur ordinateur.
4. Régénération et rapport de pression limite (équation du second degré).
5. Bilans d'entropie et d'exergie, avec vérification de la fermeture du bilan.

## Régénérer

```bash
pip install CoolProp matplotlib numpy     # testé : CoolProp 8.0.0, Python 3.13
python calc/td_calc.py                    # imprime [OK] si les vérifications passent
node build_td.js                          # nécessite le paquet npm « docx »
```

Le sommaire du corrigé est un champ Word. Word propose de le mettre à jour à l'ouverture ; acceptez, ou faites F9.
