from __future__ import annotations
import sys, os as _os
# Allow running as "python app.py" from this folder
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import threading
import dash
from dash import html, dcc, Input, Output
from kelly_dashboard.pages import forecast, landing
import kelly_dashboard.theme as theme
import kelly_dashboard.weather_loader as weather_loader
from kelly_dashboard.warehouses import WAREHOUSES
from kelly_dashboard.pages import performance


def _prefetch_weather():
    for w in WAREHOUSES:
        try:
            weather_loader.fetch_and_store(w["id"])
        except Exception:
            pass

threading.Thread(target=_prefetch_weather, daemon=True).start()


_MGL = "v3.6.0"  # Mapbox GL JS (globe projection needs >= v2.9)

app = dash.Dash(
    __name__,
    suppress_callback_exceptions=True,
    title="Project Kelly — Absenteeism Forecast",
    meta_tags=[{"name": "viewport", "content": "width=device-width, initial-scale=1"}],
    external_scripts=[f"https://api.mapbox.com/mapbox-gl-js/{_MGL}/mapbox-gl.js"],
    external_stylesheets=[f"https://api.mapbox.com/mapbox-gl-js/{_MGL}/mapbox-gl.css"],
)
server = app.server  # for Databricks Apps

app.layout = html.Div([
    dcc.Location(id="url", refresh=False),
    html.Div(id="page-content"),
], style={"backgroundColor": theme.BG, "minHeight": "100vh"})


@app.callback(
    Output("page-content", "children"),
    Input("url", "pathname"),
)
def route(pathname: str):
    if not pathname or pathname == "/":
        return landing.layout()

    parts = [p for p in pathname.split("/") if p]
    # /forecast/<warehouse_id>
    if len(parts) >= 2 and parts[0] == "forecast":
        return forecast.layout(warehouse_id=parts[1])
    # /performance/<warehouse_id>
    if len(parts) >= 2 and parts[0] == "performance":
        return performance.layout(warehouse_id=parts[1])
    # /forecast (no id) → default columbus
    if parts and parts[0] == "forecast":
        return forecast.layout()
    if parts and parts[0] == "performance":
        return performance.layout()

    return landing.layout()


landing.register_callbacks(app)
forecast.register_callbacks(app)
performance.register_callbacks(app)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8050)
