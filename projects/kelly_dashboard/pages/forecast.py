from __future__ import annotations
import pandas as pd
import dash
from dash import html, dcc, Input, Output, State, dash_table
from dash.exceptions import PreventUpdate
from shared import auth
import kelly_dashboard.theme as theme
import kelly_dashboard.data_loader as data_loader
import kelly_dashboard.weather_loader as weather_loader
import kelly_dashboard.holidays_loader as holidays_loader
from kelly_dashboard.warehouses import WAREHOUSES
from kelly_dashboard.components.kpi_cards import build_kpi_stat, build_kpi_row
from kelly_dashboard.components.charts import build_bar_chart, _empty_figure
from kelly_dashboard.components.weather import build_weather_strip
from kelly_dashboard.components.holidays import build_holidays_panel


# ── Helpers ───────────────────────────────────────────────────────────────────

def _id_options(df: pd.DataFrame) -> list[dict]:
    ids = sorted(df["ID"].dropna().unique())
    return [{"label": "All areas", "value": "__all__"}] + [{"label": i, "value": i} for i in ids]


def _month_options(df: pd.DataFrame) -> list[dict]:
    fct = df[df["Forecast"].notna()]
    if fct.empty:
        return [{"label": "All months", "value": "__all__"}]
    months = fct["Date"].dt.to_period("M").drop_duplicates().sort_values()
    opts = [{"label": "All months", "value": "__all__"}]
    for m in months:
        opts.append({"label": str(m), "value": str(m)})
    return opts


def _week_options(df: pd.DataFrame) -> list[dict]:
    fct = df[df["Forecast"].notna()]
    weeks = fct[["Year", "Week"]].drop_duplicates().sort_values(["Year", "Week"])
    opts = [{"label": "All weeks", "value": "__all__"}]
    for _, row in weeks.iterrows():
        opts.append({"label": f"{int(row['Year'])}-W{int(row['Week']):02d}",
                     "value": f"{int(row['Year'])}-W{int(row['Week']):02d}"})
    return opts


def _build_pivot_table(df: pd.DataFrame) -> tuple[list, list, list]:
    actual = df[df["Actual"].notna() & df["Working"]
                & (df["Actual"] < data_loader.CLOSED_THRESHOLD)].copy()
    if actual.empty:
        return [], [], []

    pivot = actual.groupby(["ID", "Year"])["Actual"].mean().unstack()
    years = sorted(pivot.columns)
    year_cols = [str(y) for y in years]
    pivot = pivot.reset_index()
    pivot.columns = ["AREA"] + year_cols

    for col in year_cols:
        pivot[col] = pivot[col].apply(lambda v: f"{v*100:.1f}%" if pd.notna(v) else "—")

    columns = [{"name": c, "id": c} for c in pivot.columns]
    data = pivot.to_dict("records")

    style = []
    for i, row in enumerate(data):
        for col in year_cols:
            val_str = row.get(col, "—")
            if val_str == "—":
                continue
            try:
                val = float(val_str.strip("%")) / 100
            except ValueError:
                continue
            style.append({
                "if": {"row_index": i, "column_id": col},
                "backgroundColor": _abs_color(val),
                "color": theme.TEXT,
                "fontWeight": "600",
            })

    return columns, data, style


def _abs_color(v: float) -> str:
    # Monochrome heat — higher absenteeism = brighter white overlay (EL style)
    if v < 0.03:
        return "rgba(255,255,255,0.06)"
    elif v < 0.05:
        return "rgba(255,255,255,0.10)"
    elif v < 0.07:
        return "rgba(255,255,255,0.16)"
    elif v < 0.10:
        return "rgba(255,255,255,0.24)"
    else:
        return "rgba(255,255,255,0.34)"


def _sidebar(warehouse_id: str, active_page: str) -> html.Div:
    wh_label = next((w["label"] for w in WAREHOUSES if w["id"] == warehouse_id), warehouse_id.title())

    return html.Div([
        html.Div([
            html.Img(src=dash.get_asset_url("logo.svg"), className="sidebar-logo-img", alt="EssilorLuxottica"),
            html.Div("PROJECT KELLY", className="sidebar-logo-title"),
            html.Div(wh_label, className="sidebar-logo-sub"),
        ], className="sidebar-logo"),
        html.Div("NAVIGATION", className="sidebar-section-label"),
        dcc.Link([html.Span(className="sidebar-dot"), " Forecast"],
                 href=dash.get_relative_path(f"/forecast/{warehouse_id}"),
                 className=f"sidebar-nav-item {'active' if active_page == 'forecast' else ''}"),
        dcc.Link([html.Span(className="sidebar-dot"), " Performance"],
                 href=dash.get_relative_path(f"/performance/{warehouse_id}"),
                 className=f"sidebar-nav-item {'active' if active_page == 'performance' else ''}"),
        # Portal ("/") sits above the "/kelly/" mount; show the Nexus link only
        # when mounted (mirrors landing.py), alongside the Kelly-internal Globe link.
        html.Div([
            (html.A("← All Projects", href="/")
             if dash.get_relative_path("/") != "/" else None),
            html.A("← Back to Globe", href=dash.get_relative_path("/")),
        ], className="sidebar-back"),
    ], className="sidebar")


# ── Layout ────────────────────────────────────────────────────────────────────

def layout(warehouse_id: str = "columbus") -> html.Div:
    wh_label = next((w["label"] for w in WAREHOUSES if w["id"] == warehouse_id), warehouse_id.title())

    return html.Div([
        _sidebar(warehouse_id, "forecast"),

        html.Div([
            # Page header
            html.Div([
                html.Div(f"{wh_label.upper()}", className="page-title"),
                html.Div("ABSENTEEISM FORECAST INTELLIGENCE", className="page-subtitle"),
            ], className="page-header"),

            # KPI row
            html.Div(id="fct-kpi-row"),

            # Weather (left) + events calendar (right) — above the graph
            html.Div([
                html.Div(id="fct-weather-strip", className="wx-col"),
                html.Div(id="fct-holidays-panel", className="cal-col"),
            ], className="wx-cal-row"),

            # Filter bar
            html.Div([
                html.Span("AREA", className="filter-label"),
                dcc.Dropdown(id="fct-area-dd", options=[], value="__all__",
                             clearable=False, style={"width": "200px"}),
                html.Span("MONTH", className="filter-label"),
                dcc.Dropdown(id="fct-month-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
                html.Span("WEEK", className="filter-label"),
                dcc.Dropdown(id="fct-week-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
            ], className="filter-bar"),

            # Bar chart
            html.Div([
                html.Div("WEEKLY FORECAST", className="chart-card-title"),
                dcc.Graph(id="fct-bar-chart", figure=_empty_figure(""),
                          config={"displayModeBar": False}),
            ], className="chart-card"),

            # Area table
            html.Div([
                html.Div("HISTORICAL ABSENTEEISM BY AREA", className="chart-card-title"),
                dash_table.DataTable(
                    id="fct-area-table",
                    style_table={"overflowX": "auto"},
                    style_header={
                        "backgroundColor": "transparent",
                        "color": theme.TEXT_DIM,
                        "fontWeight": "600",
                        "fontSize": "10px",
                        "letterSpacing": "2px",
                        "textTransform": "uppercase",
                        "border": "none",
                        "borderBottom": f"1px solid {theme.BORDER}",
                        "padding": "8px 12px",
                    },
                    style_cell={
                        "backgroundColor": "transparent",
                        "color": theme.TEXT_MED,
                        "border": "none",
                        "borderBottom": f"1px solid {theme.BORDER}",
                        "fontSize": "12px",
                        "padding": "8px 12px",
                        "fontFamily": theme.FONT,
                    },
                    style_data_conditional=[],
                    row_selectable="single",
                    selected_rows=[],
                    page_size=12,
                    style_as_list_view=True,
                ),
            ], className="chart-card"),

        ], className="main-content"),

        dcc.Store(id="fct-warehouse-id", data=warehouse_id),

    ], className="app-shell")


# ── Callbacks ─────────────────────────────────────────────────────────────────

def register_callbacks(app):

    @app.callback(
        Output("fct-weather-strip", "children"),
        Input("fct-warehouse-id", "data"),
    )
    def update_weather(warehouse_id):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            return build_weather_strip(None)
        df = weather_loader.fetch_and_store(warehouse_id)
        return build_weather_strip(df, warehouse_id)

    @app.callback(
        Output("fct-holidays-panel", "children"),
        Input("fct-warehouse-id", "data"),
    )
    def update_holidays(warehouse_id):
        warehouse_id = warehouse_id or "columbus"
        if not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        holidays = holidays_loader.get_upcoming_holidays(warehouse_id)
        return build_holidays_panel(holidays)

    @app.callback(
        Output("fct-area-dd", "options"),
        Output("fct-month-dd", "options"),
        Output("fct-week-dd", "options"),
        Output("fct-area-table", "columns"),
        Output("fct-area-table", "data"),
        Output("fct-area-table", "style_data_conditional"),
        Input("fct-warehouse-id", "data"),
    )
    def populate_controls(warehouse_id):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate
        cols, tdata, style = _build_pivot_table(df)
        return _id_options(df), _month_options(df), _week_options(df), cols, tdata, style

    @app.callback(
        Output("fct-bar-chart", "figure"),
        Output("fct-kpi-row", "children"),
        Input("fct-warehouse-id", "data"),
        Input("fct-area-dd", "value"),
        Input("fct-month-dd", "value"),
        Input("fct-week-dd", "value"),
        Input("fct-area-table", "selected_rows"),
        State("fct-area-table", "data"),
    )
    def update_chart(warehouse_id, area_val, month_val, week_val, selected_rows, table_data):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate

        if selected_rows and table_data:
            area_val = table_data[selected_rows[0]]["AREA"]
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

        return build_bar_chart(df), _build_kpis(df)


def _build_kpis(df: pd.DataFrame):
    fct = df[df["Forecast"].notna()]
    if fct.empty:
        return build_kpi_row([
            build_kpi_stat("Avg Forecast Abs", "—", "muted"),
            build_kpi_stat("Peak Forecast", "—", "muted"),
            build_kpi_stat("Biggest Abs Area", "—", "muted"),
            build_kpi_stat("Biggest Abs Day", "—", "muted"),
        ])

    avg = fct["Forecast"].mean() * 100
    peak = fct["Forecast"].max() * 100

    by_id = fct.groupby("ID")["Forecast"].mean()
    biggest_area = str(by_id.idxmax())
    if len(biggest_area) > 30:
        biggest_area = biggest_area[:30] + "…"

    by_day = fct.groupby("Date")["Forecast"].mean()
    biggest_day = pd.Timestamp(by_day.idxmax()).strftime("%d/%m/%Y")

    return build_kpi_row([
        build_kpi_stat("Avg Forecast Abs", f"{avg:.1f}%"),
        build_kpi_stat("Peak Forecast", f"{peak:.1f}%", "warn"),
        build_kpi_stat("Biggest Abs Area", biggest_area, "sm"),
        build_kpi_stat("Biggest Abs Day", biggest_day, "muted"),
    ])
