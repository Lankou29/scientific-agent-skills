// Génère l'énoncé et le corrigé du TD « Cycles de turbine à gaz » (docx-js).
// Toutes les valeurs numériques sont lues dans calc/td_results.json (td_calc.py).
// Exécution : node build_td.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, BorderStyle, ImageRun, Header, Footer, PageNumber, LevelFormat,
  PageBreak, TableOfContents,
} = require("docx");

const D = __dirname;
const R = JSON.parse(fs.readFileSync(path.join(D, "calc/td_results.json"), "utf8"));
const d = R.donnees, e1 = R.ex1, e2 = R.ex2, e3 = R.ex3, e4 = R.ex4, e5 = R.ex5;

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

function TABLE(rows, widths) {
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
        children: [new Paragraph({ alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
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
    creator: "TD Thermodynamique appliquée", features: { updateFields: true }, title: titre, description: titre,
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
//                                ÉNONCÉ
// ======================================================================
const ENONCE = [];
const en = (...x) => ENONCE.push(...x);

en(new Paragraph({ heading: HeadingLevel.TITLE, children: runs("TD — Cycles de turbine à gaz (Brayton)") }),
  P("Thermodynamique appliquée — Licence 3 / Master 1 / école d'ingénieurs — durée indicative : 4 h (dont 1 h sur ordinateur pour l'exercice 3).", { run: { color: "5B6B7B" } }),
  H2("Objectifs"),
  BUL("Appliquer les bilans d'énergie et d'entropie aux composants d'une turbine à gaz."),
  BUL("Calculer les performances d'un cycle idéal, réel et régénératif."),
  BUL("Évaluer les limites du modèle « air standard froid » face aux propriétés réelles de l'air (CoolProp)."),
  BUL("Localiser les irréversibilités par un bilan d'exergie."),
  H2("Données et hypothèses communes"),
  TABLE([
    ["Grandeur", "Symbole", "Valeur"],
    ["Pression d'aspiration", "p_1", "100 kPa"],
    ["Température d'aspiration", "T_1", "20 °C"],
    ["Rapport de pression (sauf mention contraire)", "r = p_2/p_1", "14"],
    ["Température d'entrée turbine", "T_3", "1350 K"],
    ["Chaleur massique (air standard froid)", "c_p", "1,005 kJ·kg^{−1}·K^{−1}"],
    ["Rapport des chaleurs massiques", "γ", "1,4"],
    ["Température de l'environnement (exergie)", "T_0", "= T_1"],
  ], [4800, 2200, 2638]),
  SP(),
  BUL("Régime permanent ; variations d'énergie cinétique et potentielle négligées."),
  BUL("Compresseur et turbine adiabatiques ; pas de pertes de charge (chambre, régénérateur)."),
  BUL("Modèle air standard : la combustion est remplacée par un apport de chaleur isobare 2→3, l'échappement par un rejet isobare 4→1 ; le débit de combustible est négligé devant le débit d'air (sauf question explicite)."),
  BUL("Convention : on note w_c, w_t, q_{in}, q_{out} les valeurs absolues des travaux et chaleurs massiques (kJ/kg d'air)."),
);

// ---------------- Exercice 1
en(H1("Exercice 1 — Cycle de Brayton idéal (air standard froid)"),
  P("Un bureau d'études effectue l'avant-projet d'une turbine à gaz de production d'électricité. Dans un premier temps, le cycle est supposé idéal : compression et détente isentropiques. On utilise les données communes (r = 14, T_3 = 1350 K)."),
  Q(1, "Représenter qualitativement le cycle dans les diagrammes (p, v) et (T, s). Numéroter les états 1 à 4 et indiquer le sens des échanges de chaleur et de travail."),
  Q(2, "Établir l'expression de T_2 et T_4 ; calculer leurs valeurs."),
  Q(3, "Calculer w_c, w_t, w_{net}, q_{in} et q_{out}. Vérifier le premier principe sur le cycle."),
  Q(4, "Calculer le rendement thermique η_{th} à partir des bilans, puis avec la relation η_{th} = 1 − r^{−(γ−1)/γ}. Comparer au rendement de Carnot entre T_1 et T_3 et commenter."),
  Q(5, "Calculer le rapport des travaux bwr = w_c/w_t (« back work ratio »). Commenter sa valeur."),
  Q(6, "Montrer que le travail net est maximal pour r_{opt} = (T_3/T_1)^{γ/[2(γ−1)]} et qu'alors T_2 = T_4. Calculer r_{opt}, w_{net,max} et comparer au point de fonctionnement r = 14."),
);

// ---------------- Exercice 2
en(H1("Exercice 2 — Cycle réel d'une turbine à gaz de pointe de 30 MW"),
  P("La turbine de l'exercice 1 est en réalité équipée d'un compresseur de rendement isentropique η_c = 0,85 et d'une turbine de rendement isentropique η_t = 0,89. Elle doit fournir une puissance nette P_{net} = 30 MW. Le combustible est du méthane, de pouvoir calorifique inférieur PCI = 50,0 MJ/kg ; on suppose la combustion complète (rendement de combustion égal à 1). Modèle air standard froid."),
  Q(1, "Calculer les températures isentropiques T_{2s}, T_{4s} puis les températures réelles T_2 et T_4. Placer les états 2 et 4 dans le diagramme (T, s) par rapport à 2s et 4s."),
  Q(2, "Calculer w_c, w_t, w_{net}, q_{in}, η_{th} et bwr. Comparer à l'exercice 1."),
  Q(3, "Calculer le débit d'air ṁ_a, ainsi que les puissances du compresseur et de la turbine."),
  Q(4, "Calculer le débit de combustible ṁ_f et le rapport f = ṁ_f/ṁ_a. L'hypothèse « débit de combustible négligé » est-elle justifiée ? Calculer la consommation spécifique de combustible en g/kWh."),
  Q(5, "Sensibilité : le compresseur s'encrasse et son rendement isentropique chute à 0,80. Recalculer T_2, w_{net}, η_{th} et ṁ_a. Expliquer pourquoi la baisse relative de w_{net} est plus forte que celle de η_c."),
);

// ---------------- Exercice 3
en(H1("Exercice 3 — Air réel avec CoolProp (sur ordinateur)"),
  P("On reprend exactement les données de l'exercice 2 (η_c = 0,85 ; η_t = 0,89 ; r = 14 ; T_3 = 1350 K ; 30 MW), mais les propriétés de l'air sont calculées avec la bibliothèque libre CoolProp (fluide « Air », équation d'état de Lemmon et al., 2000). Installation : pip install CoolProp."),
  P("Squelette de programme à compléter :"),
  ...CODE([
    "from CoolProp.CoolProp import PropsSI",
    "p1, T1, r, T3 = 100e3, 293.15, 14, 1350.0",
    "eta_c, eta_t = 0.85, 0.89",
    "p2 = r * p1",
    "h1 = PropsSI('H', 'T', T1, 'P', p1, 'Air')   # J/kg",
    "s1 = PropsSI('S', 'T', T1, 'P', p1, 'Air')   # J/(kg.K)",
    "h2s = PropsSI('H', 'P', p2, 'S', s1, 'Air')  # compression isentropique",
    "h2 = ...                                     # à compléter avec eta_c",
    "T2 = PropsSI('T', 'P', p2, 'H', h2, 'Air')",
    "# ... états 3 et 4, puis travaux, chaleur, rendement",
  ]),
  SP(),
  Q(1, "Calculer h_1, s_1, h_{2s}, h_2, T_2, h_3, s_3, h_{4s}, h_4 et T_4. Pourquoi les valeurs absolues de h et s n'ont-elles pas de signification physique ici ?"),
  Q(2, "Calculer w_c, w_t, w_{net}, q_{in}, η_{th}, bwr et le débit d'air pour 30 MW."),
  Q(3, "Dresser un tableau comparatif avec l'exercice 2. Calculer la chaleur massique moyenne c̄_p = Δh/ΔT sur les évolutions 1→2, 2→3 et 3→4 et expliquer l'origine des écarts."),
  Q(4, "Conclure : quel modèle utiliser pour un raisonnement qualitatif ? pour dimensionner l'installation (débit d'air, consommation) ?"),
);

// ---------------- Exercice 4
en(H1("Exercice 4 — Régénération"),
  P("Pour une application de cogénération de faible puissance, on étudie un cycle à rapport de pression r = 5, avec les mêmes rendements isentropiques (η_c = 0,85 ; η_t = 0,89) et T_3 = 1350 K. Un régénérateur (échangeur à contre-courant) d'efficacité ε = 0,80 préchauffe l'air comprimé (2→x) avec les gaz sortant de la turbine (4→y). Modèle air standard froid, débits égaux des deux côtés, échangeur adiabatique sans pertes de charge."),
  Q(1, "Calculer T_2 et T_4 du cycle à r = 5 sans régénérateur, puis w_{net}, q_{in} et η_{th}. La régénération est-elle possible ?"),
  Q(2, "Avec l'efficacité définie par ε = (T_x − T_2)/(T_4 − T_2), calculer T_x, T_y, la chaleur échangée q_{reg}, le nouveau q_{in} et le rendement. Le travail net est-il modifié ?"),
  Q(3, "Montrer que la condition limite T_4 = T_2 conduit à une équation du second degré en τ = r^{(γ−1)/γ}. En déduire le rapport de pression limite r_{lim} au-delà duquel la régénération n'a plus d'intérêt."),
  Q(4, "Calculer le rendement du cycle régénératif à r = 14 (même ε) et comparer au gain obtenu à r = 5. Conclure sur le choix du rapport de pression d'un cycle régénératif."),
  Q(5, "Question d'ouverture (qualitative) : quel serait l'effet de pertes de charge dans le régénérateur sur le travail net et le rendement ?"),
);

// ---------------- Exercice 5
en(H1("Exercice 5 — Bilan d'entropie et d'exergie du cycle réel"),
  P("On reprend le cycle réel de l'exercice 2 (air standard froid). L'environnement est à T_0 = T_1 = 293,15 K."),
  Q(1, "Montrer que, pour rester cohérent avec c_p = 1,005 kJ/(kg·K) et γ = 1,4, il faut prendre r_{air} = c_p(γ−1)/γ. Calculer cette valeur et la comparer à la valeur usuelle 287,0 J/(kg·K)."),
  Q(2, "Calculer les variations d'entropie s_2 − s_1 et s_4 − s_3. En déduire l'entropie créée dans le compresseur et dans la turbine, puis les exergies détruites E_{d,c} = T_0·s_{gen,c} et E_{d,t} = T_0·s_{gen,t}."),
  Q(3, "Calculer l'exergie reçue par l'air dans la chambre : ψ_{in} = (h_3 − h_2) − T_0(s_3 − s_2)."),
  Q(4, "Calculer l'exergie perdue avec les gaz d'échappement ψ_{rej} = (h_4 − h_1) − T_0(s_4 − s_1). Vérifier la fermeture du bilan ψ_{in} = w_{net} + E_{d,c} + E_{d,t} + ψ_{rej} et calculer le rendement exergétique η_{II} = w_{net}/ψ_{in}."),
  Q(5, "Classer les pertes. Pourquoi la turbine détruit-elle plus d'exergie que le compresseur alors que son rendement isentropique est meilleur ? Quelle amélioration du cycle vise la plus grosse perte ? (lien avec l'exercice 4)"),
);

en(H2("Formulaire"),
  EQ("Bilan d'un système ouvert en régime permanent :  q − w = h_s − h_e"),
  EQ("Gaz parfait à c_p constant :  Δh = c_p ΔT     Δs = c_p ln(T_s/T_e) − r_{air} ln(p_s/p_e)"),
  EQ("Isentropique :  T_{2s}/T_1 = (p_2/p_1)^{(γ−1)/γ}"),
  EQ("η_c = (h_{2s} − h_1)/(h_2 − h_1)          η_t = (h_3 − h_4)/(h_3 − h_{4s})"),
);

// ======================================================================
//                                CORRIGÉ
// ======================================================================
const C = [];
const co = (...x) => C.push(...x);
const tauS = f(e1.tau, 4);

co(new Paragraph({ heading: HeadingLevel.TITLE, children: runs("Corrigé enseignant — TD Cycles de turbine à gaz") }),
  P("Document réservé à l'enseignant. Chaque exercice est structuré en : D. raisonnement détaillé ; E. résultats ; F. vérifications physiques et dimensionnelles ; G. erreurs fréquentes et conseils pédagogiques.", { run: { color: "5B6B7B" } }),
  BOX([
    "**Traçabilité des valeurs.** Toutes les valeurs ont été calculées par le script calc/td_calc.py (Python 3.13, CoolProp 8.0.0), qui contrôle automatiquement : le premier principe sur chaque cycle, la cohérence formule fermée / calcul pas à pas, l'optimum T_2 = T_4, la somme nulle des Δs sur le cycle, s_{gen} > 0, la fermeture du bilan d'exergie et la validité de la régénération.",
    "Les valeurs intermédiaires sont conservées en pleine précision ; les valeurs affichées sont arrondies. Recalculer à partir des valeurs arrondies peut donc décaler le dernier chiffre.",
  ], TEAL),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-2" }),
);

// ---------------- Corrigé 1
co(H1b("Exercice 1 — Cycle idéal (air standard froid)"),
  H2("D. Raisonnement détaillé"),
  H3("Q1. Système, hypothèses, diagrammes"),
  P("Système : 1 kg d'air traversant successivement le compresseur, la chambre et la turbine (systèmes ouverts en régime permanent). Le cycle est fermé fictivement par le rejet isobare 4→1. Dans le diagramme (T, s) : 1→2 et 3→4 sont des verticales (isentropiques) ; 2→3 et 4→1 suivent deux isobares, exponentielles croissantes T = T_{ref}·exp[(s − s_{ref})/c_p], l'isobare haute pression étant à gauche. Dans le diagramme (p, v) : 2→3 et 4→1 sont des horizontales, 1→2 et 3→4 des hyperboles pv^γ = cte. La chaleur est reçue sur 2→3 et cédée sur 4→1 ; le travail est reçu sur 1→2 et fourni sur 3→4."),
  H3("Q2. Températures"),
  P("Pour une isentropique d'un gaz parfait à c_p constant, T·p^{−(γ−1)/γ} = cte. En posant τ = r^{(γ−1)/γ} :"),
  EQ(`(γ − 1)/γ = 0,4/1,4 = 0,285 71        τ = 14^{0,285 71} = ${tauS}`),
  EQ(`T_2 = T_1·τ = 293,15 × ${tauS} = ${f(e1.T2)} K`),
  EQ(`T_4 = T_3/τ = 1350 / ${tauS} = ${f(e1.T4)} K`),
  P("Attention : T_1 = 20 °C doit être converti en kelvins (293,15 K) avant tout calcul."),
  H3("Q3. Travaux et chaleurs (bilans de chaque composant)"),
  P("Pour chaque composant, q − w = Δh avec Δh = c_p ΔT :"),
  EQ(`w_c = c_p(T_2 − T_1) = 1,005 × (${f(e1.T2)} − 293,15) = ${kJ(e1.wc)} kJ/kg`),
  EQ(`w_t = c_p(T_3 − T_4) = 1,005 × (1350 − ${f(e1.T4)}) = ${kJ(e1.wt)} kJ/kg`),
  EQ(`w_{net} = w_t − w_c = ${kJ(e1.wt)} − ${kJ(e1.wc)} = ${kJ(e1.wnet)} kJ/kg`),
  EQ(`q_{in} = c_p(T_3 − T_2) = ${kJ(e1.qin)} kJ/kg        q_{out} = c_p(T_4 − T_1) = ${kJ(e1.qout)} kJ/kg`),
  P(`Premier principe sur le cycle : q_{in} − q_{out} = ${kJ(e1.qin)} − ${kJ(e1.qout)} = ${kJ(e1.qin - e1.qout)} kJ/kg = w_{net}. ✔`),
  H3("Q4. Rendement"),
  EQ(`η_{th} = w_{net}/q_{in} = ${kJ(e1.wnet)} / ${kJ(e1.qin)} = ${pc(e1.eta)}`),
  EQ(`η_{th} = 1 − 1/τ = 1 − 1/${tauS} = ${pc(e1.eta_formule)}`),
  P("Les deux calculs coïncident, ce qui est attendu : avec c_p constant, T_2/T_1 = T_3/T_4 = τ, donc T_4/T_1 = T_3/T_2 et q_{out}/q_{in} = (T_4 − T_1)/(T_3 − T_2) = T_1/T_2 = 1/τ."),
  EQ(`η_{Carnot} = 1 − T_1/T_3 = 1 − 293,15/1350 = ${pc(e1.eta_carnot)}`),
  P(`Le cycle de Brayton idéal reste nettement en dessous du rendement de Carnot (${pc(e1.eta)} contre ${pc(e1.eta_carnot)}), bien qu'il soit réversible au sens interne : la chaleur est reçue à température variable (de ${f(e1.T2, 0)} à 1350 K) et non uniquement à T_3, et rejetée de ${f(e1.T4, 0)} K à T_1. La température moyenne d'apport de chaleur est donc bien inférieure à T_3.`),
  H3("Q5. Back work ratio"),
  EQ(`bwr = w_c/w_t = ${kJ(e1.wc)} / ${kJ(e1.wt)} = ${f(e1.bwr, 3)}`),
  P(`Près de ${f(e1.bwr * 100, 0)} % du travail de la turbine sert à entraîner le compresseur, alors que la pompe d'un cycle de Rankine consomme typiquement moins de 1 à 2 % du travail de la turbine (compression d'un liquide). Conséquence : les turbines à gaz sont très sensibles aux rendements des turbomachines (voir exercice 2, Q5).`),
  H3("Q6. Rapport de pression optimal"),
  P("Avec τ comme variable, w_{net}(τ) = c_p[T_3(1 − 1/τ) − T_1(τ − 1)]. On annule la dérivée :"),
  EQ("dw_{net}/dτ = c_p[T_3/τ^2 − T_1] = 0   ⇒   τ_{opt} = (T_3/T_1)^{1/2}   ⇒   r_{opt} = (T_3/T_1)^{γ/[2(γ−1)]}"),
  P("La dérivée seconde −2c_pT_3/τ^3 est négative : il s'agit bien d'un maximum. À l'optimum, T_2 = T_1τ_{opt} = (T_1T_3)^{1/2} et T_4 = T_3/τ_{opt} = (T_1T_3)^{1/2} : T_2 = T_4. En reportant dans w_{net} : w_{net,max} = c_p[(T_3)^{1/2} − (T_1)^{1/2}]^2."),
  EQ(`r_{opt} = (1350/293,15)^{1,75} = ${f(e1.r_opt, 2)}        T_2 = T_4 = ${f(e1.T2o)} K`),
  EQ(`w_{net,max} = 1,005 × (√1350 − √293,15)^2 = ${kJ(e1.wmax, 2)} kJ/kg`),
  P(`À r = 14, w_{net} = ${kJ(e1.wnet, 2)} kJ/kg, soit ${f((1 - e1.wnet / e1.wmax) * 100, 3)} % de moins que le maximum : le point de fonctionnement est pratiquement à l'optimum de travail. L'optimum est très « plat » ; on a donc intérêt à choisir un r légèrement supérieur à r_{opt}, ce qui augmente le rendement (${pc(e1.eta_opt)} à r_{opt}) sans pénaliser notablement le travail.`),
  H2("E. Résultats"),
  TABLE([
    ["Grandeur", "Valeur", "Unité"],
    ["T_2 ; T_4", `${f(e1.T2)} ; ${f(e1.T4)}`, "K"],
    ["w_c ; w_t", `${kJ(e1.wc)} ; ${kJ(e1.wt)}`, "kJ/kg"],
    ["w_{net}", kJ(e1.wnet), "kJ/kg"],
    ["q_{in} ; q_{out}", `${kJ(e1.qin)} ; ${kJ(e1.qout)}`, "kJ/kg"],
    ["η_{th} ; η_{Carnot}", `${pc(e1.eta)} ; ${pc(e1.eta_carnot)}`, "–"],
    ["bwr", f(e1.bwr, 3), "–"],
    ["r_{opt} ; w_{net,max}", `${f(e1.r_opt, 2)} ; ${kJ(e1.wmax)}`, "– ; kJ/kg"],
  ], [3600, 3600, 2438]),
  H2("F. Vérifications"),
  BUL("Homogénéité : [c_p·T] = J·kg^{−1}·K^{−1} × K = J/kg ✔ ; τ et η sans dimension ✔."),
  BUL("Premier principe : q_{in} − q_{out} = w_{net} (écart nul à la précision machine) ✔."),
  BUL(`Second principe : η_{th} < η_{Carnot} ✔ ; ordre de grandeur T_2 ≈ 620 K cohérent avec les températures de refoulement des compresseurs industriels à r ≈ 14.`),
  BUL("Optimum : T_2 = T_4 à r_{opt}, et w_{net,max} calculé par les deux expressions identiques ✔."),
  H2("G. Erreurs fréquentes et conseils"),
  BUL("Températures en °C dans les rapports T_3/T_1 ou dans τ."),
  BUL("Exposant inversé : (γ−1)/γ pour les températures, γ/(γ−1) pour les pressions."),
  BUL("Confondre l'optimum de travail (r_{opt} ≈ 14,5) et l'optimum de rendement (inexistant pour le cycle idéal : η croît indéfiniment avec r)."),
  BUL("Conseil : faire tracer w_{net}(r) et η(r) sur tableur pour visualiser la « platitude » de l'optimum."),
);

// ---------------- Corrigé 2
const s2 = e2.sens;
co(H1b("Exercice 2 — Cycle réel, turbine de 30 MW"),
  H2("D. Raisonnement détaillé"),
  H3("Q1. Températures"),
  P("Les états isentropiques sont ceux de l'exercice 1 : T_{2s} = " + f(e2.T2s) + " K ; T_{4s} = " + f(e2.T4s) + " K. Avec c_p constant, les rendements isentropiques s'écrivent sur les températures :"),
  EQ(`T_2 = T_1 + (T_{2s} − T_1)/η_c = 293,15 + (${f(e2.T2s)} − 293,15)/0,85 = ${f(e2.T2)} K`),
  EQ(`T_4 = T_3 − η_t(T_3 − T_{4s}) = 1350 − 0,89 × (1350 − ${f(e2.T4s)}) = ${f(e2.T4)} K`),
  P("Les irréversibilités créent de l'entropie : dans le diagramme (T, s), 2 est sur l'isobare p_2 au-dessus et à droite de 2s ; 4 est sur l'isobare p_1 au-dessus et à droite de 4s. Les évolutions réelles 1→2 et 3→4 se tracent en pointillés (non quasi statiques)."),
  H3("Q2. Performances"),
  EQ(`w_c = 1,005 × (${f(e2.T2)} − 293,15) = ${kJ(e2.wc)} kJ/kg        (ou w_{c,s}/η_c = ${kJ(e1.wc)}/0,85)`),
  EQ(`w_t = 1,005 × (1350 − ${f(e2.T4)}) = ${kJ(e2.wt)} kJ/kg        (ou η_t·w_{t,s} = 0,89 × ${kJ(e1.wt)})`),
  EQ(`w_{net} = ${kJ(e2.wt)} − ${kJ(e2.wc)} = ${kJ(e2.wnet)} kJ/kg`),
  EQ(`q_{in} = 1,005 × (1350 − ${f(e2.T2)}) = ${kJ(e2.qin)} kJ/kg`),
  EQ(`η_{th} = ${kJ(e2.wnet)}/${kJ(e2.qin)} = ${pc(e2.eta)}        bwr = ${kJ(e2.wc)}/${kJ(e2.wt)} = ${f(e2.bwr, 3)}`),
  P(`Par rapport au cycle idéal, le travail net chute de ${f((1 - e2.wnet / e1.wnet) * 100, 1)} % et le rendement de ${f((e1.eta - e2.eta) * 100, 1)} points, alors que les rendements isentropiques ne « coûtent » que 15 % et 11 % sur chaque machine : l'effet est amplifié par le back work ratio élevé (${f(e2.bwr, 3)}). Le fait que q_{in} diminue (T_2 plus élevée) ne compense pas la perte de travail.`),
  H3("Q3. Débit d'air et puissances"),
  EQ(`ṁ_a = P_{net}/w_{net} = 30 × 10^6 / (${f(e2.wnet, 0)}) = ${f(e2.m_air, 1)} kg/s`),
  EQ(`P_c = ṁ_a·w_c = ${f(e2.P_c / 1e6, 1)} MW        P_t = ṁ_a·w_t = ${f(e2.P_t / 1e6, 1)} MW        P_t − P_c = 30,0 MW ✔`),
  P(`La turbine doit fournir ${f(e2.P_t / 1e6, 0)} MW pour délivrer 30 MW au réseau : l'ordre de grandeur des machines (débit, taille) est dicté par la puissance brute de la turbine.`),
  H3("Q4. Combustible"),
  P("Bilan de la chambre, combustion complète, débit de combustible négligé dans le bilan de masse de l'air : ṁ_f·PCI = ṁ_a·q_{in}."),
  EQ(`Q̇_{in} = ṁ_a·q_{in} = ${f(e2.m_air, 1)} × ${f(e2.qin, 0)} = ${f(e2.Q_in / 1e6, 2)} MW`),
  EQ(`ṁ_f = Q̇_{in}/PCI = ${f(e2.Q_in / 1e6, 2)} × 10^6 / 50,0 × 10^6 = ${f(e2.m_fuel, 3)} kg/s        f = ṁ_f/ṁ_a = ${f(e2.f, 4)}`),
  P(`Le combustible représente ${f(e2.f * 100, 2)} % du débit d'air : l'hypothèse de débit négligé introduit une erreur de l'ordre de 1 % sur le débit traversant la turbine, inférieure aux autres approximations du modèle. Elle est donc acceptable pour une étude préliminaire. (Le rapport stœchiométrique air/méthane étant d'environ 17, on fonctionne ici avec un large excès d'air, nécessaire pour limiter T_3.)`),
  EQ(`CSC = 3600 / (η_{th}·PCI) = 3,6 × 10^9 / (${f(e2.eta, 4)} × 50,0 × 10^6) = ${f(e2.cse, 1)} g/kWh`),
  P("Unités : 1 kWh = 3,6 × 10^6 J ; la consommation spécifique en kg/J vaut 1/(η·PCI), que l'on convertit en g/kWh en multipliant par 3,6 × 10^6 × 10^3."),
  H3("Q5. Sensibilité au rendement du compresseur"),
  EQ(`T_2 = 293,15 + (${f(e2.T2s)} − 293,15)/0,80 = ${f(s2.T2)} K        w_c = ${kJ(s2.wc)} kJ/kg`),
  EQ(`w_{net} = ${kJ(e2.wt)} − ${kJ(s2.wc)} = ${kJ(s2.wnet)} kJ/kg        η_{th} = ${pc(s2.eta)}        ṁ_a = ${f(s2.m_air, 1)} kg/s`),
  P(`η_c baisse de ${f((1 - 0.80 / 0.85) * 100, 1)} % en valeur relative, w_c augmente de ${f((s2.wc / e2.wc - 1) * 100, 2)} % et w_{net} diminue de ${f((1 - s2.wnet / e2.wnet) * 100, 1)} %. En effet Δw_{net} = −Δw_c, donc Δw_{net}/w_{net} = −(Δw_c/w_c)·w_c/w_{net} = −(Δw_c/w_c)·bwr/(1 − bwr) : le facteur d'amplification bwr/(1 − bwr) = ${f(e2.bwr / (1 - e2.bwr), 2)}. C'est pourquoi le lavage périodique des compresseurs est une opération de maintenance majeure.`),
  H2("E. Résultats"),
  TABLE([
    ["Grandeur", "η_c = 0,85", "η_c = 0,80", "Unité"],
    ["T_2 ; T_4", `${f(e2.T2)} ; ${f(e2.T4)}`, `${f(s2.T2)} ; ${f(e2.T4)}`, "K"],
    ["w_c ; w_t", `${kJ(e2.wc)} ; ${kJ(e2.wt)}`, `${kJ(s2.wc)} ; ${kJ(e2.wt)}`, "kJ/kg"],
    ["w_{net}", kJ(e2.wnet), kJ(s2.wnet), "kJ/kg"],
    ["q_{in}", kJ(e2.qin), "–", "kJ/kg"],
    ["η_{th} ; bwr", `${pc(e2.eta)} ; ${f(e2.bwr, 3)}`, `${pc(s2.eta)} ; –`, "–"],
    ["ṁ_a", f(e2.m_air, 1), f(s2.m_air, 1), "kg/s"],
    ["ṁ_f ; f", `${f(e2.m_fuel, 3)} ; ${f(e2.f, 4)}`, "–", "kg/s ; –"],
    ["CSC", f(e2.cse, 1), "–", "g/kWh"],
  ], [2700, 2550, 2550, 1838]),
  H2("F. Vérifications"),
  BUL("T_2 > T_{2s} et T_4 > T_{4s} : création d'entropie dans les deux machines ✔ (quantifiée à l'exercice 5)."),
  BUL("P_t − P_c = P_{net} ✔ ; q_{in} − q_{out} = w_{net} ✔."),
  BUL(`Ordres de grandeur : rendement de ~37 % et ~120 kg/s pour 30 MW cohérents avec les turbines à gaz industrielles en cycle simple de cette puissance (rendements typiques 30 à 40 % ; ordre de grandeur à confronter à une documentation constructeur si on veut le citer).`),
  BUL("Homogénéité de la CSC : (J/kWh)/(J/kg) = kg/kWh, ×10^3 → g/kWh ✔."),
  H2("G. Erreurs fréquentes et conseils"),
  BUL("Appliquer η_c à l'envers : T_2 = T_1 + η_c(T_{2s} − T_1) donne une compression réelle « meilleure » que l'isentropique — absurde."),
  BUL("Calculer T_4 avec T_{4s} = T_{2s}·T_3/T_2 (formule valable uniquement pour le cycle idéal)."),
  BUL("Oublier que la turbine doit d'abord entraîner le compresseur : P_t ≠ P_{net}."),
  BUL("Conseil : faire calculer le facteur d'amplification bwr/(1 − bwr) pour une turbine à gaz et pour un cycle de Rankine (~0,01) : argument très parlant."),
);

// ---------------- Corrigé 3
co(H1b("Exercice 3 — Air réel avec CoolProp"),
  H2("D. Raisonnement détaillé"),
  H3("Q1. États"),
  P("Le modèle de propriétés change mais pas les bilans : w_c = h_2 − h_1, w_t = h_3 − h_4, q_{in} = h_3 − h_2. Les rendements isentropiques s'appliquent désormais aux enthalpies (et non aux températures, c_p n'étant plus constant). Code complet :"),
  ...CODE([
    "from CoolProp.CoolProp import PropsSI as PS",
    "p1, T1, r, T3, eta_c, eta_t = 100e3, 293.15, 14, 1350.0, 0.85, 0.89",
    "p2 = r * p1",
    "h1, s1 = PS('H','T',T1,'P',p1,'Air'), PS('S','T',T1,'P',p1,'Air')",
    "h2s = PS('H','P',p2,'S',s1,'Air')",
    "h2 = h1 + (h2s - h1) / eta_c;  T2 = PS('T','P',p2,'H',h2,'Air')",
    "h3, s3 = PS('H','T',T3,'P',p2,'Air'), PS('S','T',T3,'P',p2,'Air')",
    "h4s = PS('H','P',p1,'S',s3,'Air')",
    "h4 = h3 - eta_t * (h3 - h4s);  T4 = PS('T','P',p1,'H',h4,'Air')",
    "wc, wt, qin = h2 - h1, h3 - h4, h3 - h2",
    "wnet = wt - wc;  eta = wnet / qin;  m_air = 30e6 / wnet",
  ]),
  SP(),
  TABLE([
    ["État", "p [kPa]", "T [K]", "h [kJ/kg]", "s [kJ/(kg·K)]"],
    ["1", "100", "293,15", kJ(e3.h1, 2), f(e3.s1 / 1e3, 4)],
    ["2s", "1400", f(e3.T2s), kJ(e3.h2s, 2), f(e3.s1 / 1e3, 4)],
    ["2", "1400", f(e3.T2), kJ(e3.h2, 2), "–"],
    ["3", "1400", "1350,0", kJ(e3.h3, 2), f(e3.s3 / 1e3, 4)],
    ["4s", "100", f(e3.T4s), kJ(e3.h4s, 2), f(e3.s3 / 1e3, 4)],
    ["4", "100", f(e3.T4), kJ(e3.h4, 2), "–"],
  ], [1400, 1700, 2000, 2200, 2338]),
  SP(),
  EQ(`h_2 = h_1 + (h_{2s} − h_1)/η_c = ${kJ(e3.h1, 2)} + (${kJ(e3.h2s, 2)} − ${kJ(e3.h1, 2)})/0,85 = ${kJ(e3.h2, 2)} kJ/kg`),
  EQ(`h_4 = h_3 − η_t(h_3 − h_{4s}) = ${kJ(e3.h3, 2)} − 0,89 × (${kJ(e3.h3, 2)} − ${kJ(e3.h4s, 2)}) = ${kJ(e3.h4, 2)} kJ/kg`),
  P("Les valeurs absolues de h et s dépendent de l'état de référence choisi par la bibliothèque (une constante additive) ; seules les différences ont un sens physique. Il ne faut donc jamais mélanger des valeurs de h ou s issues de sources différentes (tables papier, CoolProp, REFPROP…)."),
  H3("Q2. Performances"),
  EQ(`w_c = ${kJ(e3.wc)} kJ/kg    w_t = ${kJ(e3.wt)} kJ/kg    w_{net} = ${kJ(e3.wnet)} kJ/kg    q_{in} = ${kJ(e3.qin)} kJ/kg`),
  EQ(`η_{th} = ${pc(e3.eta)}        bwr = ${f(e3.bwr, 3)}        ṁ_a = 30 × 10^6/${f(e3.wnet, 0)} = ${f(e3.m_air, 1)} kg/s`),
  H3("Q3. Comparaison et interprétation"),
  TABLE([
    ["Grandeur", "Air froid (ex. 2)", "CoolProp (ex. 3)", "Écart relatif"],
    ["T_2 [K]", f(e2.T2), f(e3.T2), f((e3.T2 / e2.T2 - 1) * 100, 1) + " %"],
    ["T_4 [K]", f(e2.T4), f(e3.T4), "+" + f((e3.T4 / e2.T4 - 1) * 100, 1) + " %"],
    ["w_c [kJ/kg]", kJ(e2.wc), kJ(e3.wc), f((e3.wc / e2.wc - 1) * 100, 1) + " %"],
    ["w_t [kJ/kg]", kJ(e2.wt), kJ(e3.wt), "+" + f((e3.wt / e2.wt - 1) * 100, 1) + " %"],
    ["w_{net} [kJ/kg]", kJ(e2.wnet), kJ(e3.wnet), "+" + f((e3.wnet / e2.wnet - 1) * 100, 1) + " %"],
    ["q_{in} [kJ/kg]", kJ(e2.qin), kJ(e3.qin), "+" + f((e3.qin / e2.qin - 1) * 100, 1) + " %"],
    ["η_{th}", pc(e2.eta), pc(e3.eta), f((e3.eta - e2.eta) * 100, 2) + " pt"],
    ["ṁ_a [kg/s]", f(e2.m_air, 1), f(e3.m_air, 1), f((e3.m_air / e2.m_air - 1) * 100, 1) + " %"],
    ["ṁ_f [kg/s]", f(e2.m_fuel, 3), f(e3.m_fuel, 3), "+" + f((e3.m_fuel / e2.m_fuel - 1) * 100, 1) + " %"],
  ], [2500, 2400, 2400, 2338]),
  SP(),
  EQ(`c̄_{p,12} = (h_2 − h_1)/(T_2 − T_1) = ${f(e3.cp_moy_12 / 1e3, 3)}   c̄_{p,23} = ${f(e3.cp_moy_23 / 1e3, 3)}   c̄_{p,34} = ${f(e3.cp_moy_34 / 1e3, 3)}  kJ/(kg·K)`),
  P(`La chaleur massique de l'air croît avec la température (excitation des vibrations de N_2 et O_2). Dans le compresseur (293 à 670 K), c̄_p reste proche de 1,005 et le travail de compression est presque identique dans les deux modèles. Dans la chambre et dans la turbine (600 à 1350 K), c̄_p dépasse 1,14 kJ/(kg·K), soit environ 14 % de plus que l'hypothèse « air froid » : q_{in} et w_t sont sous-estimés par le modèle froid. De plus, γ diminue à haute température, ce qui réduit la chute de température de la détente : T_{4s} passe de ${f(e2.T4s, 0)} K à ${f(e3.T4s, 0)} K.`),
  P(`Bilan : le modèle froid surestime le rendement (${pc(e2.eta)} contre ${pc(e3.eta)}) mais sous-estime le travail net de ${f((1 - e2.wnet / e3.wnet) * 100, 1)} %, donc surestime le débit d'air nécessaire de ${f((e2.m_air / e3.m_air - 1) * 100, 1)} %.`),
  ...FIG("td_fig_Ts.png", 520, "Figure 1 — Cycle réel de l'exercice 2 (air froid) et de l'exercice 3 (CoolProp) dans le diagramme (T, s), origine des entropies en 1."),
  H3("Q4. Conclusion"),
  BUL("Raisonnement qualitatif, tendances, formules fermées (r_{opt}, rôle de τ) : le modèle air froid suffit et est très pédagogique."),
  BUL("Dimensionnement (débit d'air, consommation, températures d'échappement pour une chaudière de récupération) : utiliser des propriétés variables (CoolProp, tables) et, au-delà, la composition réelle des gaz brûlés."),
  H2("E. Résultats"),
  P(`T_2 = ${f(e3.T2)} K ; T_4 = ${f(e3.T4)} K ; w_{net} = ${kJ(e3.wnet)} kJ/kg ; q_{in} = ${kJ(e3.qin)} kJ/kg ; η_{th} = ${pc(e3.eta)} ; bwr = ${f(e3.bwr, 3)} ; ṁ_a = ${f(e3.m_air, 1)} kg/s ; ṁ_f = ${f(e3.m_fuel, 3)} kg/s.`),
  H2("F. Vérifications"),
  BUL("w_{net} = q_{in} − q_{out} ✔ (contrôlé par le script) ; s_{2s} = s_1 et s_{4s} = s_3 par construction."),
  BUL(`T_3 = 1350 K est dans le domaine de validité de l'équation d'état de l'air de CoolProp (jusqu'à 2000 K).`),
  BUL("À basse température, CoolProp retrouve c_p ≈ 1,004 kJ/(kg·K) à 288 K et 1 atm : cohérence avec la valeur du modèle froid."),
  H2("G. Erreurs fréquentes et conseils"),
  BUL("Appliquer η_c ou η_t sur les températures au lieu des enthalpies."),
  BUL("Inverser l'ordre des arguments d'entrée de PropsSI (les deux couples (nom, valeur) sont libres, mais les unités sont SI : Pa, K, J/kg)."),
  BUL("Saisir p en bar ou en kPa : CoolProp attend des pascals."),
  BUL("Conseil : demander aux étudiants de tracer c_p(T) entre 250 et 1600 K pour justifier les écarts."),
);

// ---------------- Corrigé 4
const s4 = e4.simple;
co(H1b("Exercice 4 — Régénération"),
  H2("D. Raisonnement détaillé"),
  H3("Q1. Cycle simple à r = 5"),
  EQ(`τ = 5^{0,285 71} = ${f(s4.tau, 4)}        T_{2s} = ${f(s4.T2s)} K        T_{4s} = ${f(s4.T4s)} K`),
  EQ(`T_2 = 293,15 + (${f(s4.T2s)} − 293,15)/0,85 = ${f(s4.T2)} K        T_4 = 1350 − 0,89 × (1350 − ${f(s4.T4s)}) = ${f(s4.T4)} K`),
  EQ(`w_{net} = c_p[(T_3 − T_4) − (T_2 − T_1)] = ${kJ(s4.wt)} − ${kJ(s4.wc)} = ${kJ(s4.wnet)} kJ/kg`),
  EQ(`q_{in} = c_p(T_3 − T_2) = ${kJ(s4.qin)} kJ/kg        η_{th} = ${pc(s4.eta)}`),
  P(`T_4 = ${f(s4.T4)} K > T_2 = ${f(s4.T2)} K : les gaz d'échappement sont plus chauds que l'air comprimé, la régénération est possible (écart de ${f(s4.T4 - s4.T2, 0)} K).`),
  H3("Q2. Cycle régénératif"),
  P("Bilan du régénérateur adiabatique, mêmes débits et même c_p des deux côtés : c_p(T_x − T_2) = c_p(T_4 − T_y), d'où T_y = T_4 − (T_x − T_2)."),
  EQ(`T_x = T_2 + ε(T_4 − T_2) = ${f(s4.T2)} + 0,80 × (${f(s4.T4)} − ${f(s4.T2)}) = ${f(e4.Tx)} K`),
  EQ(`T_y = T_4 − (T_x − T_2) = ${f(s4.T4)} − ${f(e4.Tx - s4.T2)} = ${f(e4.Ty)} K`),
  EQ(`q_{reg} = c_p(T_x − T_2) = ${kJ(e4.q_reg)} kJ/kg        q_{in} = c_p(T_3 − T_x) = ${kJ(e4.qin)} kJ/kg`),
  EQ(`η_{th,reg} = w_{net}/q_{in} = ${kJ(s4.wnet)}/${kJ(e4.qin)} = ${pc(e4.eta)}`),
  P(`Le travail net est inchangé (compresseur et turbine identiques) ; seule la chaleur à fournir diminue de ${f((1 - e4.qin / s4.qin) * 100, 1)} %. Le rendement passe de ${pc(s4.eta)} à ${pc(e4.eta)} (+${f((e4.eta - s4.eta) * 100, 1)} points) et dépasse celui du cycle simple à r = 14 (${pc(e2.eta)}).`),
  H3("Q3. Rapport de pression limite"),
  P("Avec T_2 = T_1[1 + (τ − 1)/η_c] et T_4 = T_3[1 − η_t(1 − 1/τ)], la condition T_4 = T_2, multipliée par τ, donne :"),
  EQ("(T_1/η_c)·τ^2 + [T_1(1 − 1/η_c) − T_3(1 − η_t)]·τ − η_t·T_3 = 0"),
  EQ(`a = 293,15/0,85 = ${f(e4.a, 2)}    b = 293,15 × (1 − 1/0,85) − 1350 × 0,11 = ${f(e4.b, 2)}    c = −0,89 × 1350 = ${f(e4.c, 1)}`),
  EQ(`Δ = b^2 − 4ac = ${f(e4.disc, 0)}        τ_{lim} = (−b + √Δ)/(2a) = ${f(e4.tau_lim, 4)}`),
  EQ(`r_{lim} = τ_{lim}^{γ/(γ−1)} = ${f(e4.tau_lim, 4)}^{3,5} = ${f(e4.r_lim, 2)}        (T_2 = T_4 = ${f(e4.T2_lim)} K)`),
  P("La racine négative est rejetée (τ > 1 physiquement). Au-delà de r ≈ 15,3, l'échangeur refroidirait l'air comprimé : la régénération dégraderait le rendement."),
  H3("Q4. Régénération à r = 14"),
  EQ(`T_x = ${f(e2.T2)} + 0,80 × (${f(e2.T4)} − ${f(e2.T2)}) = ${f(e4.Tx14)} K        η_{th,reg} = ${pc(e4.eta14_regen)}  (contre ${pc(e4.eta14_simple)} sans régénérateur)`),
  P(`À r = 14, proche de r_{lim}, l'écart T_4 − T_2 n'est que de ${f(e2.T4 - e2.T2, 0)} K : le gain n'est que de ${f((e4.eta14_regen - e4.eta14_simple) * 100, 1)} point, contre ${f((e4.eta - s4.eta) * 100, 1)} points à r = 5. Un cycle régénératif se conçoit donc à faible rapport de pression (ici l'optimum de rendement est vers r ≈ 5, voir figure 2), ce qui simplifie aussi le compresseur (micro-turbines, turbines de véhicules).`),
  ...FIG("td_fig_regen.png", 500, "Figure 2 — Rendement du cycle simple et du cycle régénératif (ε = 0,80) en fonction de r, air standard froid, η_c = 0,85, η_t = 0,89, T_3 = 1350 K."),
  H3("Q5. Pertes de charge (qualitatif)"),
  P("Une perte de charge côté air (p_x < p_2) et côté gaz (p_y > p_1) réduit le rapport de détente de la turbine par rapport au rapport de compression : w_t diminue alors que w_c est inchangé. Le travail net et le rendement baissent ; avec un bwr de l'ordre de 0,45 à 0,6, quelques pourcents de pertes de charge suffisent à réduire notablement le gain de la régénération. Il faut donc optimiser l'échangeur (surface, efficacité, pertes de charge) dans son ensemble."),
  H2("E. Résultats"),
  TABLE([
    ["Grandeur", "r = 5 simple", "r = 5 régénératif", "r = 14 simple", "r = 14 régénératif"],
    ["T_2 ; T_4 [K]", `${f(s4.T2)} ; ${f(s4.T4)}`, "idem", `${f(e2.T2)} ; ${f(e2.T4)}`, "idem"],
    ["T_x ; T_y [K]", "–", `${f(e4.Tx)} ; ${f(e4.Ty)}`, "–", `${f(e4.Tx14)} ; ${f(e2.T4 - (e4.Tx14 - e2.T2))}`],
    ["w_{net} [kJ/kg]", kJ(s4.wnet), kJ(s4.wnet), kJ(e2.wnet), kJ(e2.wnet)],
    ["q_{in} [kJ/kg]", kJ(s4.qin), kJ(e4.qin), kJ(e2.qin), kJ(1005 * (1350 - e4.Tx14))],
    ["η_{th}", pc(s4.eta), pc(e4.eta), pc(e4.eta14_simple), pc(e4.eta14_regen)],
  ], [2100, 1850, 1850, 1850, 1988]),
  SP(),
  P(`Rapport de pression limite : r_{lim} = ${f(e4.r_lim, 2)}.`),
  H2("F. Vérifications"),
  BUL("Bilan du régénérateur : q_{reg} cédé par les gaz = c_p(T_4 − T_y) = reçu par l'air ✔ (script)."),
  BUL("En r_{lim}, recalcul direct : T_2 = T_4 à 10^{−6} K près ✔."),
  BUL("T_y > T_2 : le second principe est respecté dans un échangeur à contre-courant d'efficacité < 1 ✔."),
  BUL("Le rendement régénératif reste inférieur au rendement de Carnot (78,3 %) ✔."),
  H2("G. Erreurs fréquentes et conseils"),
  BUL("Garder q_{in} = c_p(T_3 − T_2) après ajout du régénérateur."),
  BUL("Définir l'efficacité avec la mauvaise différence de températures (ε = (T_x − T_2)/(T_x − T_4)…)."),
  BUL("Croire que la régénération augmente le travail net."),
  BUL("Conseil : faire tracer la figure 2 sur tableur et commenter le croisement des deux courbes en r_{lim}."),
);

// ---------------- Corrigé 5
co(H1b("Exercice 5 — Bilans d'entropie et d'exergie"),
  H2("D. Raisonnement détaillé"),
  H3("Q1. Constante massique cohérente"),
  P("Pour un gaz parfait, c_p − c_v = r_{air} et γ = c_p/c_v, donc r_{air} = c_p(γ − 1)/γ."),
  EQ(`r_{air} = 1005 × 0,4/1,4 = ${f(e5.R_air, 2)} J/(kg·K)`),
  P("L'écart avec 287,0 J/(kg·K) est faible (0,05 %), mais utiliser la valeur cohérente garantit que la relation isentropique T_{2s} = T_1·τ conduit exactement à s_{2s} = s_1 : sinon on trouverait une petite « création d'entropie » parasite sur les évolutions isentropiques."),
  H3("Q2. Entropie créée et exergie détruite"),
  P("Compresseur et turbine adiabatiques : le bilan d'entropie se réduit à s_{gen} = s_s − s_e."),
  EQ(`s_2 − s_1 = c_p ln(T_2/T_1) − r_{air} ln(p_2/p_1) = 1005 ln(${f(e2.T2)}/293,15) − ${f(e5.R_air, 2)} ln 14 = ${f(e5.ds12, 2)} J/(kg·K)`),
  EQ(`s_4 − s_3 = c_p ln(T_4/T_3) + r_{air} ln 14 = 1005 ln(${f(e2.T4)}/1350) + ${f(e5.R_air, 2)} ln 14 = ${f(e5.ds34, 2)} J/(kg·K)`),
  EQ(`E_{d,c} = T_0 s_{gen,c} = 293,15 × ${f(e5.ds12, 2)} = ${kJ(e5.Ed_c, 2)} kJ/kg        E_{d,t} = 293,15 × ${f(e5.ds34, 2)} = ${kJ(e5.Ed_t, 2)} kJ/kg`),
  H3("Q3. Exergie reçue dans la chambre"),
  EQ(`s_3 − s_2 = c_p ln(T_3/T_2) = 1005 ln(1350/${f(e2.T2)}) = ${f(e5.ds23, 2)} J/(kg·K)`),
  EQ(`ψ_{in} = ${kJ(e2.qin, 2)} − 293,15 × ${f(e5.ds23 / 1e3, 5)} = ${kJ(e5.psi_in, 2)} kJ/kg`),
  P(`Seulement ${f(e5.psi_in / e2.qin * 100, 1)} % de la chaleur reçue est de l'exergie : la chaleur est fournie à une température moyenne T_m = q_{in}/(s_3 − s_2) = ${f(e2.qin / e5.ds23, 0)} K, et 1 − T_0/T_m = ${f((1 - 293.15 / (e2.qin / e5.ds23)) * 100, 1)} %.`),
  H3("Q4. Exergie rejetée et fermeture du bilan"),
  EQ(`ψ_{rej} = c_p(T_4 − T_1) − T_0 c_p ln(T_4/T_1) = ${kJ(e2.qout, 2)} − 293,15 × 1,005 ln(${f(e2.T4)}/293,15) = ${kJ(e5.psi_rej, 2)} kJ/kg`),
  P("(sur l'isobare p_1, s_4 − s_1 = c_p ln(T_4/T_1)). Bilan :"),
  EQ(`w_{net} + E_{d,c} + E_{d,t} + ψ_{rej} = ${kJ(e5.wnet, 2)} + ${kJ(e5.Ed_c, 2)} + ${kJ(e5.Ed_t, 2)} + ${kJ(e5.psi_rej, 2)} = ${kJ(e5.wnet + e5.Ed_c + e5.Ed_t + e5.psi_rej, 2)} kJ/kg = ψ_{in} ✔`),
  EQ(`η_{II} = w_{net}/ψ_{in} = ${kJ(e5.wnet, 2)}/${kJ(e5.psi_in, 2)} = ${pc(e5.eta_II)}`),
  P("La démonstration générale de la fermeture se fait en additionnant les termes : les enthalpies se combinent en (h_3 − h_2) − (h_4 − h_1) = w_{net}, et les entropies en T_0[(s_3 − s_2) + (s_2 − s_1) + (s_4 − s_3) − (s_4 − s_1)] = 0."),
  H3("Q5. Analyse"),
  TABLE([
    ["Poste", "kJ/kg", "Part de ψ_{in}"],
    ["Travail net w_{net}", kJ(e5.wnet), pc(e5.wnet / e5.psi_in, 1)],
    ["Exergie des gaz rejetés ψ_{rej}", kJ(e5.psi_rej), pc(e5.psi_rej / e5.psi_in, 1)],
    ["Destruction turbine E_{d,t}", kJ(e5.Ed_t), pc(e5.Ed_t / e5.psi_in, 1)],
    ["Destruction compresseur E_{d,c}", kJ(e5.Ed_c), pc(e5.Ed_c / e5.psi_in, 1)],
  ], [4600, 2400, 2638]),
  SP(),
  P(`La perte majeure est l'exergie des gaz d'échappement (${pc(e5.psi_rej / e5.psi_in, 1)}), détruite lors du mélange avec l'atmosphère. On vérifie que T_0·s_{gen,rej} = T_0[(s_1 − s_4) + q_{out}/T_0] = ${kJ(e5.sgen_rej * 293.15, 2)} kJ/kg = ψ_{rej}. Elle se valorise par régénération (exercice 4), cycle combiné ou cogénération.`),
  P(`La turbine détruit plus d'exergie que le compresseur (${kJ(e5.Ed_t)} contre ${kJ(e5.Ed_c)} kJ/kg) bien que η_t > η_c : les pertes sont proportionnelles au travail échangé, et w_t ≈ ${f(e2.wt / e2.wc, 2)} w_c. En outre, une irréversibilité à basse température (compresseur) détruit plus d'exergie par joule dissipé qu'à haute température ; ici l'effet « taille » de la turbine l'emporte.`),
  P("Limite du modèle : la destruction d'exergie dans la combustion elle-même, qui est la plus importante dans une turbine à gaz réelle, n'apparaît pas dans le modèle air standard. ψ_{in} est l'exergie reçue par l'air, pas l'exergie chimique du combustible : η_{II} calculé ici n'est pas le rendement exergétique global de l'installation."),
  H2("E. Résultats"),
  P(`r_{air} = ${f(e5.R_air, 2)} J/(kg·K) ; s_{gen,c} = ${f(e5.ds12, 2)} et s_{gen,t} = ${f(e5.ds34, 2)} J/(kg·K) ; E_{d,c} = ${kJ(e5.Ed_c, 2)} et E_{d,t} = ${kJ(e5.Ed_t, 2)} kJ/kg ; ψ_{in} = ${kJ(e5.psi_in, 2)} kJ/kg ; ψ_{rej} = ${kJ(e5.psi_rej, 2)} kJ/kg ; η_{II} = ${pc(e5.eta_II)}.`),
  H2("F. Vérifications"),
  BUL("Sur le cycle, Σ Δs = (s_2 − s_1) + (s_3 − s_2) + (s_4 − s_3) + (s_1 − s_4) = 0 ✔ (fonction d'état)."),
  BUL("s_{gen} > 0 pour les deux machines et pour le rejet ✔ ; 0 < η_{II} < 1 ✔."),
  BUL("Bilan d'exergie fermé à la précision machine ✔ ; homogénéité : T_0·Δs en K × J/(kg·K) = J/kg ✔."),
  H2("G. Erreurs fréquentes et conseils"),
  BUL("Oublier le terme −r_{air} ln(p_2/p_1) dans Δs (les états 1 et 2 ne sont pas à la même pression)."),
  BUL("Signe de ln(p_4/p_3) = −ln 14 dans la turbine."),
  BUL("Comparer η_{II} avec η_{th} sans préciser les références : ce ne sont pas les mêmes grandeurs."),
  BUL("Conseil : faire construire un diagramme de Grassmann (flux d'exergie) à partir du tableau de Q5."),
  H1b("Références"),
  BUL("Y. A. Çengel, M. A. Boles, Thermodynamics: An Engineering Approach, McGraw-Hill, chapitre « Gas power cycles »."),
  BUL("H. I. H. Saravanamuttoo, G. F. C. Rogers, H. Cohen, P. V. Straznicky, A. C. Nix, Gas Turbine Theory, Pearson."),
  BUL("E. W. Lemmon, R. T. Jacobsen, S. G. Penoncello, D. G. Friend, « Thermodynamic properties of air and mixtures of nitrogen, argon, and oxygen from 60 to 2000 K at pressures to 2000 MPa », J. Phys. Chem. Ref. Data 29 (2000) 331–385."),
  BUL("I. H. Bell, J. Wronski, S. Quoilin, V. Lemort, « Pure and pseudo-pure fluid thermophysical property evaluation and the open-source thermophysical property library CoolProp », Ind. Eng. Chem. Res. 53 (2014) 2498–2508."),
);

// ------------------------------------------------------------- écriture
(async () => {
  for (const [name, titre, body] of [
    ["TD_Turbines_a_Gaz_Enonce.docx", "TD — Cycles de turbine à gaz — Énoncé", ENONCE],
    ["TD_Turbines_a_Gaz_Corrige.docx", "TD — Cycles de turbine à gaz — Corrigé enseignant", C],
  ]) {
    fs.writeFileSync(path.join(D, name), await Packer.toBuffer(makeDoc(titre, body)));
    console.log("[OK] " + name);
  }
})();
