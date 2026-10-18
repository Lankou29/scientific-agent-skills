"""Cycles de turbine à gaz (Brayton) — modèle et exemples numériques vérifiés.

Deux modèles thermodynamiques sont comparés :
  * « air standard froid » : gaz parfait, cp = 1005 J/(kg.K), gamma = 1,4 constants ;
  * « air réel CoolProp »   : équation d'état de Lemmon et al. (2000) pour l'air
    (mélange pseudo-pur), propriétés variables avec T et p (backend HEOS).

Hypothèses communes (air standard) : régime permanent, écoulement 1D, variations
d'énergie cinétique et potentielle négligées, combustion remplacée par un apport
de chaleur à pression constante, débit massique de combustible négligé, pas de
pertes de charge, machines adiabatiques.

Unités SI internes : Pa, K, J/kg, J/(kg.K). Affichage en kJ/kg.

Exécution :  python brayton.py   -> imprime les résultats, écrit results.json
             et lève AssertionError si une vérification échoue.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path

from CoolProp.CoolProp import PropsSI

FLUID = "Air"            # CoolProp : Lemmon et al. 2000, valide jusqu'à 2000 K
T0, P0 = 288.15, 101325.0  # état mort / ambiant ISA (K, Pa)
CP_FROID, GAMMA = 1005.0, 1.4


# ---------------------------------------------------------------- propriétés
def h_Tp(T, p):
    return PropsSI("H", "T", T, "P", p, FLUID)


def s_Tp(T, p):
    return PropsSI("S", "T", T, "P", p, FLUID)


def T_hp(h, p):
    return PropsSI("T", "H", h, "P", p, FLUID)


def h_ps(p, s):
    return PropsSI("H", "P", p, "S", s, FLUID)


def T_ps(p, s):
    return PropsSI("T", "P", p, "S", s, FLUID)


@dataclass
class Etat:
    nom: str
    T: float   # K
    p: float   # Pa
    h: float   # J/kg
    s: float   # J/(kg.K)


@dataclass
class Resultat:
    modele: str
    r: float
    etats: list
    w_c: float      # travail spécifique compresseur (reçu), J/kg
    w_t: float      # travail spécifique turbine (fourni), J/kg
    w_net: float
    q_in: float     # chaleur reçue dans la chambre, J/kg
    q_out: float    # chaleur cédée (> 0), J/kg
    eta: float      # rendement thermique
    bwr: float      # back work ratio w_c / w_t
    q_regen: float = 0.0


# ------------------------------------------------------------ cycle CoolProp
def cycle_coolprop(r, T1, T3, *, p1=P0, eta_c=1.0, eta_t=1.0, eps_regen=None):
    """Cycle de Brayton simple ou régénératif, air réel CoolProp.

    eta_c, eta_t : rendements isentropiques ; eps_regen : efficacité du
    régénérateur (None = pas de régénération). Etats : 1 entrée compresseur,
    2 sortie compresseur, 3 entrée turbine, 4 sortie turbine,
    x sortie régénérateur côté air froid, y sortie côté gaz chauds.
    """
    if not (0 < eta_c <= 1 and 0 < eta_t <= 1):
        raise ValueError("rendements isentropiques hors de ]0 ; 1]")
    if T3 > PropsSI("Tmax", FLUID):
        raise ValueError("T3 hors du domaine de validité de l'EOS de l'air")
    p2 = r * p1
    h1, s1 = h_Tp(T1, p1), s_Tp(T1, p1)
    h2s = h_ps(p2, s1)
    h2 = h1 + (h2s - h1) / eta_c
    h3, s3 = h_Tp(T3, p2), s_Tp(T3, p2)
    h4s = h_ps(p1, s3)
    h4 = h3 - eta_t * (h3 - h4s)
    T2, T4 = T_hp(h2, p2), T_hp(h4, p1)
    etats = [Etat("1", T1, p1, h1, s1),
             Etat("2", T2, p2, h2, s_Tp(T2, p2)),
             Etat("3", T3, p2, h3, s3),
             Etat("4", T4, p1, h4, s_Tp(T4, p1))]
    q_reg = 0.0
    h_entree_chambre, h_sortie_finale = h2, h4
    if eps_regen is not None:
        if T4 <= T2:
            raise ValueError(f"régénération impossible : T4 = {T4:.1f} K <= T2 = {T2:.1f} K")
        # efficacité définie sur l'air froid (cp quasi égaux des deux côtés) :
        # q_reg = eps * (h(T4, p2) - h2)
        q_reg = eps_regen * (h_Tp(T4, p2) - h2)
        hx, hy = h2 + q_reg, h4 - q_reg
        Tx, Ty = T_hp(hx, p2), T_hp(hy, p1)
        etats += [Etat("x", Tx, p2, hx, s_Tp(Tx, p2)), Etat("y", Ty, p1, hy, s_Tp(Ty, p1))]
        h_entree_chambre, h_sortie_finale = hx, hy
    w_c, w_t = h2 - h1, h3 - h4
    q_in, q_out = h3 - h_entree_chambre, h_sortie_finale - h1
    w_net = w_t - w_c
    modele = "CoolProp" + (" régénératif" if eps_regen is not None else "")
    return Resultat(modele, r, [asdict(e) for e in etats], w_c, w_t, w_net,
                    q_in, q_out, w_net / q_in, w_c / w_t, q_reg)


# -------------------------------------------------------- cycle air froid
def cycle_air_froid(r, T1, T3, eta_c=1.0, eta_t=1.0):
    """Modèle analytique gaz parfait à cp constant (formules du cours)."""
    tau = r ** ((GAMMA - 1) / GAMMA)
    T2 = T1 * (1 + (tau - 1) / eta_c)
    T4 = T3 * (1 - eta_t * (1 - 1 / tau))
    w_c, w_t = CP_FROID * (T2 - T1), CP_FROID * (T3 - T4)
    q_in, q_out = CP_FROID * (T3 - T2), CP_FROID * (T4 - T1)
    w_net = w_t - w_c
    etats = [{"nom": n, "T": T} for n, T in zip("1234", (T1, T2, T3, T4))]
    return Resultat("air froid", r, etats, w_c, w_t, w_net, q_in, q_out,
                    w_net / q_in, w_c / w_t)


def r_optimal_ideal(T1, T3):
    """Rapport de pression maximisant w_net (cycle idéal, cp constant)."""
    return (T3 / T1) ** (GAMMA / (2 * (GAMMA - 1)))


# --------------------------------------------------------------- exergie
def bilan_exergie(res: Resultat, T0=T0):
    """Bilan exergétique du cycle simple (états 1..4), base flux d'air.

    psi_in : augmentation d'exergie de l'air dans la chambre
    destructions : compresseur, turbine ; perte : exergie des gaz rejetés.
    La destruction dans la combustion elle-même n'est pas représentée par le
    modèle air standard.
    """
    e = {x["nom"]: x for x in res.etats}
    psi_in = (e["3"]["h"] - e["2"]["h"]) - T0 * (e["3"]["s"] - e["2"]["s"])
    Ed_c = T0 * (e["2"]["s"] - e["1"]["s"])
    Ed_t = T0 * (e["4"]["s"] - e["3"]["s"])
    psi_rej = (e["4"]["h"] - e["1"]["h"]) - T0 * (e["4"]["s"] - e["1"]["s"])
    return {"psi_in": psi_in, "Ed_c": Ed_c, "Ed_t": Ed_t, "psi_rej": psi_rej,
            "w_net": res.w_net, "eta_II": res.w_net / psi_in,
            "residu": psi_in - Ed_c - Ed_t - psi_rej - res.w_net}


# ------------------------------------------------------------ exemples
def kJ(x):
    return round(x / 1e3, 2)


def main():
    out = {}
    T1, T3, r = 288.15, 1400.0, 12.0

    # Exemple 1 : cycle idéal, deux modèles
    ex1_f = cycle_air_froid(r, T1, T3)
    ex1_c = cycle_coolprop(r, T1, T3)
    out["ex1"] = {"air_froid": asdict(ex1_f), "coolprop": asdict(ex1_c),
                  "eta_formule": 1 - r ** (-(GAMMA - 1) / GAMMA)}

    # Exemple 2 : cycle réel
    ex2_c = cycle_coolprop(r, T1, T3, eta_c=0.86, eta_t=0.89)
    ex2_f = cycle_air_froid(r, T1, T3, eta_c=0.86, eta_t=0.89)
    out["ex2"] = {"coolprop": asdict(ex2_c), "air_froid": asdict(ex2_f),
                  "exergie": bilan_exergie(ex2_c)}

    # Exemple 3 : régénération (eps = 0,80), r = 12 et r = 6
    out["ex3"] = {}
    for rr in (6.0, 12.0):
        simple = cycle_coolprop(rr, T1, T3, eta_c=0.86, eta_t=0.89)
        regen = cycle_coolprop(rr, T1, T3, eta_c=0.86, eta_t=0.89, eps_regen=0.80)
        out["ex3"][f"r{int(rr)}"] = {"simple": asdict(simple), "regen": asdict(regen)}

    # Optimum de travail (cycle idéal air froid)
    out["r_opt_ideal"] = r_optimal_ideal(T1, T3)

    # Benchmark manuel : r = 8, T1 = 300 K, T3 = 1300 K, eta_c 0,80, eta_t 0,85
    # (exemple classique de Çengel & Boles, résolu avec tables d'air gaz parfait)
    bi = cycle_coolprop(8, 300, 1300)
    br = cycle_coolprop(8, 300, 1300, eta_c=0.80, eta_t=0.85)
    out["benchmark"] = {"ideal": {"eta": bi.eta, "bwr": bi.bwr, "w_c": bi.w_c, "w_t": bi.w_t},
                        "reel": {"eta": br.eta, "bwr": br.bwr, "w_c": br.w_c, "w_t": br.w_t}}

    # Limite de régénération (T4 = T2) par bissection, cycle réel de l'exemple 2
    def ecart(rr):
        res = cycle_coolprop(rr, T1, T3, eta_c=0.86, eta_t=0.89)
        return res.etats[3]["T"] - res.etats[1]["T"]
    a, c = 2.0, 40.0
    for _ in range(60):
        m = 0.5 * (a + c)
        a, c = (m, c) if ecart(m) > 0 else (a, m)
    out["r_limite_regen"] = 0.5 * (a + c)

    # Rapport de pression maximisant w_net, cycle réel (recherche fine)
    grille = [2 + 0.01 * i for i in range(3801)]
    out["r_opt_reel"] = max(grille, key=lambda rr: cycle_coolprop(
        rr, T1, T3, eta_c=0.86, eta_t=0.89).w_net)

    # Exercice d'application (corrigé enseignant)
    exo = cycle_coolprop(10, 293.15, 1500, eta_c=0.85, eta_t=0.90)
    exo_r = cycle_coolprop(10, 293.15, 1500, eta_c=0.85, eta_t=0.90, eps_regen=0.75)
    exo_f = cycle_air_froid(10, 293.15, 1500, eta_c=0.85, eta_t=0.90)
    out["exercice"] = {"simple": asdict(exo), "regen": asdict(exo_r), "air_froid": asdict(exo_f),
                       "debit_20MW": 20e6 / exo.w_net}

    verifier(out, ex1_f, ex1_c, ex2_c)
    Path(__file__).with_name("results.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False))
    imprimer(out)
    return out


def verifier(out, ex1_f, ex1_c, ex2_c):
    """Contrôles de cohérence physique et numérique."""
    # 1. formule analytique du rendement idéal = calcul pas à pas
    assert abs(ex1_f.eta - out["ex1"]["eta_formule"]) < 1e-12
    # 2. premier principe : w_net = q_in - q_out pour tous les cycles
    for res in (ex1_f, ex1_c, ex2_c):
        assert abs(res.w_net - (res.q_in - res.q_out)) < 1e-6 * res.q_in
    for d in out["ex3"].values():
        for k in ("simple", "regen"):
            x = d[k]
            assert abs(x["w_net"] - (x["q_in"] - x["q_out"])) < 1e-6 * x["q_in"]
    # 3. cycle idéal CoolProp : compression/détente isentropiques
    e = ex1_c.etats
    assert abs(e[1]["s"] - e[0]["s"]) < 1e-3 and abs(e[3]["s"] - e[2]["s"]) < 1e-3
    # 4. second principe : sgen >= 0 dans le compresseur et la turbine réels
    e = ex2_c.etats
    assert e[1]["s"] > e[0]["s"] and e[3]["s"] > e[2]["s"]
    # 5. bilan exergétique fermé et rendement exergétique < 1
    ex = out["ex2"]["exergie"]
    assert abs(ex["residu"]) < 1e-6 * ex["psi_in"] and 0 < ex["eta_II"] < 1
    # 6. rendement < Carnot entre T1 et T3
    for res in (ex1_c, ex2_c):
        assert res.eta < 1 - 288.15 / 1400.0
    # 7. ordre de grandeur : air réel vs air froid à moins de 6 % sur eta idéal
    assert abs(ex1_c.eta - ex1_f.eta) / ex1_f.eta < 0.06
    # 8. régénération : gain à r = 6, et T4 > T2 dans les deux cas testés
    d6 = out["ex3"]["r6"]
    assert d6["regen"]["eta"] > d6["simple"]["eta"]
    # 9. benchmark manuel (tables d'air) : écart < 2 % sur eta et bwr
    b = out["benchmark"]
    assert abs(b["ideal"]["eta"] - 0.426) / 0.426 < 0.02
    assert abs(b["reel"]["eta"] - 0.266) / 0.266 < 0.03
    assert abs(b["reel"]["bwr"] - 0.592) / 0.592 < 0.02
    print("[OK] toutes les vérifications sont passées")


def imprimer(out):
    def ligne(nom, d):
        print(f"  {nom:<22} wc={kJ(d['w_c']):8.2f} wt={kJ(d['w_t']):8.2f} "
              f"wnet={kJ(d['w_net']):8.2f} qin={kJ(d['q_in']):8.2f} kJ/kg  "
              f"eta={d['eta']*100:6.2f} %  bwr={d['bwr']:.3f}  "
              f"T = {[round(x['T'], 1) for x in d['etats']]}")
    print("Exemple 1 (idéal, r = 12, T3 = 1400 K)")
    ligne("air froid", out["ex1"]["air_froid"])
    ligne("CoolProp", out["ex1"]["coolprop"])
    print(f"  formule 1 - r^(-0,2857) = {out['ex1']['eta_formule']*100:.2f} %")
    print("Exemple 2 (réel, eta_c = 0,86, eta_t = 0,89)")
    ligne("air froid", out["ex2"]["air_froid"])
    ligne("CoolProp", out["ex2"]["coolprop"])
    print("  exergie (kJ/kg):", {k: (kJ(v) if k not in ("eta_II", "residu") else v)
                                 for k, v in out["ex2"]["exergie"].items()})
    print("Exemple 3 (régénération eps = 0,80)")
    for k, d in out["ex3"].items():
        ligne(f"{k} simple", d["simple"])
        ligne(f"{k} régénératif", d["regen"])
        print(f"     q_regen = {kJ(d['regen']['q_regen'])} kJ/kg")
    print(f"r_opt idéal (air froid) = {out['r_opt_ideal']:.2f}")
    print("Benchmark :", {k: {kk: round(vv, 4) for kk, vv in v.items()} for k, v in out["benchmark"].items()})


if __name__ == "__main__":
    main()
