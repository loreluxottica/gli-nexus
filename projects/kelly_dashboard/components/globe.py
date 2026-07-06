from __future__ import annotations
import plotly.graph_objects as go
import kelly_dashboard.theme as theme
from kelly_dashboard.warehouses import WAREHOUSES


def build_globe_figure(selected_id: str | None = None, full_page: bool = False) -> go.Figure:
    fig = go.Figure()

    # Base markers
    for w in WAREHOUSES:
        is_selected = w["id"] == selected_id
        has_data = w["file"] is not None
        color = theme.ACCENT if (has_data or True) else theme.TEXT_DIM  # all active (mock data fills rest)
        size = 18 if is_selected else 13
        opacity = 1.0

        fig.add_trace(go.Scattergeo(
            lat=[w["lat"]],
            lon=[w["lon"]],
            text=w["city"],
            customdata=[w["id"]],
            mode="markers+text",
            textposition="top center",
            textfont=dict(color=theme.TEXT_DIM, size=11, family=theme.FONT),
            marker=dict(
                size=size,
                color=color,
                symbol="circle",
                opacity=opacity,
                line=dict(
                    width=2,
                    color=theme.ACCENT if is_selected else "rgba(255,251,249,0.25)",
                ),
            ),
            hovertemplate=f"{w['city']}<extra></extra>",
            showlegend=False,
        ))

        # Pulse ring for selected
        if is_selected:
            fig.add_trace(go.Scattergeo(
                lat=[w["lat"]],
                lon=[w["lon"]],
                mode="markers",
                marker=dict(
                    size=36,
                    color="rgba(243,119,122,0.15)",
                    symbol="circle",
                    line=dict(width=1.5, color=theme.ACCENT),
                ),
                hoverinfo="skip",
                showlegend=False,
            ))

    height = None if full_page else 380
    width = None if full_page else None

    fig.update_geos(
        projection_type="orthographic",
        projection_rotation=dict(lon=-30, lat=20),
        projection_scale=1.0,
        showland=True,
        landcolor="#1C1D24",
        showocean=True,
        oceancolor="#06070F",
        showcoastlines=True,
        coastlinecolor="rgba(255,251,249,0.15)",
        showcountries=True,
        countrycolor="rgba(255,251,249,0.15)",
        showframe=False,
        bgcolor="rgba(0,0,0,0)",
        showlakes=False,
        showrivers=False,
    )

    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=0, r=0, t=0, b=0),
        height=height,
        width=None,
        autosize=True,
        dragmode="pan",
        geo=dict(
            bgcolor="rgba(0,0,0,0)",
            domain=dict(x=[0, 1], y=[0, 1]),
        ),
    )

    return fig
