"""Examen « Cycles de turbine à gaz » — calcul et vérification du corrigé.

Problème traité en air standard froid (calculatrice seule le jour de l'examen).
La donnée « CoolProp » de la question B6 est calculée ici avec le module du
cours (../../brayton_cours/calc/brayton.py), pas inventée.

Exécution : python exam_calc.py -> exam_results.json ; AssertionError si une
vérification échoue.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "brayton_cours" / "calc"))
import brayton as b  # noqa: E402

CP, G = 1005.0, 1.4
K = (G - 1) / G
R_AIR = CP * K                   # constante cohérente avec cp et gamma
T1, P1 = 288.15, 101.3e3         # 15 °C
R, T3 = 10.0, 1300.0
ETA_C, ETA_T = 0.86, 0.88
P_NET = 5.0e6                    # W
PCI = 48.0e6                     # J/kg (donnée de l'énoncé)
EPS = 0.75
T0 = T1
HEURES = 6000.0                  # h/an de fonctionnement (question B4)


def calc():
    tau = R ** K
    T2s, T4s = T1 * tau, T3 / tau
    i = dict(tau=tau, T2s=T2s, T4s=T4s, wc=CP * (T2s - T1), wt=CP * (T3 - T4s))
    i["wnet"] = i["wt"] - i["wc"]
    i["qin"] = CP * (T3 - T2s)
    i["eta"] = i["wnet"] / i["qin"]
    i["eta_formule"] = 1 - 1 / tau

    T2 = T1 + (T2s - T1) / ETA_C
    T4 = T3 - ETA_T * (T3 - T4s)
    r_ = dict(T2=T2, T4=T4, wc=CP * (T2 - T1), wt=CP * (T3 - T4), qin=CP * (T3 - T2),
              qout=CP * (T4 - T1))
    r_["wnet"] = r_["wt"] - r_["wc"]
    r_["eta"] = r_["wnet"] / r_["qin"]
    r_["bwr"] = r_["wc"] / r_["wt"]

    m = dict(m_air=P_NET / r_["wnet"])
    m["Q_in"] = m["m_air"] * r_["qin"]
    m["m_f"] = m["Q_in"] / PCI
    m["f"] = m["m_f"] / m["m_air"]

    Tx = T2 + EPS * (T4 - T2)
    Ty = T4 - (Tx - T2)
    qin_g = CP * (T3 - Tx)
    g = dict(Tx=Tx, Ty=Ty, q_reg=CP * (Tx - T2), qin=qin_g, eta=r_["wnet"] / qin_g)
    g["m_f"] = m["m_air"] * qin_g / PCI
    g["economie_rel"] = 1 - g["m_f"] / m["m_f"]                # = 1 - eta_simple/eta_regen
    g["economie_t_an"] = (m["m_f"] - g["m_f"]) * 3600 * HEURES / 1000

    s = dict(ds12=CP * math.log(T2 / T1) - R_AIR * math.log(R),
             ds34=CP * math.log(T4 / T3) + R_AIR * math.log(R))
    s["Ed_c"], s["Ed_t"] = T0 * s["ds12"], T0 * s["ds34"]
    # contrôle : avec la valeur usuelle 287 J/(kg.K) (tolérée dans le barème)
    s["ds12_287"] = CP * math.log(T2 / T1) - 287.0 * math.log(R)
    s["ds34_287"] = CP * math.log(T4 / T3) + 287.0 * math.log(R)

    c = b.cycle_coolprop(R, T1, T3, p1=P1, eta_c=ETA_C, eta_t=ETA_T)
    cp_ = dict(T2=c.etats[1]["T"], T4=c.etats[3]["T"], wc=c.w_c, wt=c.w_t,
               wnet=c.w_net, qin=c.q_in, eta=c.eta,
               cp_moy_23=c.q_in / (T3 - c.etats[1]["T"]))
    return dict(donnees=dict(T1=T1, P1=P1, r=R, T3=T3, eta_c=ETA_C, eta_t=ETA_T, P_net=P_NET,
                             PCI=PCI, eps=EPS, cp=CP, gamma=G, R_air=R_AIR, heures=HEURES),
                ideal=i, reel=r_, debits=m, regen=g, entropie=s, coolprop=cp_)


def verifier(d):
    i, r_, m, g, s, c = (d[k] for k in ("ideal", "reel", "debits", "regen", "entropie", "coolprop"))
    assert abs(i["eta"] - i["eta_formule"]) < 1e-12
    assert abs(r_["wnet"] - (r_["qin"] - r_["qout"])) < 1e-9 * r_["qin"]
    assert r_["T2"] > i["T2s"] and r_["T4"] > i["T4s"]
    assert r_["T4"] > r_["T2"]                                  # régénération possible
    assert abs(g["economie_rel"] - (1 - r_["eta"] / g["eta"])) < 1e-12
    assert abs(CP * (r_["T4"] - g["Ty"]) - g["q_reg"]) < 1e-6
    assert m["f"] < 0.03
    assert s["ds12"] > 0 and s["ds34"] > 0 and s["Ed_t"] > s["Ed_c"]
    assert abs(i["wnet"] - (CP * (T3 - i["T4s"]) - CP * (i["T2s"] - T1))) < 1e-9
    assert c["eta"] < i["eta"] and c["wnet"] > r_["wnet"]       # tendances du cours
    assert r_["eta"] < 1 - T1 / T3
    print("[OK] toutes les vérifications de l'examen sont passées")


if __name__ == "__main__":
    d = calc()
    verifier(d)
    (HERE / "exam_results.json").write_text(json.dumps(d, indent=2))
    for k, v in d.items():
        print(k, {kk: round(vv, 4) for kk, vv in v.items()})
