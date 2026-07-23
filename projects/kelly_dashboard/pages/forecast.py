from __future__ import annotations
import pandas as pd
import dash
from dash import html, dcc, Input, Output, dash_table
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

def _id_options(df: pd.DataFrame, warehouse_id: str | None = None) -> list[dict]:
    ids = sorted(df["ID"].dropna().unique())
    area_opts = [{"label": i, "value": i} for i in ids]
    # Sedico shows a single "General" area by default — no "All areas" aggregate.
    if warehouse_id == "sedico":
        return area_opts
    return [{"label": "All areas", "value": "__all__"}] + area_opts


def _year_options(df: pd.DataFrame) -> list[dict]:
    years = sorted(df["Year"].dropna().unique(), reverse=True)
    opts = [{"label": "All years", "value": "__all__"}]
    for y in years:
        opts.append({"label": str(int(y)), "value": str(int(y))})
    return opts


def _apply_period_filters(df: pd.DataFrame, year_val, month_val, week_val) -> pd.DataFrame:
    """Subset by Year / Month / Week filters (shared by table + bar chart)."""
    if year_val and year_val != "__all__":
        try:
            df = df[df["Year"] == int(year_val)]
        except (ValueError, TypeError):
            pass
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
    return df


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


# ── Historical filters (past Actual data — decoupled from the forecast bar) ──────

def _hist_actual(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["Actual"].notna() & df["Working"]
              & (df["Actual"] < data_loader.CLOSED_THRESHOLD)]


def _hist_year_options(df: pd.DataFrame) -> list[dict]:
    return _year_options(_hist_actual(df))


def _hist_month_options(df: pd.DataFrame) -> list[dict]:
    act = _hist_actual(df)
    opts = [{"label": "All months", "value": "__all__"}]
    if act.empty:
        return opts
    months = act["Date"].dt.to_period("M").drop_duplicates().sort_values(ascending=False)
    for m in months:
        opts.append({"label": str(m), "value": str(m)})
    return opts


def _hist_week_options(df: pd.DataFrame) -> list[dict]:
    act = _hist_actual(df)
    weeks = act[["Year", "Week"]].drop_duplicates().sort_values(["Year", "Week"], ascending=False)
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

    # Pin "General" (Sedico) to the top so it reads as the headline area.
    if (pivot["AREA"] == "General").any():
        general = pivot[pivot["AREA"] == "General"]
        rest = pivot[pivot["AREA"] != "General"]
        pivot = pd.concat([general, rest], ignore_index=True)

    for col in year_cols:
        pivot[col] = pivot[col].apply(lambda v: f"{v*100:.1f}%" if pd.notna(v) else "—")

    columns = [{"name": c, "id": c} for c in pivot.columns]
    data = pivot.to_dict("records")

    style = []
    # Bold the whole "General" row wherever it lands (top after the sort above).
    for i, row in enumerate(data):
        if row.get("AREA") == "General":
            style.append({"if": {"row_index": i}, "fontWeight": "700"})
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
    # Sedico defaults to the "General" area (no "All areas" aggregate).
    default_area = "General" if warehouse_id == "sedico" else "__all__"

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
                dcc.Dropdown(id="fct-area-dd", options=[], value=default_area,
                             clearable=False, style={"width": "200px"}),
                html.Span("YEAR", className="filter-label"),
                dcc.Dropdown(id="fct-year-dd", options=[], value="__all__",
                             clearable=False, style={"width": "110px"}),
                html.Span("MONTH", className="filter-label"),
                dcc.Dropdown(id="fct-month-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
                html.Span("WEEK", className="filter-label"),
                dcc.Dropdown(id="fct-week-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
            ], className="filter-bar"),

            # Bar chart
            html.Div([
                html.Div([
                    html.Div("FORECAST", className="chart-card-title"),
                    dcc.RadioItems(
                        id="fct-granularity",
                        options=[{"label": "Weekly", "value": "week"},
                                 {"label": "Daily", "value": "day"}],
                        value="week",
                        className="granularity-toggle",
                        inline=True,
                    ),
                ], className="chart-card-head"),
                dcc.Graph(id="fct-bar-chart", figure=_empty_figure(""),
                          config={"displayModeBar": False}),
            ], className="chart-card"),

            # Historical filter bar — independent from the forecast filters above
            # (forecast = future data; historical = past Actual).
            html.Div([
                html.Span("AREA", className="filter-label"),
                dcc.Dropdown(id="hist-area-dd", options=[], value="__all__",
                             clearable=False, style={"width": "200px"}),
                html.Span("YEAR", className="filter-label"),
                dcc.Dropdown(id="hist-year-dd", options=[], value="__all__",
                             clearable=False, style={"width": "110px"}),
                html.Span("MONTH", className="filter-label"),
                dcc.Dropdown(id="hist-month-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
                html.Span("WEEK", className="filter-label"),
                dcc.Dropdown(id="hist-week-dd", options=[], value="__all__",
                             clearable=False, style={"width": "150px"}),
            ], className="filter-bar"),

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
                    page_action="none",
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
        Output("fct-year-dd", "options"),
        Output("fct-month-dd", "options"),
        Output("fct-week-dd", "options"),
        Output("hist-area-dd", "options"),
        Output("hist-year-dd", "options"),
        Output("hist-month-dd", "options"),
        Output("hist-week-dd", "options"),
        Input("fct-warehouse-id", "data"),
    )
    def populate_controls(warehouse_id):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate
        return (
            _id_options(df, warehouse_id), _year_options(df),
            _month_options(df), _week_options(df),
            # Historical filters draw from past Actual data, keep "All areas".
            _id_options(df), _hist_year_options(df),
            _hist_month_options(df), _hist_week_options(df),
        )

    # Historical table reacts to its OWN Area/Year/Month/Week filters, fully
    # decoupled from the forecast bar (forecast = future, historical = past).
    @app.callback(
        Output("fct-area-table", "columns"),
        Output("fct-area-table", "data"),
        Output("fct-area-table", "style_data_conditional"),
        Input("fct-warehouse-id", "data"),
        Input("hist-area-dd", "value"),
        Input("hist-year-dd", "value"),
        Input("hist-month-dd", "value"),
        Input("hist-week-dd", "value"),
    )
    def update_table(warehouse_id, area_val, year_val, month_val, week_val):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate
        df = _apply_period_filters(df, year_val, month_val, week_val)
        if area_val and area_val != "__all__":
            df = df[df["ID"] == area_val]
        cols, tdata, style = _build_pivot_table(df)
        return cols, tdata, style

    @app.callback(
        Output("fct-bar-chart", "figure"),
        Output("fct-kpi-row", "children"),
        Input("fct-warehouse-id", "data"),
        Input("fct-area-dd", "value"),
        Input("fct-year-dd", "value"),
        Input("fct-month-dd", "value"),
        Input("fct-week-dd", "value"),
        Input("fct-granularity", "value"),
    )
    def update_chart(warehouse_id, area_val, year_val, month_val, week_val,
                     granularity):
        if not warehouse_id or not auth.is_authorized(warehouse_id):
            raise PreventUpdate
        df = data_loader.load_data(warehouse_id)
        if df is None:
            raise PreventUpdate

        df = _apply_period_filters(df, year_val, month_val, week_val)

        if area_val and area_val != "__all__":
            df = df[df["ID"] == area_val]

        return build_bar_chart(df, granularity), _build_kpis(df)


def _build_kpis(df: pd.DataFrame):
    # Exclude closed days (100% = weekend/holiday shutdown) so averages and the
    # peak reflect real absenteeism — mirrors the bar chart's own filtering.
    fct = df[df["Forecast"].notna() & df["Working"]
             & (df["Forecast"] < data_loader.CLOSED_THRESHOLD)]
    if fct.empty:
        return build_kpi_row([
            build_kpi_stat("Avg Forecast Abs", "—", "muted"),
            build_kpi_stat("Peak Forecast", "—", "muted"),
            build_kpi_stat("Biggest Abs Area", "—", "muted"),
            build_kpi_stat("Biggest Abs Day", "—", "muted"),
        ])

    avg = fct["Forecast"].mean() * 100

    by_id = fct.groupby("ID")["Forecast"].mean()
    biggest_area = str(by_id.idxmax())
    if len(biggest_area) > 30:
        biggest_area = biggest_area[:30] + "…"

    # Peak = highest daily-average forecast, and the day it falls on.
    by_day = fct.groupby("Date")["Forecast"].mean()
    peak = by_day.max() * 100
    peak_day = pd.Timestamp(by_day.idxmax())
    biggest_day = peak_day.strftime("%d/%m/%Y")

    return build_kpi_row([
        build_kpi_stat("Avg Forecast Abs", f"{avg:.1f}%"),
        build_kpi_stat("Peak Forecast", f"{peak:.1f}%", "warn"),
        build_kpi_stat("Biggest Abs Area", biggest_area, "sm"),
        build_kpi_stat("Biggest Abs Day", biggest_day, "muted"),
    ])
