from __future__ import annotations
import plotly.graph_objects as go
import pandas as pd
import kelly_dashboard.theme as theme
from kelly_dashboard.data_loader import CLOSED_THRESHOLD


def build_bar_chart(df: pd.DataFrame | None, granularity: str = "week") -> go.Figure:
    """Avg Forecast % by ISO week (or by day) — future data only."""
    if df is None or df.empty:
        return _empty_figure("No forecast data available")

    fct = df[df["Forecast"].notna() & df["Working"] & (df["Forecast"] < CLOSED_THRESHOLD)].copy()
    if fct.empty:
        return _empty_figure("No forecast data available")

    if granularity == "day":
        grouped = (
            fct.groupby("Date")["Forecast"].mean().reset_index().sort_values("Date")
        )
        grouped["label"] = grouped["Date"].dt.strftime("%d/%m")
        x_title = "Day"
    else:
        grouped = (
            fct.groupby(["Year", "Week"])["Forecast"]
            .mean()
            .reset_index()
            .sort_values(["Year", "Week"])
        )
        grouped["label"] = grouped.apply(lambda r: f"W{int(r['Week'])}", axis=1)
        x_title = "Week"
    grouped["pct"] = grouped["Forecast"] * 100

    pct_list = grouped["pct"].tolist()

    # Highlight the current week in gold — every day of it in the daily view,
    # the single W## bar in the weekly view.
    today = pd.Timestamp.today().normalize()
    week_start = today - pd.Timedelta(days=today.weekday())  # Monday of this week
    week_end = week_start + pd.Timedelta(days=6)             # Sunday of this week
    if granularity == "day":
        d = grouped["Date"].dt.normalize()
        is_current = (d >= week_start) & (d <= week_end)
    else:
        iso = today.isocalendar()
        is_current = (grouped["Year"] == today.year) & (grouped["Week"] == iso.week)
    bar_colors = [theme.GOLD if cur else theme.TEXT for cur in is_current]

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=grouped["label"],
        y=pct_list,
        marker=dict(
            color=bar_colors,   # white bars, current period gold
            opacity=0.92,
            line=dict(width=0),
        ),
        text=[f"{v:.1f}%" for v in pct_list],
        textposition="outside",
        textfont=dict(color=theme.TEXT_DIM, size=10, family=theme.FONT),
        hovertemplate="<b>%{x}</b><br>Avg Forecast: %{y:.2f}%<extra></extra>",
    ))

    layout = {**theme.CHART_LAYOUT}
    layout["yaxis"] = {
        **theme.CHART_LAYOUT["yaxis"],
        "ticksuffix": "%",
        "range": [0, max(max(pct_list) * 1.4, 5)],
        "title": dict(text="Absenteeism %", font=dict(color=theme.TEXT_DIM, size=10)),
    }
    layout["xaxis"] = {
        **theme.CHART_LAYOUT["xaxis"],
        "title": dict(text=x_title, font=dict(color=theme.TEXT_DIM, size=10)),
    }
    layout["bargap"] = 0.4
    layout["height"] = 280
    fig.update_layout(**layout)
    return fig


def build_drift_chart(df: pd.DataFrame | None, granularity: str = "week",
                      warehouse_id: str | None = None) -> go.Figure:
    """Actual (red) vs Forecast_Vintage (cyan dashed) — AI drift view."""
    if df is None or df.empty:
        return _empty_figure("No drift data available")

    drift = df[df["Actual"].notna() & df["Forecast_Vintage"].notna()
               & df["Working"] & (df["Actual"] < CLOSED_THRESHOLD)].copy()
    if drift.empty:
        return _empty_figure("No overlapping Actual / Forecast_Vintage data")

    if granularity == "day":
        grouped = (
            drift.groupby("Date")
            .agg(Actual=("Actual", "mean"), Forecast_Vintage=("Forecast_Vintage", "mean"))
            .reset_index()
            .sort_values("Date")
        )
        grouped["label"] = grouped["Date"].dt.strftime("%d/%m")
    else:
        grouped = (
            drift.groupby(["Year", "Week"])
            .agg(Actual=("Actual", "mean"), Forecast_Vintage=("Forecast_Vintage", "mean"))
            .reset_index()
            .sort_values(["Year", "Week"])
        )
        grouped["label"] = grouped.apply(lambda r: f"W{int(r['Week'])}", axis=1)
    grouped["act_pct"] = grouped["Actual"] * 100
    grouped["fct_pct"] = grouped["Forecast_Vintage"] * 100

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=grouped["label"].tolist(),
        y=grouped["act_pct"].tolist(),
        name="ACTUAL",
        mode="lines+markers",
        line=dict(color=theme.NEGATIVE, width=2),
        marker=dict(color=theme.NEGATIVE, size=7, symbol="circle",
                    line=dict(width=1, color=theme.BG2)),
        hovertemplate="<b>%{x}</b><br>Actual: %{y:.2f}%<extra></extra>",
    ))

    fig.add_trace(go.Scatter(
        x=grouped["label"].tolist(),
        y=grouped["fct_pct"].tolist(),
        name="AI FORECAST (PREV. MONTH)",
        mode="lines+markers",
        line=dict(color=theme.GOLD, width=2, dash="dash"),
        marker=dict(color=theme.GOLD, size=7, symbol="x",
                    line=dict(width=1.5, color=theme.GOLD)),
        hovertemplate="<b>%{x}</b><br>Forecast: %{y:.2f}%<extra></extra>",
    ))

    layout = {**theme.CHART_LAYOUT}
    layout["legend"] = dict(
        orientation="h",
        x=0.5, xanchor="center",
        y=1.1,
        font=dict(color=theme.TEXT_MED, size=10, family=theme.FONT),
        bgcolor="rgba(0,0,0,0)",
    )
    y_range = [10, 60] if warehouse_id == "sedico" else [0, 100]
    layout["yaxis"] = {
        **theme.CHART_LAYOUT["yaxis"],
        "ticksuffix": "%",
        "range": y_range,
        "title": dict(text="Absenteeism %", font=dict(color=theme.TEXT_DIM, size=10)),
    }
    layout["height"] = 360
    layout["margin"] = dict(l=48, r=24, t=56, b=48)
    fig.update_layout(**layout)
    return fig


def _empty_figure(msg: str) -> go.Figure:
    fig = go.Figure()
    fig.add_annotation(
        text=msg,
        xref="paper", yref="paper",
        x=0.5, y=0.5,
        showarrow=False,
        font=dict(color=theme.TEXT_DIM, size=12, family=theme.FONT),
    )
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=20, r=20, t=20, b=20),
        height=280,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
    )
    return fig
