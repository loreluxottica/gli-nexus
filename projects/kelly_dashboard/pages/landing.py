from __future__ import annotations
from dash import html, dcc, Input, Output, ClientsideFunction
import kelly_dashboard.theme as theme
from kelly_dashboard.warehouses import WAREHOUSES


def layout() -> html.Div:
    return html.Div([
        dcc.Location(id="landing-url", refresh=True),

        html.Div([
            html.Div([
                html.Img(src="/assets/logo.svg", className="globe-logo-img", alt="EssilorLuxottica"),
                html.Div("PROJECT KELLY", className="globe-title"),
                html.Div("ABSENTEEISM FORECAST INTELLIGENCE SYSTEM", className="globe-subtitle"),
            ]),
            html.Div([
                html.Span("◆", style={
                    "color": theme.TEXT, "marginRight": "8px", "fontSize": "8px",
                    "verticalAlign": "middle",
                }),
                html.Span("SELECT FACILITY TO ACCESS DASHBOARD", style={
                    "color": theme.TEXT_DIM, "fontSize": "10px",
                    "letterSpacing": "2px", "textTransform": "uppercase",
                }),
            ]),
        ], className="globe-header"),

        # Mapbox GL globe (initialized clientside in assets/mapbox_globe.js)
        html.Div(id="mapbox-globe", className="mapbox-globe"),

        html.Div("CLICK ON A LOCATION MARKER TO OPEN FACILITY DASHBOARD",
                 className="globe-hint"),

        dcc.Store(id="globe-cfg", data={
            "token": theme.MAPBOX_TOKEN,
            "style": theme.MAPBOX_STYLE,
            "warehouses": WAREHOUSES,
        }),
        html.Div(id="globe-dummy", style={"display": "none"}),

    ], className="globe-landing")


def register_callbacks(app):
    app.clientside_callback(
        ClientsideFunction(namespace="mapboxGlobe", function_name="init"),
        Output("globe-dummy", "children"),
        Input("globe-cfg", "data"),
    )
