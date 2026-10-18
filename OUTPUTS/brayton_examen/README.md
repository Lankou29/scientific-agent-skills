# Examen : cycles de turbine à gaz

Épreuve de 2 h, notée sur 20. Calculatrice autorisée, documents interdits, formulaire fourni en annexe. Le sujet n'utilise que le modèle air standard froid, donc il se traite sans ordinateur.

| Fichier | Destinataire | Contenu |
| --- | --- | --- |
| `Examen_Turbines_a_Gaz_Sujet.docx` / `.pdf` | étudiants | Partie A : 4 questions de cours. Partie B : problème de cogénération de 5 MW. Formulaire (2 pages) |
| `Examen_Turbines_a_Gaz_Bareme.docx` / `.pdf` | enseignant | Règles de notation et grille détaillée par élément attendu (2 pages) |
| `Examen_Turbines_a_Gaz_Corrige.docx` / `.pdf` | enseignant | Corrigé détaillé avec les points par question, plus un récapitulatif (3 pages) |
| `calc/exam_calc.py` | | Calculs et vérifications automatiques |
| `calc/exam_results.json` | | Valeurs reprises dans les documents |
| `build_exam.js` | | Génération des trois documents |

## Cohérence

- Le barème est défini une seule fois dans `build_exam.js`. La génération s'arrête si la somme des éléments d'une question diffère de ses points, ou si le total diffère de 20.
- Les valeurs CoolProp citées dans la question B6 sont calculées par `brayton.py`, le module du cours.

## Régénérer

```bash
python calc/exam_calc.py && node build_exam.js
```
