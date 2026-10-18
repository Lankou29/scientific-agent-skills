// Génère le sujet, le barème et le corrigé de l'examen « Cycles de turbine à gaz » (docx-js).
// Mise en forme reprise du TD ; toutes les valeurs sont lues dans calc/exam_results.json.
// Exécution : node build_exam.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, BorderStyle, ImageRun, Header, Footer, PageNumber, LevelFormat,
  PageBreak, TableOfContents,
} = require("docx");

const D = __dirname;
const R = JSON.parse(fs.readFileSync(path.join(D, "calc/exam_results.json"), "utf8"));
const I = R.ideal, X = R.reel, M = R.debits, G = R.regen, S = R.entropie, CP = R.coolprop;

const NAVY = "1B3A5C", ORANGE = "E07A1F", TEAL = "2A9D8F", LIGHT = "EEF2F6";
const W = 9638; // largeur utile A4 avec marges de 2 cm (DXA)

// ------------------------------------------------------------- formatage
const f = (x, n = 1) => x.toFixed(n).replace(".", ",").replace("-", "−");
const kJ = (x, n = 1) => f(x / 1e3, n);
const pc = (x, n = 2) => f(x * 100, n) + " %";

// Mini-balisage : _x ou _{...} -> indice ; ^x ou ^{...} -> exposant ; **...** -> gras
function runs(text, base = {}) {
  const out = [];
  let i = 0, buf = "";
  const flush = (o = {}) => { if (buf) { out.push(new TextRun({ text: buf, ...base, ...o })); buf = ""; } };
  while (i < text.length) {
    const c = text[i];
    if (c === "*" && text[i + 1] === "*") {
      flush();
      const j = text.indexOf("**", i + 2);
      out.push(...runs(text.slice(i + 2, j), { ...base, bold: true }));
      i = j + 2;
    } else if ((c === "_" || c === "^") && i + 1 < text.length && text[i + 1] !== " ") {
      flush();
      let s;
      if (text[i + 1] === "{") { const j = text.indexOf("}", i); s = text.slice(i + 2, j); i = j + 1; }
      else { s = text[i + 1]; i += 2; }
      out.push(new TextRun({ text: s, ...base, ...(c === "_" ? { subScript: true } : { superScript: true }) }));
    } else { buf += c; i += 1; }
  }
  flush();
  return out;
}

const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run || {}), spacing: { after: 100, line: 276 }, alignment: o.align || AlignmentType.JUSTIFIED, ...(o.p || {}) });
const EQ = (t) => new Paragraph({ children: runs(t, { font: "Cambria Math" }), alignment: AlignmentType.CENTER, spacing: { before: 60, after: 100 } });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(t), spacing: { before: 300, after: 150 } });
const H1b = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: runs(t), spacing: { before: 0, after: 150 } });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs(t), spacing: { before: 220, after: 100 } });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(t), spacing: { before: 160, after: 80 } });
const BUL = (t) => new Paragraph({ numbering: { reference: "puces", level: 0 }, children: runs(t), spacing: { after: 60 } });
const Q = (num, t) => new Paragraph({ children: [new TextRun({ text: `${num}. `, bold: true, color: NAVY }), ...runs(t)], indent: { left: 360, hanging: 360 }, spacing: { after: 90 } });
const BREAK = () => new Paragraph({ children: [new PageBreak()] });
const CODE = (lines) => lines.map((l) => new Paragraph({
  children: [new TextRun({ text: l || " ", font: "Consolas", size: 18 })],
  shading: { type: ShadingType.CLEAR, color: "auto", fill: "F4F6F8" }, spacing: { after: 0 },
}));

function BOX(lines, color = ORANGE) {
  const border = { style: BorderStyle.SINGLE, size: 8, color };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT }, margins: { top: 100, bottom: 100, left: 150, right: 150 },
      children: lines.map((t) => new Paragraph({ children: runs(t), spacing: { after: 60 } })),
    })] })],
  });
}

function TABLE(rows, widths, gauche = [0]) {
  const tot = widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C8D1DA" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: tot, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((c, j) => new TableCell({
        width: { size: widths[j], type: WidthType.DXA }, borders,
        shading: { type: ShadingType.CLEAR, color: "auto", fill: i === 0 ? NAVY : (i % 2 ? "FFFFFF" : LIGHT) },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ alignment: gauche.includes(j) ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: runs(String(c), i === 0 ? { bold: true, color: "FFFFFF", size: 20 } : { size: 20 }) })],
      })),
    })),
  });
}

function FIG(file, wpx, caption) {
  const buf = fs.readFileSync(path.join(D, "figures", file));
  const w0 = buf.readUInt32BE(16), h0 = buf.readUInt32BE(20); // en-tête PNG
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: buf,
      transformation: { width: wpx, height: Math.round(wpx * h0 / w0) },
      altText: { title: caption, description: caption, name: file } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: runs(caption, { italics: true, size: 18, color: "5B6B7B" }) }),
  ];
}
const SP = () => new Paragraph({ children: [], spacing: { after: 60 } });

function makeDoc(titre, children) {
  return new Document({
    creator: "Examen Thermodynamique appliquée", features: { updateFields: true }, title: titre, description: titre,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { size: 44, bold: true, color: NAVY }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: NAVY }, paragraph: { outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: ORANGE }, paragraph: { outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: TEAL }, paragraph: { outlineLevel: 2 } },
      ],
    },
    numbering: { config: [{ reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: titre, size: 16, color: "5B6B7B" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: "5B6B7B" })] })] }) },
      children,
    }],
  });
}


// ======================================================================
//                         BARÈME (source unique)
// ======================================================================
// Chaque question : [id, points, [[élément attendu, points], ...]]
const BAREME = [
  ["A1", 1, [["Définition de bwr = w_c/w_t et ordre de grandeur (≈ 0,4–0,6 contre ≈ 0,01 en Rankine)", 0.5], ["Conséquence : forte sensibilité de w_{net} aux rendements des turbomachines", 0.5]]],
  ["A2", 1, [["Chaleur reçue à température variable (T_2 → T_3) et rejetée de T_4 à T_1", 0.5], ["Températures moyennes d'échange : T_{m,in} < T_3 et T_{m,out} > T_1, d'où η < 1 − T_1/T_3", 0.5]]],
  ["A3", 1, [["Condition T_4 > T_2", 0.5], ["Quand r augmente, T_2 augmente et T_4 diminue : l'écart, donc le gain, se réduit jusqu'à s'annuler", 0.5]]],
  ["A4", 1, [["Cycle idéal : η = 1 − r^{−(γ−1)/γ} croissant", 0.25], ["Cycle réel : w_{net} → 0 quand r augmente (w_c croît plus vite que w_t), alors que q_{in} diminue aussi", 0.5], ["Conclusion : existence d'un maximum de η (puis de w_{net} à r plus faible)", 0.25]]],
  ["B1", 3, [["τ, T_{2s} et T_{4s} (formule + AN + unité)", 1], ["w_{c,s}, w_{t,s}, w_{net,s}", 1], ["η idéal par le bilan ET par 1 − 1/τ, concordance", 1]]],
  ["B2", 4, [["T_2 avec η_c correctement appliqué", 0.75], ["T_4 avec η_t correctement appliqué", 0.75], ["w_c, w_t, w_{net}", 1], ["q_{in} et η_{th}", 1], ["bwr et commentaire (comparaison avec B1)", 0.5]]],
  ["B3", 2, [["ṁ_a = P_{net}/w_{net}", 0.75], ["ṁ_f par le bilan de la chambre (ṁ_f PCI = ṁ_a q_{in})", 0.75], ["f = ṁ_f/ṁ_a et justification de l'hypothèse", 0.5]]],
  ["B4", 3.5, [["Vérification T_4 > T_2", 0.5], ["T_x par la définition de ε", 0.75], ["T_y par le bilan du régénérateur", 0.5], ["q_{in} et η du cycle régénératif ; w_{net} inchangé", 0.75], ["Économie relative de combustible et tonnage annuel", 1]]],
  ["B5", 2.5, [["s_2 − s_1 (deux termes, signe correct)", 0.75], ["s_4 − s_3 (deux termes, signe correct)", 0.75], ["E_{d,c} et E_{d,t}", 0.5], ["Comparaison argumentée (turbine > compresseur)", 0.5]]],
  ["B6", 1, [["Sens des écarts : η surestimé, w_{net} et q_{in} sous-estimés par l'air froid", 0.5], ["Explication : c_p croît avec T (et γ décroît), surtout dans la chambre et la turbine", 0.5]]],
];
const pts = (x) => f(x, x % 1 ? (x * 4 % 2 ? 2 : 1) : 0) + (x > 1 ? " pts" : " pt");
const PTS = Object.fromEntries(BAREME.map(([id, p]) => [id, p]));
const TOTAL = BAREME.reduce((s, [, p, items]) => {
  const sub = items.reduce((a, [, x]) => a + x, 0);
  if (Math.abs(sub - p) > 1e-9) throw new Error(`barème incohérent : sous-total ${sub} pour ${p} points`);
  return s + p;
}, 0);
if (TOTAL !== 20) throw new Error("le total du barème doit valoir 20, trouvé " + TOTAL);

const QP = (id, t) => new Paragraph({
  children: [new TextRun({ text: `${id}. `, bold: true, color: NAVY }), ...runs(t), new TextRun({ text: `  (${pts(PTS[id])})`, bold: true, color: ORANGE })],
  indent: { left: 440, hanging: 440 }, spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED,
});
const HQ = (id, t) => H3(`${id} — ${t}  [${pts(PTS[id])}]`);

// ======================================================================
//                                SUJET
// ======================================================================
const SUJET = [];
const su = (...x) => SUJET.push(...x);
su(new Paragraph({ heading: HeadingLevel.TITLE, children: runs("Examen — Thermodynamique appliquée") }),
  P("**Cycles de turbine à gaz** — Licence 3 / Master 1 / école d'ingénieurs", { align: AlignmentType.LEFT }),
  TABLE([
    ["Durée", "Documents", "Calculatrice", "Notation"],
    ["2 h", "interdits (formulaire en annexe)", "autorisée, mode examen", "sur 20 points"],
  ], [1800, 3200, 2600, 2038]),
  SP(),
  P("Nom : ……………………………………  Prénom : ……………………………  N° étudiant : ………………", { align: AlignmentType.LEFT }),
  BOX([
    "**Consignes.** Toute réponse numérique doit être précédée de l'expression littérale et suivie de son unité. Les résultats non justifiés ne rapportent pas de points. Une erreur numérique reportée dans une question ultérieure n'est pas pénalisée si la démarche est correcte. Les deux parties sont indépendantes ; dans la partie B, les questions B4, B5 et B6 peuvent être traitées à partir des résultats de B2, même approximatifs.",
  ], NAVY),
  H1("Partie A — Questions de cours (4 points)"),
  P("Répondre en quelques lignes ; un schéma ou un diagramme (T, s) peut remplacer une partie du texte."),
  QP("A1", "Définir le « back work ratio » (bwr) d'un cycle moteur. Pourquoi est-il beaucoup plus élevé dans une turbine à gaz que dans une centrale à vapeur (cycle de Rankine) ? Quelle conséquence pratique en résulte ?"),
  QP("A2", "Le cycle de Brayton idéal est réversible. Pourquoi son rendement est-il néanmoins inférieur au rendement de Carnot fonctionnant entre les mêmes températures extrêmes T_1 et T_3 ?"),
  QP("A3", "À quelle condition la régénération est-elle possible dans une turbine à gaz ? Pourquoi son intérêt diminue-t-il lorsque le rapport de pression augmente ?"),
  QP("A4", "Le rendement du cycle de Brayton idéal croît indéfiniment avec le rapport de pression r. Expliquer pourquoi, pour un cycle réel (rendements isentropiques inférieurs à 1), le rendement présente un maximum."),
  H1("Partie B — Problème : turbine à gaz de cogénération (16 points)"),
  P("Un site industriel envisage l'installation d'une turbine à gaz de 5 MW électriques fonctionnant au gaz naturel. L'étude préliminaire est menée avec le modèle **air standard froid**."),
  H2("Données"),
  TABLE([
    ["Grandeur", "Valeur"],
    ["Air aspiré : T_1 ; p_1", "15 °C ; 101,3 kPa"],
    ["Rapport de pression r = p_2/p_1", "10"],
    ["Température d'entrée turbine T_3", "1300 K"],
    ["Rendements isentropiques η_c ; η_t", "0,86 ; 0,88"],
    ["Puissance nette P_{net}", "5,0 MW"],
    ["Pouvoir calorifique inférieur du combustible PCI", "48,0 MJ/kg"],
    ["Air : c_p ; γ ; r_{air} = c_p(γ − 1)/γ", "1,005 kJ/(kg·K) ; 1,4 ; 287,1 J/(kg·K)"],
    ["Température de l'environnement T_0", "= T_1"],
  ], [5600, 4038]),
  SP(),
  P("Hypothèses : régime permanent ; énergies cinétique et potentielle négligées ; compresseur et turbine adiabatiques ; pas de pertes de charge ; combustion modélisée par un apport de chaleur isobare, complète ; débit de combustible négligé dans les bilans de l'air (sauf B3)."),
  H2("Questions"),
  QP("B1", "**Cycle idéal.** Calculer T_{2s} et T_{4s}, les travaux massiques isentropiques w_{c,s} et w_{t,s}, le travail net et le rendement du cycle idéal. Vérifier ce rendement par une formule ne dépendant que de r."),
  QP("B2", "**Cycle réel.** Calculer T_2 et T_4, puis w_c, w_t, w_{net}, q_{in}, le rendement thermique η_{th} et le bwr. Comparer au cycle idéal et commenter."),
  QP("B3", "**Débits.** Calculer le débit d'air ṁ_a nécessaire pour 5,0 MW, le débit de combustible ṁ_f et le rapport f = ṁ_f/ṁ_a. L'hypothèse de débit de combustible négligé est-elle justifiée ?"),
  QP("B4", "**Régénération.** On ajoute un régénérateur d'efficacité ε = (T_x − T_2)/(T_4 − T_2) = 0,75 (x : air sortant du régénérateur vers la chambre ; y : gaz sortant vers la cheminée). Vérifier que la régénération est possible, calculer T_x, T_y, le nouveau q_{in} et le rendement. Pour la même puissance nette, calculer l'économie relative de combustible et la masse de combustible économisée par an pour 6000 h de fonctionnement."),
  QP("B5", "**Irréversibilités.** Pour le cycle réel de B2, calculer l'entropie créée par unité de masse dans le compresseur et dans la turbine, puis les exergies détruites correspondantes (T_0 = T_1). Quelle machine détruit le plus d'exergie ? Expliquer pourquoi, alors que η_t > η_c."),
  QP("B6", `**Critique du modèle.** Un calcul du même cycle réel avec les propriétés de l'air réel (bibliothèque CoolProp, c_p variable) donne : T_2 = ${f(CP.T2)} K ; T_4 = ${f(CP.T4)} K ; w_{net} = ${kJ(CP.wnet)} kJ/kg ; q_{in} = ${kJ(CP.qin)} kJ/kg ; η_{th} = ${pc(CP.eta, 1)}. Comparer à vos résultats de B2 et expliquer l'origine des écarts.`),
  H1("Annexe — Formulaire"),
  EQ("Système ouvert, régime permanent :  q − w = h_s − h_e        gaz parfait : Δh = c_p ΔT"),
  EQ("Δs = c_p ln(T_s/T_e) − r_{air} ln(p_s/p_e)        isentropique : T_{2s}/T_1 = (p_2/p_1)^{(γ−1)/γ}"),
  EQ("η_c = (h_{2s} − h_1)/(h_2 − h_1)        η_t = (h_3 − h_4)/(h_3 − h_{4s})"),
  EQ("Exergie détruite : E_d = T_0 s_{gen}        1 h = 3600 s ; 1 t = 1000 kg"),
);

// ======================================================================
//                                BARÈME
// ======================================================================
const BAR = [];
const ba = (...x) => BAR.push(...x);
ba(new Paragraph({ heading: HeadingLevel.TITLE, children: runs("Barème — Examen Cycles de turbine à gaz") }),
  P("Document enseignant. Total : 20 points (partie A : 4 ; partie B : 16). Le détail des réponses attendues figure dans le corrigé.", { run: { color: "5B6B7B" } }),
  H2("Règles de notation"),
  BUL("**Méthode d'abord** : pour chaque élément, la moitié des points revient à l'expression littérale correcte, l'autre moitié à l'application numérique avec unité."),
  BUL("**Tolérance** : une valeur numérique à ±1 % du corrigé est acceptée (arrondis intermédiaires) ; ±2 % pour les grandeurs obtenues par différence (w_{net}, économie de combustible)."),
  BUL("**Non-double pénalisation** : une erreur reportée d'une question antérieure n'est pas sanctionnée si la démarche est juste et le résultat cohérent avec la valeur reportée."),
  BUL("**Unités** : unité absente ou fausse sur un résultat final, −0,25 pt (au plus une fois par question)."),
  BUL("**Incohérence physique non relevée** (η > η_{Carnot}, T_2 < T_{2s}, s_{gen} < 0, w_{net} < 0…) : la valeur ne rapporte pas de points d'application numérique."),
  BUL("**B5** : la valeur usuelle r_{air} = 287 J/(kg·K) est acceptée sans pénalité (écart inférieur à 0,5 % sur s_{gen})."),
  H2("Grille détaillée"),
);
const rowsB = [["Question", "Élément attendu", "Points"]];
for (const [id, p, items] of BAREME) {
  items.forEach(([t, x], k) => rowsB.push([k === 0 ? `**${id}** (${pts(p)})` : "", t, f(x, 2)]));
}
rowsB.push(["**Total**", "", `**${f(TOTAL, 0)}**`]);
ba(TABLE(rowsB, [1500, 7038, 1100], [0, 1]),
  SP(),
  H2("Synthèse par partie"),
  TABLE([
    ["Partie", "Questions", "Points", "Compétence évaluée"],
    ["A", "A1 à A4", "4", "compréhension physique, argumentation"],
    ["B", "B1, B2", "7", "bilans d'énergie, cycles idéal et réel"],
    ["B", "B3", "2", "dimensionnement (débits), validation d'hypothèse"],
    ["B", "B4", "3,5", "régénération, analyse technico-économique"],
    ["B", "B5", "2,5", "second principe, exergie"],
    ["B", "B6", "1", "esprit critique sur le modèle"],
  ], [1000, 1700, 1100, 5838], [0, 3]),
);

// ======================================================================
//                                CORRIGÉ
// ======================================================================
const COR = [];
const cr = (...x) => COR.push(...x);
const tau = f(I.tau, 4);
cr(new Paragraph({ heading: HeadingLevel.TITLE, children: runs("Corrigé — Examen Cycles de turbine à gaz") }),
  P("Document enseignant. Les points indiqués renvoient au barème. Valeurs calculées et contrôlées par calc/exam_calc.py (vérifications automatiques : premier principe, cohérence formule fermée / bilan, T > T_s, s_{gen} > 0, bilan du régénérateur, η < η_{Carnot}). Les valeurs affichées sont arrondies ; les calculs sont menés en pleine précision.", { run: { color: "5B6B7B" } }),
  H1("Partie A — Questions de cours"),
  HQ("A1", "Back work ratio"),
  P("bwr = w_c/w_t : fraction du travail de la turbine consommée par le compresseur. En turbine à gaz on comprime un gaz (grand volume massique, w = ∫v dp élevé) : bwr ≈ 0,4 à 0,6. En cycle de Rankine on pompe un liquide (v ≈ 10^{−3} m^3/kg) : bwr de l'ordre de 0,01. Conséquence : une petite dégradation de η_c ou η_t réduit fortement w_{net} (facteur d'amplification bwr/(1 − bwr)) ; d'où l'importance de turbomachines performantes et de leur entretien (lavage des compresseurs). Ici, B2 donne bwr = " + f(X.bwr, 3) + "."),
  HQ("A2", "Brayton et Carnot"),
  P("Le rendement d'un cycle réversible s'écrit η = 1 − T_{m,out}/T_{m,in}, avec les températures moyennes thermodynamiques d'échange T_m = q/Δs. Dans le cycle de Brayton, la chaleur est reçue de T_2 à T_3 (T_{m,in} < T_3) et cédée de T_4 à T_1 (T_{m,out} > T_1). On a donc η_{Brayton} < 1 − T_1/T_3. Le cycle est réversible au sens interne, mais les échanges de chaleur avec des sources à T_3 et T_1 se feraient sous écart de température."),
  HQ("A3", "Régénération"),
  P("Il faut T_4 > T_2 : les gaz sortant de la turbine doivent être plus chauds que l'air sortant du compresseur. Quand r augmente, T_2 augmente et T_4 diminue. L'écart T_4 − T_2, donc la chaleur récupérable ε c_p(T_4 − T_2), diminue puis s'annule à un rapport limite au-delà duquel le régénérateur refroidirait l'air comprimé. Un cycle régénératif se conçoit donc à rapport de pression modéré."),
  HQ("A4", "Maximum du rendement réel"),
  P("Pour le cycle idéal, η = 1 − r^{−(γ−1)/γ} croît de façon monotone. Pour le cycle réel, quand r augmente, w_c = w_{c,s}/η_c croît plus vite que w_t = η_t w_{t,s} (le bwr augmente), si bien que w_{net} passe par un maximum puis tend vers zéro. Parallèlement q_{in} = c_p(T_3 − T_2) diminue mais reste fini, tandis que w_{net} s'annule. Le rapport w_{net}/q_{in} passe donc par un maximum, à un r plus élevé que celui qui maximise w_{net}."),

  H1("Partie B — Problème"),
  HQ("B1", "Cycle idéal"),
  EQ(`τ = r^{(γ−1)/γ} = 10^{0,285 71} = ${tau}`),
  EQ(`T_{2s} = T_1 τ = 288,15 × ${tau} = ${f(I.T2s)} K        T_{4s} = T_3/τ = 1300/${tau} = ${f(I.T4s)} K`),
  EQ(`w_{c,s} = c_p(T_{2s} − T_1) = 1,005 × ${f(I.T2s - 288.15)} = ${kJ(I.wc)} kJ/kg`),
  EQ(`w_{t,s} = c_p(T_3 − T_{4s}) = 1,005 × ${f(1300 - I.T4s)} = ${kJ(I.wt)} kJ/kg        w_{net,s} = ${kJ(I.wnet)} kJ/kg`),
  EQ(`q_{in,s} = c_p(T_3 − T_{2s}) = ${kJ(I.qin)} kJ/kg        η_s = ${kJ(I.wnet)}/${kJ(I.qin)} = ${pc(I.eta)}`),
  EQ(`Vérification : η_s = 1 − 1/τ = 1 − 1/${tau} = ${pc(I.eta_formule)}  ✔`),
  HQ("B2", "Cycle réel"),
  EQ(`T_2 = T_1 + (T_{2s} − T_1)/η_c = 288,15 + ${f(I.T2s - 288.15)}/0,86 = ${f(X.T2)} K`),
  EQ(`T_4 = T_3 − η_t(T_3 − T_{4s}) = 1300 − 0,88 × ${f(1300 - I.T4s)} = ${f(X.T4)} K`),
  EQ(`w_c = c_p(T_2 − T_1) = ${kJ(X.wc)} kJ/kg    w_t = c_p(T_3 − T_4) = ${kJ(X.wt)} kJ/kg    w_{net} = ${kJ(X.wnet)} kJ/kg`),
  EQ(`q_{in} = c_p(T_3 − T_2) = 1,005 × ${f(1300 - X.T2)} = ${kJ(X.qin)} kJ/kg        η_{th} = ${kJ(X.wnet)}/${kJ(X.qin)} = ${pc(X.eta)}`),
  EQ(`bwr = ${kJ(X.wc)}/${kJ(X.wt)} = ${f(X.bwr, 3)}        (cycle idéal : ${f(I.wc / I.wt, 3)})`),
  P(`Commentaire attendu : avec des rendements isentropiques de 86 et 88 %, le travail net chute de ${f((1 - X.wnet / I.wnet) * 100, 1)} % et le rendement perd ${f((I.eta - X.eta) * 100, 1)} points. Cette amplification vient du bwr élevé (lien avec A1). On vérifie aussi T_2 > T_{2s} et T_4 > T_{4s}.`),
  HQ("B3", "Débits"),
  EQ(`ṁ_a = P_{net}/w_{net} = 5,0 × 10^6/${f(X.wnet, 0)} = ${f(M.m_air, 2)} kg/s`),
  EQ(`ṁ_f = ṁ_a q_{in}/PCI = ${f(M.m_air, 2)} × ${f(X.qin, 0)}/48,0 × 10^6 = ${f(M.m_f, 4)} kg/s  (Q̇_{in} = ${f(M.Q_in / 1e6, 2)} MW)`),
  EQ(`f = ṁ_f/ṁ_a = ${f(M.f, 4)}`),
  P(`Le combustible représente ${f(M.f * 100, 2)} % du débit d'air : l'erreur induite sur le débit traversant la turbine est d'environ 1,5 %, du même ordre que les autres approximations du modèle. L'hypothèse est justifiée pour une étude préliminaire.`),
  HQ("B4", "Régénération"),
  P(`T_4 = ${f(X.T4)} K > T_2 = ${f(X.T2)} K : régénération possible (écart ${f(X.T4 - X.T2, 0)} K).`),
  EQ(`T_x = T_2 + ε(T_4 − T_2) = ${f(X.T2)} + 0,75 × ${f(X.T4 - X.T2)} = ${f(G.Tx)} K`),
  EQ(`Bilan du régénérateur (mêmes ṁ et c_p) :  T_y = T_4 − (T_x − T_2) = ${f(X.T4)} − ${f(G.Tx - X.T2)} = ${f(G.Ty)} K`),
  EQ(`q_{in} = c_p(T_3 − T_x) = ${kJ(G.qin)} kJ/kg        w_{net} inchangé = ${kJ(X.wnet)} kJ/kg        η_{reg} = ${pc(G.eta)}`),
  P("Pour une même puissance nette, ṁ_a est inchangé et ṁ_f est proportionnel à q_{in} :"),
  EQ(`économie relative = 1 − q_{in,reg}/q_{in} = 1 − η_{th}/η_{reg} = 1 − ${f(X.eta, 4)}/${f(G.eta, 4)} = ${pc(G.economie_rel, 1)}`),
  EQ(`ṁ_{f,reg} = ${f(G.m_f, 4)} kg/s ;  économie annuelle = (${f(M.m_f, 4)} − ${f(G.m_f, 4)}) × 3600 × 6000 = ${f(G.economie_t_an * 1000, 0)} kg ≈ ${f(G.economie_t_an, 0)} t`),
  P("Erreur fréquente : calculer l'économie avec la différence des rendements (" + f((G.eta - X.eta) * 100, 1) + " points) au lieu du rapport. Accepter aussi un calcul direct par ṁ_{f,reg} = ṁ_a q_{in,reg}/PCI."),
  HQ("B5", "Irréversibilités"),
  EQ(`s_{gen,c} = s_2 − s_1 = c_p ln(T_2/T_1) − r_{air} ln r = 1005 ln(${f(X.T2)}/288,15) − 287,1 ln 10 = ${f(S.ds12, 2)} J/(kg·K)`),
  EQ(`s_{gen,t} = s_4 − s_3 = c_p ln(T_4/T_3) + r_{air} ln r = 1005 ln(${f(X.T4)}/1300) + 287,1 ln 10 = ${f(S.ds34, 2)} J/(kg·K)`),
  EQ(`E_{d,c} = T_0 s_{gen,c} = ${kJ(S.Ed_c, 2)} kJ/kg        E_{d,t} = T_0 s_{gen,t} = ${kJ(S.Ed_t, 2)} kJ/kg`),
  P(`(Avec r_{air} = 287,0 J/(kg·K) : ${f(S.ds12_287, 2)} et ${f(S.ds34_287, 2)} J/(kg·K), valeurs acceptées.) Les machines étant adiabatiques, s_{gen} = Δs ; les deux valeurs sont positives (second principe ✔). La turbine détruit plus d'exergie que le compresseur, bien que η_t > η_c : les pertes sont proportionnelles au travail échangé, et w_t ≈ ${f(X.wt / X.wc, 2)} w_c. Les pertes de la turbine s'écrivent (1 − η_t)w_{t,s} = ${kJ((1 - 0.88) * I.wt)} kJ/kg, contre (1/η_c − 1)w_{c,s} = ${kJ((1 / 0.86 - 1) * I.wc)} kJ/kg pour le compresseur. À dissipation égale, une irréversibilité à basse température détruirait davantage d'exergie, mais ici l'effet de taille l'emporte.`),
  HQ("B6", "Critique du modèle"),
  TABLE([
    ["Grandeur", "Air froid (B2)", "CoolProp", "Écart"],
    ["T_2 [K]", f(X.T2), f(CP.T2), f((CP.T2 / X.T2 - 1) * 100, 1) + " %"],
    ["T_4 [K]", f(X.T4), f(CP.T4), "+" + f((CP.T4 / X.T4 - 1) * 100, 1) + " %"],
    ["w_{net} [kJ/kg]", kJ(X.wnet), kJ(CP.wnet), "+" + f((CP.wnet / X.wnet - 1) * 100, 1) + " %"],
    ["q_{in} [kJ/kg]", kJ(X.qin), kJ(CP.qin), "+" + f((CP.qin / X.qin - 1) * 100, 1) + " %"],
    ["η_{th}", pc(X.eta), pc(CP.eta), f((CP.eta - X.eta) * 100, 1) + " pt"],
  ], [2400, 2400, 2400, 2438]),
  SP(),
  P(`Réponse attendue : le modèle froid surestime le rendement d'environ 1 point et sous-estime w_{net} (≈ ${f((CP.wnet / X.wnet - 1) * 100, 0)} %) et q_{in} (≈ ${f((CP.qin / X.qin - 1) * 100, 0)} %). La chaleur massique de l'air croît avec la température : c̄_p ≈ ${f(CP.cp_moy_23 / 1e3, 3)} kJ/(kg·K) entre T_2 et T_3 au lieu de 1,005, soit environ ${f((CP.cp_moy_23 / 1005 - 1) * 100, 0)} % de plus. En outre, γ décroît à haute température, d'où une détente moins « refroidissante » : T_4 est plus élevée. Dans le compresseur (températures modérées), les deux modèles sont proches. Conséquence pratique : dimensionner les débits avec des propriétés variables.`),
  H1("Récapitulatif des résultats"),
  TABLE([
    ["Grandeur", "Valeur", "Grandeur", "Valeur"],
    ["T_{2s} ; T_{4s}", `${f(I.T2s)} ; ${f(I.T4s)} K`, "ṁ_a", `${f(M.m_air, 2)} kg/s`],
    ["η idéal ; w_{net,s}", `${pc(I.eta)} ; ${kJ(I.wnet)} kJ/kg`, "ṁ_f ; f", `${f(M.m_f, 4)} kg/s ; ${f(M.f, 4)}`],
    ["T_2 ; T_4", `${f(X.T2)} ; ${f(X.T4)} K`, "T_x ; T_y", `${f(G.Tx)} ; ${f(G.Ty)} K`],
    ["w_c ; w_t", `${kJ(X.wc)} ; ${kJ(X.wt)} kJ/kg`, "η_{reg}", pc(G.eta)],
    ["w_{net} ; q_{in}", `${kJ(X.wnet)} ; ${kJ(X.qin)} kJ/kg`, "Économie", `${pc(G.economie_rel, 1)} ; ${f(G.economie_t_an, 0)} t/an`],
    ["η_{th} ; bwr", `${pc(X.eta)} ; ${f(X.bwr, 3)}`, "E_{d,c} ; E_{d,t}", `${kJ(S.Ed_c)} ; ${kJ(S.Ed_t)} kJ/kg`],
  ], [2100, 2719, 2100, 2719]),
);

(async () => {
  for (const [name, titre, body] of [
    ["Examen_Turbines_a_Gaz_Sujet.docx", "Examen — Cycles de turbine à gaz — Sujet", SUJET],
    ["Examen_Turbines_a_Gaz_Bareme.docx", "Examen — Cycles de turbine à gaz — Barème (enseignant)", BAR],
    ["Examen_Turbines_a_Gaz_Corrige.docx", "Examen — Cycles de turbine à gaz — Corrigé (enseignant)", COR],
  ]) {
    fs.writeFileSync(path.join(D, name), await Packer.toBuffer(makeDoc(titre, body)));
    console.log("[OK] " + name);
  }
})();
