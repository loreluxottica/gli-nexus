from __future__ import annotations
import pandas as pd
from dash import html, dcc, Input, Output
from dash.exceptions import PreventUpdate
import kelly_dashboard.theme as theme
import kelly_dashboard.data_loader as data_loader
from kelly_dashboard.warehouses import WAREHOUSES
from kelly_dashboard.components.charts import build_drift_chart, _empty_figure
from kelly_dashboard.pages.forecast import _sidebar


def _id_options(df: pd.DataFrame) -> list[dict]:
    ids = sorted(df["ID"].dropna().unique())
    return [{"label": "All areas", "value": "__all__"}] + [{"label": i, "value": i} for i in ids]


def _month_options(df: pd.DataFrame) -> list[dict]:
    drift = df[df["Actual"].notna() & df["Forecast_Vintage"].notna()]
    if drift.empty:
        return [{"label": "All months", "value": "__all__"}]
    months = drift["Date"].dt.to_period("M").drop_duplicates().sort_values(ascending=False)
    opts = [{"label": "All months", "value": "__all__"}]
    for m in months:
        opts.append({"label": str(m), "value": str(m)})
    return opts


def _week_options(df: pd.DataFrame) -> list[dict]:
    drift = df[df["Actual"].notna() & df["Forecast_Vintage"].notna()]
    weeks = drift[["Year", "Week"]].drop_duplicates().sort_values(["Year", "Week"])
    opts = [{"label": "All weeks", "value": "__all__"}]
    for _, row in weeks.iterrows():
        opts.append({"label": f"{int(row['Year'])}-W{int(row['Week']):02d}",
                     "value": f"{int(row['Year'])}-W{int(row['Week']):02d}"})
    return opts


def layout(warehouse_id: str = "columbus") -> html.Div:
    wh_label = next((w["label"] for w in WAREHOUSES if w["id"] == warehouse_id), warehouse_id.title())

    return html.Div([
        _sidebar(warehouse_id, "performance"),

        html.Div([
            html.Div([
                html.Div(f"{wh_label.upper()}", className="page-title"),
                html.Div("LAST MONTH PERFORMANCE · AI DRIFT ANALYSIS", className="page-subtitle"),
            ], className="page-header"),

            # KPI stats (no boxes)
            html.Div([
                html.Div("DRIFT METRICS", className="section-label"),
                html.Div([
                    html.Div([
                        html.Div(id="perf-kpi-actual", className="kpi-value danger"),
                        html.Div("AVERAGE ACTUAL ABS", className="kpi-label"),
                    ], className="kpi-stat"),
                    html.Div([
                        html.Div(id="perf-kpi-fct", className="kpi-value"),
                        html.Div("AI FORECAST", className="kpi-label"),
                        html.Div(id="perf-kpi-delta", style={"fontSize": "10px", "color": theme.TEXT_DIM, "marginTop": "4px"}),
                    ], className="kpi-stat"),
                ], className="kpi-row"),
            ], style={"marginBottom": "32px"}),

            # Filter bar
            html.Div([
                html.Span("AREA", className="filter-label"),
                dcc.Dropdown(id="perf-area-dd", options=[], value="__all__",
                             clearable=False, style={"width": "200px"}),
                html.Span("MONTH", className="filter-label"),
                dcc.Dropdown(id="perf-month-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
                html.Span("WEEK", className="filter-label"),
                dcc.Dropdown(id="perf-week-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
            ], className="filter-bar"),

            # Drift chart
            html.Div([
                html.Div("ACTUAL VS AI FORECAST", className="chart-card-title"),
                dcc.Graph(id="perf-drift-chart", figure=_empty_figure(""),
                          config={"displayModeBar": False}),
            ], className="chart-card"),

        ], className="main-content"),

        dcc.Store(id="perf-warehouse-id", data=warehouse_id),

    ], className="app-shell")


def register_callbacks(app):

    @app.callback(
        Output("perf-area-dd", "options"),
        Output("perf-month-dd", "options"),
        Output("perf-week-dd", "options"),
        Input("perf-warehouse-id", "data"),
    )
    def populate_controls(warehouse_id):
        if not warehouse_id:
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate
        return _id_options(df), _month_options(df), _week_options(df)

    @app.callback(
        Output("perf-drift-chart", "figure"),
        Output("perf-kpi-actual", "children"),
        Output("perf-kpi-fct", "children"),
        Output("perf-kpi-delta", "children"),
        Input("perf-warehouse-id", "data"),
        Input("perf-area-dd", "value"),
        Input("perf-month-dd", "value"),
        Input("perf-week-dd", "value"),
    )
    def update_chart(warehouse_id, area_val, month_val, week_val):
        if not warehouse_id:
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate

        if area_val and area_val != "__all__":
            df = df[df["ID"] == area_val]

        if month_val and month_val != "__all__":
            try:
                p = pd.Period(month_val, freq="M")
                df = df[(df["Date"].dt.year == p.year) & (df["Date"].dt.month == p.month)]
            except Exception:
                pass

        if week_val and week_val != "__all__":
            try:
                yr, wk = week_val.split("-W")
                df = df[(df["Year"] == int(yr)) & (df["Week"] == int(wk))]
            except (ValueError, KeyError):
                pass

        drift = df[df["Actual"].notna() & df["Forecast_Vintage"].notna()]
        avg_actual = drift["Actual"].mean() if not drift.empty else None
        avg_fct = drift["Forecast_Vintage"].mean() if not drift.empty else None

        kpi_actual = f"{avg_actual*100:.2f}%" if avg_actual is not None else "—"
        kpi_fct = f"{avg_fct*100:.2f}%" if avg_fct is not None else "—"

        if avg_actual is not None and avg_fct is not None:
            delta = (avg_fct - avg_actual) * 100
            sign = "+" if delta >= 0 else ""
            kpi_delta = f"vs actual: {sign}{delta:.2f}%"
        else:
            kpi_delta = ""

        return build_drift_chart(df), kpi_actual, kpi_fct, kpi_delta
