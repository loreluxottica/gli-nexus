# EssilorLuxottica internal-dashboard design system — monochrome black/white
BG        = "#000000"                   # pure black
BG2       = "#0a0a0a"                   # near-black (hoverlabel)
SIDEBAR   = "#000000"                   # black
CARD      = "rgba(255,255,255,0.10)"    # white-10 glass
CARD2     = "rgba(255,255,255,0.16)"    # lighter glass
BORDER    = "rgba(255,255,255,0.85)"    # white hairline
ACCENT    = "#FFFFFF"                   # no color — white
INFO      = "#87888c"                   # gray-3 (secondary series / grid)
POSITIVE  = "#FFFFFF"                   # monochrome
WARN      = "#FFFFFF"                   # monochrome
NEGATIVE  = "#FFFFFF"                   # monochrome
TEXT      = "#FFFFFF"                   # white
TEXT_DIM  = "#87888c"                   # gray-3
TEXT_MED  = "#FFFFFF"                   # white
FONT      = "'Avenir LT Std', 'Segoe UI', sans-serif"
FONT_DATA = "'Avenir LT Std', 'Segoe UI', monospace"

import os


def _find_env() -> str | None:
    """Search upward from this file for a .env, so secrets load whether Kelly
    runs standalone or mounted under the GLI Nexus portal (nested one level
    deeper). Returns the first .env found, else None."""
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        candidate = os.path.join(d, ".env")
        if os.path.exists(candidate):
            return candidate
        parent = os.path.dirname(d)
        if parent == d:            # reached filesystem root
            return None
        d = parent


def _load_env() -> None:
    """Minimal .env loader so secrets stay out of source control."""
    env_path = _find_env()
    if not env_path:
        return
    with open(env_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_env()

# Mapbox — token + custom style. Configure via .env (see .env.example); never commit
# the real token. Without a token the globe falls back to a default Mapbox style.
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")
MAPBOX_STYLE = os.environ.get("MAPBOX_STYLE", "mapbox://styles/mapbox/dark-v11")

CHART_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color=TEXT_DIM, family=FONT, size=12),
    margin=dict(l=52, r=20, t=36, b=52),
    xaxis=dict(
        gridcolor="rgba(255,255,255,0.12)",
        zerolinecolor="rgba(255,255,255,0.12)",
        tickfont=dict(color=TEXT_DIM, size=11, family=FONT),
        linecolor="#87888c",
    ),
    yaxis=dict(
        gridcolor="rgba(255,255,255,0.12)",
        zerolinecolor="rgba(255,255,255,0.12)",
        tickfont=dict(color=TEXT_DIM, size=11, family=FONT),
        linecolor="#87888c",
    ),
    hoverlabel=dict(
        bgcolor=BG2,
        bordercolor=BORDER,
        font=dict(color=TEXT, family=FONT, size=12),
    ),
)
