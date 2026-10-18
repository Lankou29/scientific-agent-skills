"""TD « Cycles de turbine à gaz » — calcul de toutes les valeurs du corrigé.

Exercices 1, 2, 4, 5 : modèle air standard froid (calcul à la main possible).
Exercice 3 : air réel CoolProp (réutilise ../../brayton_cours/calc/brayton.py).

Exécution : python td_calc.py -> td_results.json + figures, AssertionError si
une vérification échoue.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "brayton_cours" / "calc"))
import brayton as b  # noqa: E402

# ------------------------------------------------------------- données TD
CP, G = 1005.0, 1.4
R_AIR = CP * (G - 1) / G          # 287,14 J/(kg.K) : cohérent avec cp et gamma
K = (G - 1) / G
T1, P1 = 293.15, 100e3            # 20 °C, 100 kPa
R, T3 = 14.0, 1350.0
ETA_C, ETA_T = 0.85, 0.89
P_NET = 30e6                      # W
PCI = 50.0e6                      # J/kg, méthane (hypothèse de l'énoncé)
T0 = T1
EPS = 0.80
R_REGEN = 5.0


def ex1():
    tau = R ** K
    T2 = T1 * tau
    T4 = T3 / tau
    wc, wt = CP * (T2 - T1), CP * (T3 - T4)
    qin, qout = CP * (T3 - T2), CP * (T4 - T1)
    wnet = wt - wc
    r_opt = (T3 / T1) ** (G / (2 * (G - 1)))
    T2o = T1 * r_opt ** K
    T4o = T3 / r_opt ** K
    wmax = CP * (T3 - T4o) - CP * (T2o - T1)
    wmax_formule = CP * (math.sqrt(T3) - math.sqrt(T1)) ** 2
    return dict(tau=tau, T2=T2, T4=T4, wc=wc, wt=wt, wnet=wnet, qin=qin, qout=qout,
                eta=wnet / qin, eta_formule=1 - 1 / tau, bwr=wc / wt,
                eta_carnot=1 - T1 / T3, r_opt=r_opt, T2o=T2o, T4o=T4o,
                wmax=wmax, wmax_formule=wmax_formule, eta_opt=1 - 1 / r_opt ** K)


def reel_froid(r, eta_c=ETA_C, eta_t=ETA_T):
    tau = r ** K
    T2s, T4s = T1 * tau, T3 / tau
    T2 = T1 + (T2s - T1) / eta_c
    T4 = T3 - eta_t * (T3 - T4s)
    wc, wt = CP * (T2 - T1), CP * (T3 - T4)
    qin, qout = CP * (T3 - T2), CP * (T4 - T1)
    return dict(tau=tau, T2s=T2s, T4s=T4s, T2=T2, T4=T4, wc=wc, wt=wt, wnet=wt - wc,
                qin=qin, qout=qout, eta=(wt - wc) / qin, bwr=wc / wt)


def ex2():
    d = reel_froid(R)
    d["m_air"] = P_NET / d["wnet"]
    d["Q_in"] = d["m_air"] * d["qin"]
    d["m_fuel"] = d["Q_in"] / PCI
    d["f"] = d["m_fuel"] / d["m_air"]
    d["cse"] = 3.6e9 / (d["eta"] * PCI)        # g/kWh : 3,6e6 J/kWh * 1e3 g/kg
    d["P_c"] = d["m_air"] * d["wc"]
    d["P_t"] = d["m_air"] * d["wt"]
    s = reel_froid(R, eta_c=0.80)
    d["sens"] = dict(T2=s["T2"], wc=s["wc"], wnet=s["wnet"], eta=s["eta"],
                     m_air=P_NET / s["wnet"])
    return d


def ex3():
    c = b.cycle_coolprop(R, T1, T3, p1=P1, eta_c=ETA_C, eta_t=ETA_T)
    e = c.etats
    h2s = b.h_ps(R * P1, e[0]["s"])
    h4s = b.h_ps(P1, e[2]["s"])
    return dict(h1=e[0]["h"], s1=e[0]["s"], h2s=h2s, T2s=b.T_hp(h2s, R * P1),
                h2=e[1]["h"], T2=e[1]["T"], h3=e[2]["h"], s3=e[2]["s"], h4s=h4s,
                T4s=b.T_hp(h4s, P1), h4=e[3]["h"], T4=e[3]["T"], wc=c.w_c, wt=c.w_t,
                wnet=c.w_net, qin=c.q_in, qout=c.q_out, eta=c.eta, bwr=c.bwr,
                m_air=P_NET / c.w_net, m_fuel=P_NET / c.w_net * c.q_in / PCI,
                cp_moy_23=(e[2]["h"] - e[1]["h"]) / (T3 - e[1]["T"]),
                cp_moy_12=(e[1]["h"] - e[0]["h"]) / (e[1]["T"] - T1),
                cp_moy_34=(e[2]["h"] - e[3]["h"]) / (T3 - e[3]["T"]))


def ex4():
    s = reel_froid(R_REGEN)
    assert s["T4"] > s["T2"]
    Tx = s["T2"] + EPS * (s["T4"] - s["T2"])
    Ty = s["T4"] - (Tx - s["T2"])
    qin = CP * (T3 - Tx)
    q_reg = CP * (Tx - s["T2"])
    eta = s["wnet"] / qin
    # Limite T4 = T2 : (T1/eta_c) tau^2 + [T1 (1 - 1/eta_c) - T3 (1 - eta_t)] tau - T3 eta_t = 0
    a = T1 / ETA_C
    bb = T1 * (1 - 1 / ETA_C) - T3 * (1 - ETA_T)
    c = -T3 * ETA_T
    disc = bb ** 2 - 4 * a * c
    tau_lim = (-bb + math.sqrt(disc)) / (2 * a)
    r_lim = tau_lim ** (1 / K)
    chk = reel_froid(r_lim)
    s14 = reel_froid(R)
    Tx14 = s14["T2"] + EPS * (s14["T4"] - s14["T2"])
    eta14 = s14["wnet"] / (CP * (T3 - Tx14))
    return dict(simple=s, Tx=Tx, Ty=Ty, qin=qin, q_reg=q_reg, eta=eta, a=a, b=bb, c=c,
                disc=disc, tau_lim=tau_lim, r_lim=r_lim, T2_lim=chk["T2"], T4_lim=chk["T4"],
                eta14_simple=s14["eta"], eta14_regen=eta14, Tx14=Tx14)


def ex5(d2):
    T2, T4 = d2["T2"], d2["T4"]
    ds12 = CP * math.log(T2 / T1) - R_AIR * math.log(R)
    ds34 = CP * math.log(T4 / T3) + R_AIR * math.log(R)
    ds23 = CP * math.log(T3 / T2)
    ds41 = CP * math.log(T1 / T4)
    Ed_c, Ed_t = T0 * ds12, T0 * ds34
    psi_in = CP * (T3 - T2) - T0 * ds23
    psi_rej = CP * (T4 - T1) - T0 * CP * math.log(T4 / T1)
    return dict(R_air=R_AIR, ds12=ds12, ds34=ds34, ds23=ds23, ds41=ds41, somme_ds=ds12 + ds23 + ds34 + ds41,
                Ed_c=Ed_c, Ed_t=Ed_t, psi_in=psi_in, psi_rej=psi_rej, wnet=d2["wnet"],
                residu=psi_in - Ed_c - Ed_t - psi_rej - d2["wnet"],
                eta_II=d2["wnet"] / psi_in,
                # entropie créée par le rejet de q_out vers l'ambiance à T0
                sgen_rej=ds41 + CP * (T4 - T1) / T0)


def verifier(r):
    e1, e2, e3, e4, e5 = (r[k] for k in ("ex1", "ex2", "ex3", "ex4", "ex5"))
    for d in (e1, e2):
        assert abs(d["wnet"] - (d["qin"] - d["qout"])) < 1e-9 * d["qin"]
    assert abs(e1["eta"] - e1["eta_formule"]) < 1e-12
    assert e1["eta"] < e1["eta_carnot"]
    assert abs(e1["wmax"] - e1["wmax_formule"]) < 1e-6
    assert abs(e1["T2o"] - e1["T4o"]) < 1e-9            # à r_opt : T2 = T4
    assert e2["T2"] > e2["T2s"] and e2["T4"] > e2["T4s"]
    assert e2["f"] < 0.03                                # combustible négligeable (< 3 %)
    assert abs(e2["P_t"] - e2["P_c"] - P_NET) < 1e-3
    assert abs(e3["wnet"] - (e3["qin"] - e3["qout"])) < 1e-6 * e3["qin"]
    assert abs(e4["T4_lim"] - e4["T2_lim"]) < 1e-6
    assert e4["eta"] > e4["simple"]["eta"]
    assert abs(e4["q_reg"] - CP * (e4["simple"]["T4"] - e4["Ty"])) < 1e-6
    assert abs(e5["residu"]) < 1e-6
    assert abs(T0 * e5["sgen_rej"] - e5["psi_rej"]) < 1e-6   # psi_rej détruite à l'échappement
    assert abs(e5["somme_ds"]) < 1e-9                    # cycle : somme des ds = 0
    assert e5["ds12"] > 0 and e5["ds34"] > 0 and 0 < e5["eta_II"] < 1
    print("[OK] toutes les vérifications du TD sont passées")


def figures(r):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    out = HERE.parent / "figures"
    out.mkdir(exist_ok=True)
    plt.rcParams.update({"font.size": 13, "axes.spines.top": False, "axes.spines.right": False,
                         "axes.grid": True, "grid.alpha": 0.3})
    # Figure 1 : rendement simple / régénératif vs r (air froid)
    rr = np.linspace(2, 30, 300)
    simple = [reel_froid(x)["eta"] * 100 for x in rr]
    reg = []
    for x in rr:
        s = reel_froid(x)
        Tx = s["T2"] + EPS * (s["T4"] - s["T2"])
        reg.append(s["wnet"] / (CP * (T3 - Tx)) * 100 if s["T4"] > s["T2"] else np.nan)
    fig, ax = plt.subplots(figsize=(7.5, 4.4))
    ax.plot(rr, simple, color="#1B3A5C", lw=2.2, label="cycle simple")
    ax.plot(rr, reg, color="#E07A1F", lw=2.2, label="régénératif, ε = 0,80")
    ax.axvline(r["ex4"]["r_lim"], color="#C0392B", ls=":")
    ax.annotate(f"r_lim = {r['ex4']['r_lim']:.2f}".replace(".", ","), (r["ex4"]["r_lim"], 12),
                xytext=(6, 0), textcoords="offset points", color="#C0392B")
    for x, y in ((R_REGEN, r["ex4"]["eta"] * 100), (R_REGEN, r["ex4"]["simple"]["eta"] * 100)):
        ax.plot(x, y, "o", color="k", ms=5)
    ax.set_xlabel("rapport de pression r [–]"), ax.set_ylabel("η_th [%]")
    ax.set_ylim(0, 55), ax.legend(frameon=False)
    fig.tight_layout(), fig.savefig(out / "td_fig_regen.png", dpi=200), plt.close(fig)
    # Figure 2 : T-s air froid vs CoolProp pour l'exercice 3 (états réels)
    e2, e3 = r["ex2"], r["ex3"]
    fig, ax = plt.subplots(figsize=(7.5, 4.6))
    s_ref = b.s_Tp(T1, P1)
    def s_froid(T, p):
        return (CP * math.log(T / T1) - R_AIR * math.log(p / P1)) / 1e3
    pts_f = [(s_froid(T1, P1), T1), (s_froid(e2["T2"], R * P1), e2["T2"]),
             (s_froid(T3, R * P1), T3), (s_froid(e2["T4"], P1), e2["T4"])]
    pts_c = [((b.s_Tp(T, p) - s_ref) / 1e3, T) for T, p in
             ((T1, P1), (e3["T2"], R * P1), (T3, R * P1), (e3["T4"], P1))]
    for pts, col, lab in ((pts_f, "#2A9D8F", "air froid"), (pts_c, "#1B3A5C", "CoolProp")):
        # isobares tracées point par point
        T23 = np.linspace(pts[1][1], T3, 50)
        T41 = np.linspace(pts[3][1], T1, 50)
        if lab == "air froid":
            s23 = [s_froid(t, R * P1) for t in T23]; s41 = [s_froid(t, P1) for t in T41]
        else:
            s23 = [(b.s_Tp(t, R * P1) - s_ref) / 1e3 for t in T23]
            s41 = [(b.s_Tp(t, P1) - s_ref) / 1e3 for t in T41]
        ax.plot(s23, T23, color=col, lw=2, label=lab); ax.plot(s41, T41, color=col, lw=2)
        ax.plot([pts[0][0], pts[1][0]], [pts[0][1], pts[1][1]], color=col, ls=":", lw=2)
        ax.plot([pts[2][0], pts[3][0]], [pts[2][1], pts[3][1]], color=col, ls=":", lw=2)
        for i, (x, y) in enumerate(pts):
            ax.plot(x, y, "o", color=col)
            ax.annotate(str(i + 1), (x, y), xytext=(5, -12 if lab == "air froid" else 4),
                        textcoords="offset points", color=col, weight="bold")
    ax.set_xlabel("s − s₁ [kJ/(kg·K)]"), ax.set_ylabel("T [K]"), ax.legend(frameon=False)
    fig.tight_layout(), fig.savefig(out / "td_fig_Ts.png", dpi=200), plt.close(fig)


def main():
    res = {"donnees": dict(T1=T1, P1=P1, r=R, T3=T3, eta_c=ETA_C, eta_t=ETA_T, P_net=P_NET,
                           PCI=PCI, cp=CP, gamma=G, R_air=R_AIR, eps=EPS, r_regen=R_REGEN, T0=T0)}
    res["ex1"] = ex1()
    res["ex2"] = ex2()
    res["ex3"] = ex3()
    res["ex4"] = ex4()
    res["ex5"] = ex5(res["ex2"])
    verifier(res)
    figures(res)
    (HERE / "td_results.json").write_text(json.dumps(res, indent=2))
    for k in ("ex1", "ex2", "ex3", "ex4", "ex5"):
        print(k, {kk: (round(v, 4) if isinstance(v, float) else v) for kk, v in res[k].items()})


if __name__ == "__main__":
    main()
