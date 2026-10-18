"""Rendu des équations du cours en PNG (mathtext de matplotlib, sans LaTeX)."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path(__file__).resolve().parents[1] / "figures" / "eq"
OUT.mkdir(parents=True, exist_ok=True)
plt.rcParams["mathtext.fontset"] = "cm"

EQ = {
    "bilan": r"$\dot{Q}-\dot{W}=\dot{m}\left[(h_s-h_e)+\frac{V_s^2-V_e^2}{2}+g(z_s-z_e)\right]$",
    "bilan_simpl": r"$q-w=h_s-h_e\qquad [\mathrm{J\,kg^{-1}}]$",
    "travaux": r"$w_c=h_2-h_1\qquad w_t=h_3-h_4\qquad q_{in}=h_3-h_2$",
    "rendement": r"$\eta_{th}=\frac{w_t-w_c}{q_{in}}=1-\frac{h_4-h_1}{h_3-h_2}$",
    "eta_froid": r"$\eta_{th}=1-r^{-(\gamma-1)/\gamma}\qquad r=\frac{p_2}{p_1}$",
    "ropt": r"$r_{opt}=\left(\frac{T_3}{T_1}\right)^{\gamma/[2(\gamma-1)]}$",
    "isentropiques": r"$\eta_c=\frac{h_{2s}-h_1}{h_2-h_1}\qquad \eta_t=\frac{h_3-h_4}{h_3-h_{4s}}$",
    "etats_s": r"$h_{2s}=h(p_2,\,s_1)\qquad h_{4s}=h(p_1,\,s_3)$",
    "regen": r"$\varepsilon=\frac{h_x-h_2}{h(T_4,p_2)-h_2}\qquad q_{in}=h_3-h_x$",
    "exergie": r"$\psi_{in}=w_{net}+T_0\,s_{gen,c}+T_0\,s_{gen,t}+\psi_{rej}$",
    "eta2": r"$\eta_{II}=\frac{w_{net}}{\psi_{in}}\qquad \psi_{in}=(h_3-h_2)-T_0(s_3-s_2)$",
}


def render(name, tex, size=26):
    fig = plt.figure(figsize=(0.01, 0.01))
    fig.text(0, 0, tex, fontsize=size, color="#1B3A5C")
    fig.savefig(OUT / f"{name}.png", dpi=220, bbox_inches="tight", pad_inches=0.04,
                transparent=True)
    plt.close(fig)


if __name__ == "__main__":
    for k, v in EQ.items():
        render(k, v)
    print(f"[OK] {len(EQ)} équations dans {OUT}")
