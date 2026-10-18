"""Figures du cours (déterministes, recalculées à partir de brayton.py)."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

import brayton as b

OUT = Path(__file__).resolve().parents[1] / "figures"
OUT.mkdir(exist_ok=True)
NAVY, ORANGE, TEAL, GREY, RED = "#1B3A5C", "#E07A1F", "#2A9D8F", "#8A99A8", "#C0392B"
plt.rcParams.update({"axes.formatter.use_locale": False, "font.size": 15, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.3, "font.family": "DejaVu Sans"})
T1, T3, R = 288.15, 1400.0, 12.0


def isobare(p, Ta, Tb, n=60):
    T = np.linspace(Ta, Tb, n)
    return [b.s_Tp(t, p) / 1e3 for t in T], T


def fig_Ts():
    ideal = b.cycle_coolprop(R, T1, T3)
    reel = b.cycle_coolprop(R, T1, T3, eta_c=0.86, eta_t=0.89)
    fig, ax = plt.subplots(figsize=(9, 6.2))
    for p, lab in ((b.P0, "p₁ = 1,013 bar"), (R * b.P0, "p₂ = 12,16 bar")):
        s, T = isobare(p, 250, 1500)
        ax.plot(s, T, color=GREY, lw=1, ls="--")
        ax.annotate(lab, (s[-1], T[-1]), fontsize=12, color=GREY, ha="right", va="bottom")
    for res, col, lab in ((ideal, NAVY, "idéal (isentropique)"), (reel, ORANGE, "réel (ηc = 0,86 ; ηt = 0,89)")):
        e = res.etats
        p1, p2 = e[0]["p"], e[1]["p"]
        # 1->2 et 3->4 tracés comme segments droits (évolution réelle non quasi statique)
        s23, T23 = isobare(p2, e[1]["T"], e[2]["T"])
        s41, T41 = isobare(p1, e[3]["T"], e[0]["T"])
        ax.plot([e[0]["s"] / 1e3, e[1]["s"] / 1e3], [e[0]["T"], e[1]["T"]], color=col, lw=2.5,
                ls="-" if res is ideal else ":")
        ax.plot(s23, T23, color=col, lw=2.5, label=lab)
        ax.plot([e[2]["s"] / 1e3, e[3]["s"] / 1e3], [e[2]["T"], e[3]["T"]], color=col, lw=2.5,
                ls="-" if res is ideal else ":")
        ax.plot(s41, T41, color=col, lw=2.5)
        for st in e:
            ax.plot(st["s"] / 1e3, st["T"], "o", color=col, ms=7)
            tag = st["nom"] + ("s" if res is ideal and st["nom"] in "24" else "")
            if res is ideal and st["nom"] in "13":
                tag = st["nom"]
            if res is reel and st["nom"] in "13":
                continue
            ax.annotate(tag, (st["s"] / 1e3, st["T"]), xytext=(8, -4), textcoords="offset points",
                        fontsize=15, color=col, weight="bold")
    ax.set_xlabel("s  [kJ/(kg·K)]  (référence CoolProp)")
    ax.set_ylabel("T  [K]")
    ax.set_ylim(200, 1550)
    ax.legend(loc="upper left", fontsize=13, frameon=False)
    fig.tight_layout()
    fig.savefig(OUT / "fig_Ts.png", dpi=200)
    plt.close(fig)


def fig_parametrique():
    r = np.linspace(2, 40, 120)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 5.6))
    for T3_, col in ((1200, TEAL), (1400, NAVY), (1600, ORANGE)):
        eta, w = [], []
        for ri in r:
            res = b.cycle_coolprop(ri, T1, T3_, eta_c=0.86, eta_t=0.89)
            eta.append(res.eta * 100), w.append(res.w_net / 1e3)
        a1.plot(r, eta, color=col, lw=2.5, label=f"T₃ = {T3_} K")
        a2.plot(r, w, color=col, lw=2.5, label=f"T₃ = {T3_} K")
        i = int(np.argmax(w))
        a2.plot(r[i], w[i], "o", color=col)
    ideal = [b.cycle_coolprop(ri, T1, 1400).eta * 100 for ri in r]
    a1.plot(r, ideal, color=GREY, ls="--", lw=1.8, label="idéal, T₃ = 1400 K")
    a1.set_xlabel("rapport de pression r  [–]"), a1.set_ylabel("rendement thermique η  [%]")
    a2.set_xlabel("rapport de pression r  [–]"), a2.set_ylabel("travail net w_net  [kJ/kg]")
    a1.legend(fontsize=12, frameon=False), a2.legend(fontsize=12, frameon=False)
    a1.set_ylim(0, 65), a2.set_ylim(0, 500)
    fig.tight_layout()
    fig.savefig(OUT / "fig_parametrique.png", dpi=200)
    plt.close(fig)


def fig_regen():
    r = np.linspace(2, 30, 120)
    simple, reg, rr = [], [], []
    for ri in r:
        s = b.cycle_coolprop(ri, T1, T3, eta_c=0.86, eta_t=0.89)
        simple.append(s.eta * 100)
        try:
            reg.append(b.cycle_coolprop(ri, T1, T3, eta_c=0.86, eta_t=0.89, eps_regen=0.8).eta * 100)
            rr.append(ri)
        except ValueError:  # T4 <= T2 : régénération impossible
            pass
    fig, ax = plt.subplots(figsize=(9, 5.8))
    ax.plot(r, simple, color=NAVY, lw=2.5, label="cycle simple")
    ax.plot(rr, reg, color=ORANGE, lw=2.5, label="régénératif, ε = 0,80")
    ax.axvline(rr[-1], color=RED, ls=":", lw=1.5)
    ax.annotate(f"T₄ = T₂ à r ≈ {rr[-1]:.0f}\n(régénération inutile au-delà)", (rr[-1], 15),
                xytext=(-12, 0), textcoords="offset points", ha="right", fontsize=12, color=RED)
    for ri, col in ((6, ORANGE), (12, ORANGE)):
        x = b.cycle_coolprop(ri, T1, T3, eta_c=0.86, eta_t=0.89, eps_regen=0.8).eta * 100
        ax.plot(ri, x, "o", color=col, ms=8)
        ax.annotate(f"{x:.1f} %".replace(".", ","), (ri, x), xytext=(6, 6), textcoords="offset points", fontsize=12)
    ax.set_xlabel("rapport de pression r  [–]"), ax.set_ylabel("rendement thermique η  [%]")
    ax.set_ylim(0, 60), ax.legend(frameon=False, fontsize=13)
    fig.tight_layout()
    fig.savefig(OUT / "fig_regen.png", dpi=200)
    plt.close(fig)
    return rr[-1]


def fig_exergie():
    ex = b.bilan_exergie(b.cycle_coolprop(R, T1, T3, eta_c=0.86, eta_t=0.89))
    labels = ["Exergie reçue\nψ_in", "Destruction\ncompresseur", "Destruction\nturbine",
              "Perte gaz\nd'échappement", "Travail net\nw_net"]
    vals = [ex["psi_in"], ex["Ed_c"], ex["Ed_t"], ex["psi_rej"], ex["w_net"]]
    vals = [v / 1e3 for v in vals]
    fig, ax = plt.subplots(figsize=(10, 5.6))
    base = vals[0]
    ax.bar(0, vals[0], color=NAVY)
    level = base
    for i, v in enumerate(vals[1:4], start=1):
        ax.bar(i, v, bottom=level - v, color=[RED, RED, ORANGE][i - 1])
        level -= v
    ax.bar(4, vals[4], color=TEAL)
    for i, v in enumerate(vals):
        y = vals[0] if i == 0 else (vals[4] if i == 4 else None)
        txt = f"{v:.1f}\n({v / vals[0] * 100:.1f} %)".replace(".", ",")
        top = [vals[0], vals[0], vals[0] - vals[1], vals[0] - vals[1] - vals[2], vals[4]][i]
        ax.text(i, top + 12, txt, ha="center", fontsize=12)
    ax.set_xticks(range(5), labels, fontsize=12)
    ax.set_ylabel("exergie  [kJ/kg d'air]")
    ax.set_ylim(0, 760)
    ax.grid(axis="x")
    fig.tight_layout()
    fig.savefig(OUT / "fig_exergie.png", dpi=200)
    plt.close(fig)


def fig_cp():
    T = np.linspace(250, 1800, 100)
    cp = [b.PropsSI("Cpmass", "T", t, "P", 101325, "Air") / 1e3 for t in T]
    fig, ax = plt.subplots(figsize=(8, 5.2))
    ax.plot(T, cp, color=NAVY, lw=2.5, label="CoolProp (Lemmon 2000), 1 bar")
    ax.axhline(1.005, color=ORANGE, ls="--", lw=2, label="air standard froid : 1,005")
    ax.set_xlabel("T  [K]"), ax.set_ylabel("cp  [kJ/(kg·K)]")
    ax.legend(frameon=False, fontsize=13)
    fig.tight_layout()
    fig.savefig(OUT / "fig_cp.png", dpi=200)
    plt.close(fig)


if __name__ == "__main__":
    fig_Ts(); fig_parametrique(); r_lim = fig_regen(); fig_exergie(); fig_cp()
    print(f"[OK] figures écrites dans {OUT} ; limite régénération r ≈ {r_lim:.1f}")
