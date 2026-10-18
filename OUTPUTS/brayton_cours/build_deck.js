// Construction du diaporama « Cycles de turbine à gaz » (PptxGenJS 4.0.1).
// Toutes les valeurs numériques sont lues dans calc/results.json (produit par
// calc/brayton.py) : aucune valeur de résultat n'est saisie à la main ici.
// Exécution : NODE_PATH=<dossier node_modules> node build_deck.js
const path = require("path");
const fs = require("fs");
const PptxGenJS = require("pptxgenjs");

const D = __dirname;
const R = JSON.parse(fs.readFileSync(path.join(D, "calc/results.json"), "utf8"));
const SZ = JSON.parse(fs.readFileSync(path.join(D, "figures/sizes.json"), "utf8"));

const NAVY = "1B3A5C", ORANGE = "E07A1F", TEAL = "2A9D8F", GREY = "5B6B7B", LIGHT = "EEF2F6", RED = "C0392B";
const FONT = "Calibri";

// ---------------------------------------------------------------- helpers
const f = (x, d = 1) => x.toFixed(d).replace(".", ",");
const kJ = (x, d = 1) => f(x / 1e3, d);
const pc = (x, d = 1) => f(x * 100, d) + " %";
const T = (res, i) => f(res.etats[i].T, 1);

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";               // 10 × 5,625 in
pptx.title = "Cycles de turbine à gaz (Brayton)";
pptx.lang = "fr-FR";
let n = 0;

function fit(name, x, y, w, h) {
  const [wp, hp] = SZ[name];
  const s = Math.min(w / wp, h / hp);
  return { x: x + (w - wp * s) / 2, y: y + (h - hp * s) / 2, w: wp * s, h: hp * s };
}

function slide(title, notes) {
  const s = pptx.addSlide();
  n += 1;
  s.background = { color: "FFFFFF" };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 5.625, fill: { color: NAVY }, line: { color: NAVY } });
  s.addText(title, { x: 0.4, y: 0.18, w: 9.2, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: NAVY, margin: 0 });
  s.addShape(pptx.ShapeType.line, { x: 0.4, y: 0.82, w: 1.2, h: 0, line: { color: ORANGE, width: 3 } });
  s.addText(`Cycles de turbine à gaz — ${n}`, { x: 6.5, y: 5.28, w: 3.3, h: 0.25, fontFace: FONT, fontSize: 9, color: GREY, align: "right", margin: 0 });
  if (notes) s.addNotes(notes);
  return s;
}

function eq(s, name, x, y, scale = 0.75, altText) {
  const [wp, hp] = SZ[name];
  const w = (wp / 220) * scale, h = (hp / 220) * scale;
  s.addImage({ path: path.join(D, "figures/eq", name + ".png"), x, y, w, h, altText: altText || name });
  return { w, h };
}

function fig(s, name, x, y, w, h, altText) {
  s.addImage({ path: path.join(D, "figures", name + ".png"), ...fit(name, x, y, w, h), altText });
}

function bullets(s, items, x, y, w, h, size = 18) {
  s.addText(items.map((t) => (typeof t === "string" ? { text: t, options: { bullet: { indent: 18 }, paraSpaceAfter: 6 } } : t)),
    { x, y, w, h, fontFace: FONT, fontSize: size, color: "1F2933", valign: "top", margin: 2 });
}

function box(s, text, x, y, w, h, color = ORANGE, size = 15) {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: LIGHT }, line: { color, width: 1.5 } });
  s.addText(text, { x: x + 0.1, y, w: w - 0.2, h, fontFace: FONT, fontSize: size, color: "1F2933", valign: "middle", margin: 2 });
}

function table(s, rows, x, y, w, colW, size = 13) {
  const hdr = { bold: true, color: "FFFFFF", fill: { color: NAVY } };
  const data = rows.map((r, i) => r.map((c, j) => ({
    text: String(c),
    options: { ...(i === 0 ? hdr : { fill: { color: i % 2 ? "FFFFFF" : LIGHT } }), align: j === 0 ? "left" : "center", fontSize: size, fontFace: FONT, valign: "middle" },
  })));
  s.addTable(data, { x, y, w, colW, border: { type: "solid", pt: 0.5, color: "C8D1DA" }, rowH: 0.3, margin: 0.04 });
}

// ------------------------------------------------------------ 1. titre
{
  const s = pptx.addSlide(); n += 1;
  s.background = { color: NAVY };
  s.addText("Cycles de turbine à gaz", { x: 0.7, y: 1.3, w: 8.6, h: 0.9, fontFace: FONT, fontSize: 42, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("Cycle de Brayton idéal, réel et régénératif — bilans d'énergie et d'exergie", { x: 0.7, y: 2.2, w: 8.6, h: 0.6, fontFace: FONT, fontSize: 20, color: "DCE6F0", margin: 0 });
  s.addShape(pptx.ShapeType.line, { x: 0.7, y: 3.0, w: 1.6, h: 0, line: { color: ORANGE, width: 4 } });
  s.addText("Exemples numériques calculés et vérifiés avec CoolProp (air réel, Lemmon et al. 2000)\nNiveau : Licence 3 / Master 1 / école d'ingénieurs — Thermodynamique appliquée",
    { x: 0.7, y: 3.25, w: 8.6, h: 0.9, fontFace: FONT, fontSize: 15, color: "DCE6F0", margin: 0 });
  s.addNotes("Séance d'environ 2 h. Les nombres de tous les exemples proviennent du script calc/brayton.py (CoolProp 8.0.0), fourni aux étudiants pour reproduction.");
}

// ------------------------------------------------------------ 2. objectifs
{
  const s = slide("Objectifs et prérequis");
  s.addText("À l'issue de la séance, l'étudiant sait :", { x: 0.4, y: 1.0, w: 5.6, h: 0.35, fontFace: FONT, fontSize: 18, bold: true, color: NAVY, margin: 0 });
  bullets(s, [
    "écrire les bilans d'énergie de chaque composant d'une turbine à gaz",
    "calculer travaux, chaleur, rendement et back work ratio d'un cycle idéal puis réel",
    "expliquer l'existence d'un rapport de pression optimal",
    "évaluer l'intérêt d'un régénérateur et sa limite d'emploi",
    "localiser les irréversibilités par un bilan d'exergie",
    "critiquer le modèle air standard froid face à l'air réel",
  ], 0.4, 1.4, 5.7, 3.6, 16);
  box(s, "Prérequis\n• 1er et 2e principes en système ouvert\n• gaz parfait, isentropique\n• diagramme T–s\n• notion d'exergie", 6.4, 1.4, 3.3, 2.2, TEAL, 14);
  box(s, "Outil : Python + CoolProp\npip install CoolProp", 6.4, 3.8, 3.3, 0.8, ORANGE, 14);
}

// ------------------------------------------------------------ 3. architecture
{
  const s = slide("Architecture d'une turbine à gaz à cycle ouvert",
    "Insister : le cycle réel est ouvert (air aspiré, gaz brûlés rejetés). Le modèle air standard le remplace par un cycle fermé équivalent : la combustion devient un apport de chaleur isobare, l'échappement un rejet de chaleur isobare 4→1.");
  const y = 1.7;
  // compresseur (trapèze qui se rétrécit) et turbine (qui s'élargit)
  s.addShape(pptx.ShapeType.trapezoid, { x: 0.9, y: y, w: 1.6, h: 1.5, rotate: 90, fill: { color: TEAL }, line: { color: TEAL } });
  s.addText("Compresseur", { x: 0.75, y: y + 0.55, w: 1.9, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center" });
  s.addShape(pptx.ShapeType.roundRect, { x: 3.35, y: y - 0.05, w: 1.9, h: 0.9, fill: { color: ORANGE }, line: { color: ORANGE }, rectRadius: 0.1 });
  s.addText("Chambre de\ncombustion", { x: 3.35, y: y - 0.05, w: 1.9, h: 0.9, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center" });
  s.addShape(pptx.ShapeType.trapezoid, { x: 6.0, y: y, w: 1.6, h: 1.5, rotate: 270, fill: { color: NAVY }, line: { color: NAVY } });
  s.addText("Turbine", { x: 5.85, y: y + 0.55, w: 1.9, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center" });
  s.addShape(pptx.ShapeType.rect, { x: 1.7, y: y + 1.6, w: 6.9, h: 0.08, fill: { color: GREY }, line: { color: GREY } });
  s.addText("arbre : w_c fourni par la turbine", { x: 2.4, y: y + 1.7, w: 3.4, h: 0.3, fontFace: FONT, fontSize: 12, color: GREY, align: "center" });
  s.addText("w_net → alternateur / hélice", { x: 7.3, y: y + 1.7, w: 2.5, h: 0.3, fontFace: FONT, fontSize: 12, color: GREY });
  const arrow = (x1, y1, x2, y2) => s.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: "1F2933", width: 2, endArrowType: "triangle" } });
  arrow(0.3, y + 0.8, 0.95, y + 0.8);
  arrow(2.45, y + 0.4, 3.35, y + 0.4);
  arrow(5.25, y + 0.4, 6.1, y + 0.4);
  arrow(7.55, y + 0.8, 8.4, y + 0.8);
  arrow(4.3, y - 0.65, 4.3, y - 0.08);
  const lab = (t, x, yy) => s.addText(t, { x, y: yy, w: 0.4, h: 0.35, fontFace: FONT, fontSize: 18, bold: true, color: RED, align: "center" });
  lab("1", 0.35, y + 0.4); lab("2", 2.7, y); lab("3", 5.5, y); lab("4", 7.8, y + 0.4);
  s.addText("combustible  (q_in)", { x: 4.4, y: y - 0.7, w: 2.2, h: 0.35, fontFace: FONT, fontSize: 12, color: GREY });
  s.addText("air", { x: 0.2, y: y + 0.95, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 12, color: GREY });
  s.addText("gaz brûlés\n(q_out)", { x: 8.45, y: y + 0.6, w: 1.3, h: 0.5, fontFace: FONT, fontSize: 12, color: GREY });
  s.addText("Applications : turbopropulseurs et turboréacteurs, production électrique (seule ou en cycle combiné gaz-vapeur), compression gazière, propulsion navale.",
    { x: 0.4, y: 4.45, w: 9.2, h: 0.6, fontFace: FONT, fontSize: 14, color: "1F2933", margin: 0 });
}

// ------------------------------------------------------------ 4. hypothèses
{
  const s = slide("Système, hypothèses et bilan d'énergie",
    "Présenter l'équation générale avant la forme simplifiée. Convention : q reçue > 0 et w fourni > 0 dans le bilan général ; ensuite on travaille en valeurs absolues w_c, w_t, q_in, q_out pour la lisibilité.");
  s.addText("1er principe, système ouvert, régime permanent (convention : Q̇ reçue > 0, Ẇ fourni > 0)", { x: 0.4, y: 1.0, w: 9.2, h: 0.35, fontFace: FONT, fontSize: 15, color: GREY, margin: 0 });
  eq(s, "bilan", 0.6, 1.4, 0.8, "Bilan d'énergie en système ouvert");
  s.addText("Hypothèses « air standard »", { x: 0.4, y: 2.15, w: 5, h: 0.35, fontFace: FONT, fontSize: 17, bold: true, color: NAVY, margin: 0 });
  bullets(s, [
    "fluide de travail : air seul ; débit de combustible négligé",
    "combustion → apport de chaleur isobare ; échappement → rejet isobare",
    "ΔEc et ΔEp négligées ; compresseur et turbine adiabatiques",
    "pas de pertes de charge (chambre, échangeurs, filtres)",
  ], 0.4, 2.55, 5.6, 2.5, 15);
  s.addText("Par unité de masse d'air :", { x: 6.2, y: 2.2, w: 3.5, h: 0.35, fontFace: FONT, fontSize: 15, color: GREY, margin: 0 });
  eq(s, "bilan_simpl", 6.2, 2.6, 0.75);
  box(s, "Domaine de validité : estimation de performances préliminaire ; l'écart au cycle réel (composition des gaz brûlés, refroidissement des aubes, pertes de charge) est de plusieurs points de rendement.", 6.2, 3.3, 3.5, 1.7, ORANGE, 12);
}

// ------------------------------------------------------------ 5. modèles de propriétés
{
  const s = slide("Deux modèles de propriétés pour l'air",
    "Le modèle air froid permet des formules fermées ; CoolProp donne h(T,p) et s(T,p) d'après l'équation d'état de Lemmon et al. (2000), domaine de validité jusqu'à 2000 K et 2000 MPa. Entre 300 et 1400 K, cp augmente d'environ 20 %.");
  fig(s, "fig_cp", 0.3, 1.0, 5.2, 3.7, "Chaleur massique cp de l'air en fonction de T : CoolProp et valeur constante 1,005 kJ/(kg·K)");
  table(s, [
    ["", "Air standard froid", "CoolProp « Air »"],
    ["Équation d'état", "gaz parfait", "Lemmon et al. 2000"],
    ["cp", "1,005 kJ/(kg·K) const.", "cp(T, p) variable"],
    ["γ", "1,4 const.", "variable"],
    ["Usage", "formules fermées", "calcul numérique"],
  ], 5.6, 1.1, 4.1, [1.1, 1.5, 1.5], 12);
  box(s, "Ici : T₃ = 1400 K → l'hypothèse cp constant sous-estime h₃ − h₂ d'environ 12 %.", 5.6, 3.0, 4.1, 0.9, ORANGE, 13);
  s.addText("Code : PropsSI('H', 'T', T, 'P', p, 'Air')", { x: 5.6, y: 4.1, w: 4.1, h: 0.35, fontFace: "Consolas", fontSize: 12, color: NAVY, margin: 0 });
}

// ------------------------------------------------------------ 6. cycle idéal
{
  const s = slide("Cycle de Brayton idéal : équations",
    `Montrer la démonstration au tableau : avec cp constant, T2/T1 = T3/T4 = r^((γ-1)/γ), d'où η = 1 - T1/T2. Le rendement ne dépend que de r. Le travail net est maximal pour r_opt (cycle idéal, air froid) ; avec T1 = 288,15 K et T3 = 1400 K, r_opt = ${f(R.r_opt_ideal, 1)}.`);
  bullets(s, ["1→2 compression isentropique", "2→3 apport de chaleur isobare", "3→4 détente isentropique", "4→1 rejet de chaleur isobare"], 0.4, 1.0, 4.0, 1.6, 15);
  eq(s, "travaux", 0.5, 2.75, 0.5);
  eq(s, "rendement", 0.5, 3.35, 0.7);
  s.addText("Cas air froid (cp, γ constants) :", { x: 5.0, y: 1.0, w: 4.6, h: 0.35, fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0 });
  eq(s, "eta_froid", 5.1, 1.45, 0.7);
  s.addText("Travail net maximal pour :", { x: 5.0, y: 2.2, w: 4.6, h: 0.35, fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0 });
  eq(s, "ropt", 5.4, 2.6, 0.7);
  box(s, `Back work ratio  bwr = w_c / w_t : souvent 40 à 60 % en turbine à gaz, contre quelques % en cycle à vapeur → la qualité du compresseur est décisive.`, 5.0, 3.75, 4.7, 1.1, ORANGE, 13);
}

// ------------------------------------------------------------ 7. exemple 1
{
  const e = R.ex1, F = e.air_froid, C = e.coolprop;
  const s = slide("Exemple 1 — cycle idéal : air froid vs CoolProp",
    `Données : p1 = 101,325 kPa, T1 = 288,15 K, r = 12, T3 = 1400 K. Air froid : τ = 12^0,2857 = ${f(Math.pow(12, 0.4 / 1.4), 4)} ; T2s = 288,15 × τ ; T4s = 1400 / τ. CoolProp : h2s = h(p2, s1), h4s = h(p1, s3). La formule 1 - r^(-0,2857) donne exactement ${pc(e.eta_formule, 2)}.`);
  box(s, "Données : p₁ = 101,325 kPa ; T₁ = 288,15 K ; r = 12 ; T₃ = 1400 K ; compression et détente isentropiques.", 0.4, 1.0, 9.2, 0.5, TEAL, 14);
  table(s, [
    ["Grandeur", "Air froid", "CoolProp", "Écart"],
    ["T₂ [K]", T(F, 1), T(C, 1), f(C.etats[1].T - F.etats[1].T, 1) + " K"],
    ["T₄ [K]", T(F, 3), T(C, 3), "+" + f(C.etats[3].T - F.etats[3].T, 1) + " K"],
    ["w_c [kJ/kg]", kJ(F.w_c), kJ(C.w_c), pc(C.w_c / F.w_c - 1)],
    ["w_t [kJ/kg]", kJ(F.w_t), kJ(C.w_t), "+" + pc(C.w_t / F.w_t - 1)],
    ["w_net [kJ/kg]", kJ(F.w_net), kJ(C.w_net), "+" + pc(C.w_net / F.w_net - 1)],
    ["q_in [kJ/kg]", kJ(F.q_in), kJ(C.q_in), "+" + pc(C.q_in / F.q_in - 1)],
    ["η_th", pc(F.eta, 2), pc(C.eta, 2), f((C.eta - F.eta) * 100, 2) + " pt"],
    ["bwr", f(F.bwr, 3), f(C.bwr, 3), ""],
  ], 0.4, 1.7, 5.6, [1.6, 1.3, 1.3, 1.4], 13);
  box(s, `Lecture physique : cp croît avec T → T₄ plus élevée et q_in plus grande avec l'air réel ; le rendement baisse de ${f((F.eta - C.eta) * 100, 1)} points, le travail net augmente.\n\nLe modèle air froid surestime η mais sous-estime w_net.`, 6.3, 1.7, 3.4, 3.0, ORANGE, 13);
}

// ------------------------------------------------------------ 8. cycle réel
{
  const s = slide("Cycle réel : rendements isentropiques",
    "Les états isentropiques 2s et 4s sont calculés à entropie constante, puis on corrige l'enthalpie par le rendement isentropique. Le rendement isentropique de compression porte au dénominateur l'enthalpie réelle, celui de détente au numérateur : erreur fréquente d'inversion.");
  eq(s, "isentropiques", 0.5, 1.05, 0.72);
  eq(s, "etats_s", 0.5, 1.65, 0.62);
  bullets(s, [
    "irréversibilités : frottements, chocs, jeux en bout d'aube",
    "sgen > 0 : 2 et 4 à droite de 2s et 4s",
    "w_c augmente, w_t diminue → w_net chute fortement",
    "dans le diagramme, 1→2 et 3→4 en pointillés : évolutions non quasi statiques",
  ], 0.4, 2.3, 4.4, 2.8, 14);
  fig(s, "fig_Ts", 4.9, 0.95, 4.9, 4.2, "Diagramme T-s des cycles idéal et réel calculés avec CoolProp, r = 12, T3 = 1400 K");
}

// ------------------------------------------------------------ 9. exemple 2
{
  const e = R.ex2, C = e.coolprop, F = e.air_froid, I = R.ex1.coolprop;
  const s = slide("Exemple 2 — cycle réel (CoolProp)",
    `Étapes : (1) h1, s1 ; (2) h2s = h(p2, s1) puis h2 = h1 + (h2s - h1)/0,86 ; (3) h3, s3 ; (4) h4s = h(p1, s3) puis h4 = h3 - 0,89 (h3 - h4s) ; (5) bilans. Ordre de grandeur pour 100 MW nets : débit d'air = 1e8 / ${f(C.w_net, 0)} ≈ ${f(1e8 / C.w_net, 0)} kg/s.`);
  box(s, "Mêmes données qu'à l'exemple 1, avec  ηc = 0,86  et  ηt = 0,89.", 0.4, 1.0, 9.2, 0.45, TEAL, 14);
  table(s, [
    ["", "Idéal", "Réel", "Réel air froid"],
    ["T₂ [K]", T(I, 1), T(C, 1), T(F, 1)],
    ["T₄ [K]", T(I, 3), T(C, 3), T(F, 3)],
    ["w_c [kJ/kg]", kJ(I.w_c), kJ(C.w_c), kJ(F.w_c)],
    ["w_t [kJ/kg]", kJ(I.w_t), kJ(C.w_t), kJ(F.w_t)],
    ["w_net [kJ/kg]", kJ(I.w_net), kJ(C.w_net), kJ(F.w_net)],
    ["q_in [kJ/kg]", kJ(I.q_in), kJ(C.q_in), kJ(F.q_in)],
    ["η_th", pc(I.eta), pc(C.eta), pc(F.eta)],
    ["bwr", f(I.bwr, 3), f(C.bwr, 3), f(F.bwr, 3)],
  ], 0.4, 1.65, 5.8, [1.6, 1.4, 1.4, 1.4], 13);
  box(s, `Des rendements isentropiques de 86 et 89 % suffisent à faire perdre ${f((I.w_net - C.w_net) / I.w_net * 100, 0)} % du travail net et ${f((I.eta - C.eta) * 100, 1)} points de rendement.\n\nPour 100 MW : ṁ ≈ ${f(1e8 / C.w_net, 0)} kg/s d'air.`, 6.5, 1.65, 3.2, 2.9, ORANGE, 13);
}

// ------------------------------------------------------------ 10. paramétrique
{
  const s = slide("Influence de r et de T₃ (cycle réel, CoolProp)",
    `Courbes calculées avec ηc = 0,86, ηt = 0,89. Pour T3 = 1400 K : w_net maximal à r ≈ ${f(R.r_opt_reel, 1)} alors que η continue d'augmenter jusqu'à r ≈ 30. Les constructeurs choisissent selon l'usage : aviation (compacité, w_net) ou production d'électricité (η, souvent avec cycle combiné).`);
  fig(s, "fig_parametrique", 0.3, 0.95, 9.4, 3.6, "Rendement et travail net en fonction du rapport de pression pour T3 = 1200, 1400 et 1600 K");
  box(s, `Cycle réel : η présente un maximum (contrairement au cycle idéal). Pour T₃ = 1400 K, w_net est maximal à r ≈ ${f(R.r_opt_reel, 1)} → compromis rendement / compacité. Augmenter T₃ améliore les deux (limite : tenue des aubes, refroidissement).`, 0.4, 4.55, 9.2, 0.65, ORANGE, 12);
}

// ------------------------------------------------------------ 11. régénération
{
  const s = slide("Cycle régénératif : principe",
    `L'efficacité est définie ici côté air froid : ε = (hx - h2)/(h(T4, p2) - h2). Comme cp diffère peu entre les deux courants (même débit d'air), c'est équivalent à la définition par les températures. Pour le cycle réel de l'exemple 2, T4 = T2 pour r ≈ ${f(R.r_limite_regen, 1)} (bissection).`);
  bullets(s, [
    "échangeur : gaz d'échappement (4→y) préchauffent l'air comprimé (2→x)",
    "w_c et w_t inchangés ; q_in diminue → η augmente",
    "condition nécessaire : T₄ > T₂",
    "intéressant à faible r et forte T₃",
  ], 0.4, 1.0, 5.2, 2.2, 15);
  eq(s, "regen", 0.5, 3.3, 0.72);
  box(s, `Limite (exemple 2) : T₄ = T₂ pour r ≈ ${f(R.r_limite_regen, 1)}.\nAu-delà, l'échangeur refroidirait l'air comprimé.`, 0.4, 4.05, 5.2, 0.95, RED, 13);
  // schéma simple de l'échangeur
  s.addShape(pptx.ShapeType.rect, { x: 6.3, y: 1.4, w: 3.0, h: 2.4, fill: { color: LIGHT }, line: { color: NAVY, width: 2 } });
  s.addText("Régénérateur", { x: 6.3, y: 2.35, w: 3.0, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: NAVY, align: "center" });
  s.addShape(pptx.ShapeType.line, { x: 5.9, y: 1.8, w: 3.8, h: 0, line: { color: TEAL, width: 3, endArrowType: "triangle" } });
  s.addShape(pptx.ShapeType.line, { x: 9.7, y: 3.4, w: -3.8, h: 0, line: { color: ORANGE, width: 3, endArrowType: "triangle" } });
  s.addText("2 (air comprimé)", { x: 5.9, y: 1.0, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 11, color: TEAL });
  s.addText("x → chambre", { x: 8.3, y: 1.0, w: 1.5, h: 0.3, fontFace: FONT, fontSize: 11, color: TEAL });
  s.addText("4 (gaz turbine)", { x: 8.3, y: 3.95, w: 1.5, h: 0.3, fontFace: FONT, fontSize: 11, color: ORANGE });
  s.addText("y → échappement", { x: 5.9, y: 3.95, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 11, color: ORANGE });
}

// ------------------------------------------------------------ 12. exemple 3
{
  const a = R.ex3.r6, b = R.ex3.r12;
  const s = slide("Exemple 3 — gain de la régénération (ε = 0,80)",
    `Calcul : q_regen = ε (h(T4, p2) - h2) ; hx = h2 + q_regen ; hy = h4 - q_regen. r = 6 : q_regen = ${kJ(a.regen.q_regen)} kJ/kg ; r = 12 : ${kJ(b.regen.q_regen)} kJ/kg. Le maximum de η du cycle régénératif est obtenu à faible r, contrairement au cycle simple. Pertes de charge de l'échangeur non prises en compte : elles réduiraient le gain.`);
  table(s, [
    ["ηc = 0,86 ; ηt = 0,89", "r = 6 simple", "r = 6 régén.", "r = 12 simple", "r = 12 régén."],
    ["T₂ / T₄ [K]", `${T(a.simple, 1)} / ${T(a.simple, 3)}`, "idem", `${T(b.simple, 1)} / ${T(b.simple, 3)}`, "idem"],
    ["T_x [K]", "—", T(a.regen, 4), "—", T(b.regen, 4)],
    ["T_y (échapp.) [K]", T(a.simple, 3), T(a.regen, 5), T(b.simple, 3), T(b.regen, 5)],
    ["w_net [kJ/kg]", kJ(a.simple.w_net), kJ(a.regen.w_net), kJ(b.simple.w_net), kJ(b.regen.w_net)],
    ["q_in [kJ/kg]", kJ(a.simple.q_in), kJ(a.regen.q_in), kJ(b.simple.q_in), kJ(b.regen.q_in)],
    ["η_th", pc(a.simple.eta), pc(a.regen.eta), pc(b.simple.eta), pc(b.regen.eta)],
  ], 0.4, 1.0, 5.2, [1.4, 0.95, 0.95, 0.95, 0.95], 11);
  fig(s, "fig_regen", 5.7, 0.95, 4.1, 3.0, "Rendement en fonction de r, cycle simple et régénératif");
  box(s, `Gain : +${f((a.regen.eta - a.simple.eta) * 100, 1)} points à r = 6, +${f((b.regen.eta - b.simple.eta) * 100, 1)} points à r = 12. Le cycle régénératif optimal travaille à faible rapport de pression.`, 0.4, 3.35, 5.2, 0.95, ORANGE, 13);
  box(s, "Hypothèse : pas de pertes de charge dans l'échangeur (à discuter).", 0.4, 4.4, 5.2, 0.55, GREY, 12);
}

// ------------------------------------------------------------ 13. exergie
{
  const x = R.ex2.exergie;
  const s = slide("Exemple 4 — bilan d'exergie du cycle réel",
    `T0 = 288,15 K. Le bilan est fermé : résidu numérique ${x.residu.toExponential(1)} J/kg. Attention : la destruction d'exergie de la combustion elle-même (généralement la destruction dominante dans une turbine à gaz réelle) n'apparaît pas dans le modèle air standard ; ψ_in est l'exergie reçue par l'air, pas celle du combustible.`);
  eq(s, "exergie", 0.45, 1.0, 0.62);
  eq(s, "eta2", 0.45, 1.5, 0.55);
  fig(s, "fig_exergie", 0.3, 2.0, 5.9, 3.25, "Bilan d'exergie en cascade de l'exemple 2");
  table(s, [
    ["Terme", "kJ/kg", "part"],
    ["ψ_in (reçue)", kJ(x.psi_in), "100 %"],
    ["T₀·s_gen compresseur", kJ(x.Ed_c), pc(x.Ed_c / x.psi_in)],
    ["T₀·s_gen turbine", kJ(x.Ed_t), pc(x.Ed_t / x.psi_in)],
    ["ψ gaz rejetés", kJ(x.psi_rej), pc(x.psi_rej / x.psi_in)],
    ["w_net", kJ(x.w_net), pc(x.w_net / x.psi_in)],
  ], 6.3, 1.1, 3.4, [1.7, 0.85, 0.85], 12);
  box(s, `η_II = ${pc(x.eta_II)}\nLa principale perte est l'exergie des gaz d'échappement → régénération ou cycle combiné.`, 6.3, 3.2, 3.4, 1.5, ORANGE, 13);
}

// ------------------------------------------------------------ 14. vérifications
{
  const B = R.benchmark;
  const s = slide("Comment les résultats ont été vérifiés",
    "Le benchmark reprend l'exemple classique de Çengel & Boles (chapitre sur les cycles à gaz) : r = 8, T1 = 300 K, T3 = 1300 K, ηc = 0,80, ηt = 0,85, résolu avec les tables d'air gaz parfait. La numérotation de l'exemple varie selon l'édition : vérifier dans l'édition utilisée en cours.");
  bullets(s, [
    "formule fermée 1 − r^(−(γ−1)/γ) = calcul pas à pas (écart < 1e−12)",
    "1er principe : w_net = q_in − q_out pour tous les cycles",
    "2e principe : s₂ > s₁ et s₄ > s₃ dans les machines réelles",
    "η < η_Carnot(T₁, T₃) ; bilan d'exergie fermé (résidu ≈ 1e−10)",
    "régénération autorisée seulement si T₄ > T₂",
    "écart air froid / CoolProp < 6 % sur η idéal",
  ], 0.4, 1.0, 5.2, 3.6, 14);
  table(s, [
    ["r = 8, T₁ = 300 K, T₃ = 1300 K", "Manuel*", "CoolProp"],
    ["η idéal", "0,426", f(B.ideal.eta, 3)],
    ["bwr idéal", "0,403", f(B.ideal.bwr, 3)],
    ["η réel (0,80 / 0,85)", "0,266", f(B.reel.eta, 3)],
    ["bwr réel", "0,592", f(B.reel.bwr, 3)],
  ], 5.8, 1.1, 3.9, [1.9, 1.0, 1.0], 12);
  s.addText("* Çengel & Boles, tables d'air (gaz parfait, cp variable). Valeurs du manuel citées de mémoire ; la concordance à 10⁻³ avec CoolProp les corrobore, mais à contrôler dans l'édition utilisée.",
    { x: 5.8, y: 2.75, w: 3.9, h: 0.7, fontFace: FONT, fontSize: 10, italic: true, color: GREY, margin: 0 });
  box(s, "Script : calc/brayton.py → 9 assertions, arrêt si l'une échoue.", 5.8, 3.6, 3.9, 0.7, TEAL, 13);
}

// ------------------------------------------------------------ 15. erreurs fréquentes
{
  const s = slide("Erreurs fréquentes et points de vigilance");
  table(s, [
    ["Erreur", "Conséquence", "Remède"],
    ["T en °C dans r^((γ−1)/γ) ou T₃/T₁", "résultats absurdes", "toujours en kelvins"],
    ["ηc et ηt inversés", "w_c sous-estimé", "réel au dénominateur pour le compresseur"],
    ["T₄ calculée avec ηt depuis T₄s", "erreur sur w_t", "corriger les enthalpies, pas les températures (cp variable)"],
    ["q_in = h₃ − h₂ avec régénérateur", "η sous-estimé", "q_in = h₃ − h_x"],
    ["régénération à r élevé", "η diminue", "vérifier T₄ > T₂"],
    ["mélanger références de h, s (tables / CoolProp)", "valeurs incohérentes", "ne combiner que des différences d'une même source"],
  ], 0.4, 1.05, 9.2, [3.2, 2.2, 3.8], 13);
}

// ------------------------------------------------------------ 16. exercice
{
  const s = slide("Exercice d'application",
    (() => {
      const e = R.exercice, a = e.simple, b = e.regen;
      return `CORRIGÉ ENSEIGNANT (CoolProp) — 1) T2 = ${T(a, 1)} K ; T4 = ${T(a, 3)} K. 2) w_c = ${kJ(a.w_c)} ; w_t = ${kJ(a.w_t)} ; w_net = ${kJ(a.w_net)} ; q_in = ${kJ(a.q_in)} kJ/kg ; η = ${pc(a.eta, 2)} ; bwr = ${f(a.bwr, 3)}. 3) ṁ = 20e6 / w_net = ${f(e.debit_20MW, 1)} kg/s. 4) T4 > T2 donc régénération possible ; Tx = ${T(b, 4)} K ; Ty = ${T(b, 5)} K ; q_in = ${kJ(b.q_in)} kJ/kg ; η = ${pc(b.eta, 2)}. 5) air froid : T2 = ${T(e.air_froid, 1)} K ; T4 = ${T(e.air_froid, 3)} K ; w_net = ${kJ(e.air_froid.w_net)} kJ/kg ; q_in = ${kJ(e.air_froid.q_in)} kJ/kg ; η = ${pc(e.air_froid.eta, 2)} → η surestimé, w_net sous-estimé, comme à l'exemple 1. Valeurs obtenues avec calc/brayton.py, bloc « exercice ».`;
    })());
  box(s, "Turbine à gaz industrielle : p₁ = 101,325 kPa ; T₁ = 20 °C ; r = 10 ; T₃ = 1500 K ; ηc = 0,85 ; ηt = 0,90 ; puissance nette 20 MW. Hypothèses air standard ; propriétés : CoolProp « Air ».", 0.4, 1.0, 9.2, 0.85, TEAL, 14);
  bullets(s, [
    "1. Calculer T₂ et T₄ ; placer le cycle dans le diagramme T–s.",
    "2. Calculer w_c, w_t, w_net, q_in, η_th et le back work ratio.",
    "3. En déduire le débit d'air nécessaire.",
    "4. On ajoute un régénérateur d'efficacité 0,75 : est-ce possible ? Calculer T_x, T_y et le nouveau rendement.",
    "5. Refaire 1–2 avec le modèle air froid et commenter les écarts.",
  ], 0.4, 2.05, 9.2, 2.6, 15);
  s.addText("Corrigé détaillé dans les notes du présentateur.", { x: 0.4, y: 4.75, w: 9.2, h: 0.3, fontFace: FONT, fontSize: 11, italic: true, color: GREY, margin: 0 });
}

// ------------------------------------------------------------ 17. synthèse
{
  const s = slide("Synthèse");
  const items = [
    ["Cycle idéal", "η ne dépend que de r (air froid) ; w_net maximal pour r_opt."],
    ["Cycle réel", `ηc, ηt et le back work ratio élevé dégradent fortement w_net (−${f((R.ex1.coolprop.w_net - R.ex2.coolprop.w_net) / R.ex1.coolprop.w_net * 100, 0)} % ici).`],
    ["Paramètres", "augmenter T₃ améliore η et w_net ; r est un compromis."],
    ["Régénération", "utile à faible r, impossible dès que T₄ ≤ T₂."],
    ["Exergie", "la plus grande perte (hors combustion) est l'échappement."],
    ["Modèle", "l'air froid surestime η de 1 à 3 points ; utiliser cp(T) pour les valeurs chiffrées."],
  ];
  items.forEach(([k, v], i) => {
    const y = 1.05 + i * 0.68;
    s.addShape(pptx.ShapeType.rect, { x: 0.4, y, w: 2.0, h: 0.55, fill: { color: i % 2 ? TEAL : NAVY }, line: { color: "FFFFFF" } });
    s.addText(k, { x: 0.4, y, w: 2.0, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    s.addText(v, { x: 2.55, y, w: 7.1, h: 0.55, fontFace: FONT, fontSize: 15, color: "1F2933", valign: "middle" });
  });
}

// ------------------------------------------------------------ 18. références
{
  const s = slide("Références");
  bullets(s, [
    "Y. A. Çengel, M. A. Boles, Thermodynamics: An Engineering Approach, McGraw-Hill (chapitre « Gas power cycles »).",
    "H. I. H. Saravanamuttoo, G. F. C. Rogers, H. Cohen, P. V. Straznicky, A. C. Nix, Gas Turbine Theory, Pearson.",
    "E. W. Lemmon, R. T. Jacobsen, S. G. Penoncello, D. G. Friend, « Thermodynamic properties of air and mixtures of nitrogen, argon, and oxygen from 60 to 2000 K at pressures to 2000 MPa », J. Phys. Chem. Ref. Data 29 (2000) 331–385.",
    "I. H. Bell, J. Wronski, S. Quoilin, V. Lemort, « Pure and pseudo-pure fluid thermophysical property evaluation and the open-source thermophysical property library CoolProp », Ind. Eng. Chem. Res. 53 (2014) 2498–2508.",
    "CoolProp 8.0.0, documentation : http://www.coolprop.org",
    "T. Kassis et al., Scientific Agent Skills: A Library of Procedural Knowledge for Research Agents, arXiv:2609.00065 (2026) — outil de préparation des diapositives.",
  ], 0.4, 1.0, 9.2, 4.1, 12);
}

pptx.writeFile({ fileName: path.join(D, "Cours_Turbines_a_Gaz_Brayton.pptx") }).then((p) => console.log("[OK] " + p));
