# Conseil LLM : structure et progression d'un cours de thermodynamique pour ingénieurs

Date : 2026-10-25. Méthode : skill `llm-council` (5 conseillers, 5 relectures anonymes, synthèse).
Remarque : la synthèse du président a été rédigée par l'agent principal, pas par un sous-agent séparé. Les relecteurs ont travaillé sur des résumés fidèles des cinq réponses.

## Question de départ
« council this cours de thermodynamique ingénieur ». Précision demandée : la décision porte sur la **structure et la progression**.

## Question cadrée (les hypothèses n'ont PAS été confirmées par l'enseignant)
- Public : 1re année du cycle ingénieur (Bac+3), venant de CPGE, de BUT et de licence.
- Volume : environ 24 h de CM, 24 h de TD et 12 h de TP sur un semestre.
- Débouchés visés : énergétique, bâtiment, moteurs, mobilité.
- Options comparées : (A) progression axiomatique classique ; (B) progression partant des applications ; (C) hybride, un squelette axiomatique parcouru par un fil rouge applicatif.
- Questions annexes : quand aborder les systèmes ouverts (tôt ou tard) ; exergie intégrée au fil du cours ou en chapitre final ; place des outils numériques ; articulation CM/TD/TP.

## Réponses des conseillers
### Contradicteur
Le défaut fatal est de croire que la séquence est la vraie décision. Les lacunes viennent de formules appliquées sans faire de bilan. L'option C, choix de consensus, est la plus dangereuse : le fil rouge risque de s'essouffler et de devenir un décor. L'option B ne convient pas à un public hétérogène. Aborder les systèmes ouverts tard est une faute : il faut les traiter en semaine 2 ou 3. Une exergie en chapitre final sera sacrifiée. Introduire CoolProp trop tôt court-circuite la lecture des diagrammes. Il manque un diagnostic d'entrée et une évaluation alignée sur la méthode de bilan.

### Penseur des premiers principes
La question est mal posée : le problème tient à trois ou quatre ruptures conceptuelles, pas à l'ordre des chapitres. Il propose une méthode unique en quatre gestes : (1) tracer la frontière, (2) dire ce qui la traverse, (3) écrire les bilans de masse, d'énergie et d'entropie, (4) fermer le problème par une loi d'état. Les systèmes ouverts sont le cas général ; le système fermé n'est que le cas d'un débit nul. Le 2e principe se présente comme un bilan avec un terme de production S_gen ≥ 0, et l'exergie détruite vaut T0·S_gen, ce qui l'intègre naturellement au cours. Les cycles deviennent des exercices plutôt que des chapitres. Critère de réussite : l'étudiant applique seul les quatre gestes.

### Expansionniste
Il retient l'option C dans une version ambitieuse : un fil rouge « système » (bâtiment avec PAC, ou véhicule électrique) repris pendant plusieurs années, comme un jumeau numérique du cursus. Les systèmes ouverts arrivent en semaine 3 et l'exergie dès le 2e principe, présentée comme la « monnaie » des pertes (kWh, €, CO2). Python et CoolProp sont utilisés dès le départ. Les TP comparent mesure et modèle. Il propose un projet de dimensionnement d'une PAC sur un bâtiment du campus, une ressource réutilisable et des binômes mixtes.

### Outsider (point de vue étudiant)
La progression axiomatique (A) fait réciter des cycles sans compréhension ; la progression par les applications (B) brouille la frontière entre loi générale et recette. Il retient C si le fil rouge pose des énigmes, par exemple : « la PAC consomme 1 kW et en fournit 3 : arnaque ? ». La convention de signe doit être dite une fois et tenue partout. L'enthalpie h ne prend son sens qu'en système ouvert. L'entropie doit répondre à la question « pourquoi le COP ne vaut pas 50 ». Il faut tracer un cycle à la main avant d'utiliser CoolProp, prévoir un test diagnostic et des fiches de remise à niveau, et des TP liés au fil rouge. Pour chaque notion, une phrase « à quoi ça sert pour la PAC ».

### Exécutant
Il retient C dans une version minimale : le squelette de A avec une PAC air/eau comme fil rouge. Concrètement : test diagnostic de 30 min et groupes de TD de niveau ; une seule convention de signe, rappelée en page 1 de chaque document ; systèmes ouverts en semaine 3 ; exergie en chapitre final de 2 CM, préparée à chaque TD par le calcul de S_gen ; diagramme log p-h sur papier, puis CoolProp avec un notebook pré-rempli ; TP de 4 × 3 h, sur banc PAC ou avec des données fournies, sinon fil rouge moteur ou cycle vapeur. Il faut confirmer les heures et le matériel disponibles.

## Relectures anonymes
Correspondance des lettres : A = Expansionniste, B = Contradicteur, C = Exécutant, D = Premiers principes, E = Outsider.

| Relecteur | Réponse la plus forte | Plus grand angle mort |
|---|---|---|
| 1 | C | A |
| 2 | C | A (et D n'a pas de calendrier) |
| 3 | C | A |
| 4 | D (C la plus applicable) | A |
| 5 | C | A |

Points que tous les conseillers ont manqués, selon les relecteurs :
- la charge enseignante et la coordination entre intervenants ;
- l'articulation avec les UE voisines (mécanique des fluides, transferts, mathématiques) ;
- les prérequis en dérivées partielles ;
- la mesure de l'efficacité du cours (pré-test et post-test sur les conceptions erronées) ;
- l'évaluation sommative concrète ;
- le calendrier des TP par rapport au CM ;
- **l'air humide**, indispensable pour le bâtiment et la CVC ;
- la couverture des moteurs et de la mobilité ;
- le travail personnel et l'usage de l'IA par les étudiants.

## Synthèse du président
Voir le rapport HTML (même contenu).

Recommandation : option C avec la méthode des bilans en 4 gestes comme squelette ; PAC air/eau comme fil rouge ; systèmes ouverts en semaine 3 ; S_gen et Ex_d = T0*S_gen calculés à chaque TD dès le 2e principe ; diagrammes tracés à la main avant CoolProp ; cycles moteurs en semaine 8 et air humide en semaine 11. Première action : confirmer les heures, le banc PAC et les UE amont et aval.
