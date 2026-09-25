# GLI Nexus

## What this project is
One Databricks App that serves the GLI Nexus portal at `/` and mounts each
product under its own subpath: Project Kelly `/kelly/` (Dash), Cortana
`/cortana/`, Galileo `/galileo/` and Laplace `/laplace/` (Flask blueprints).
Every page is gated by the central `user_access` grant table. Deploy steps,
environment variables and grant examples: `README.md`.

## Run
| Task | make | Direct command |
|---|---|---|
| Install | `make setup` | `pip install -r requirements.txt` then `npm --prefix projects/galileo_dashboard ci` |
| Start portal + all projects | `make dev` | `python app.py` → http://localhost:8000 |
| Galileo frontend only | — | `npm --prefix projects/galileo_dashboard run dev` (API base: `projects/galileo_dashboard/HANDOFF.md`) |

`make` is not installed on the Windows dev machines: use the direct commands.
Real data locally needs a Databricks CLI profile and a SQL warehouse id
(`README.md`); without them pages show an explicit "data unavailable" state.

## Verify
| Check | make | Direct command |
|---|---|---|
| Lint (Galileo typecheck) | `make lint` | `npm --prefix projects/galileo_dashboard run typecheck` |
| Tests | `make test` | `python -m unittest discover -s tests` |
| Repo structure | `make structure` | `node scripts/check-structure.mjs --module-root . --module-root projects --module-root projects/galileo_dashboard/src` |
| Everything | `make check` | the three rows above |

A Galileo UI change reaches production only when `npm run build` in
`projects/galileo_dashboard` regenerates the committed `out/`: Databricks Apps
does not build Node. Run it only for a change that is authorized to ship.

## Hard constraints
- Galileo data pipeline, data contracts, generated payloads and `out/` are
  protected. A general cleanup, refactor, formatting pass, dependency audit,
  code audit, dead-code removal or "fix everything" request never authorizes
  changing them. Read `projects/galileo_dashboard/CONSTRAINTS.md` before
  touching that project.
- Access control lives in `shared/auth.py` and fails closed once deployed;
  every project gates its pages on its own project key.
- No secrets in the repo: `.env` stays local, the Mapbox token comes from an app
  resource. Real data files (`*.xlsx`) and `reference/` stay untracked.
- New UI work follows the GLI Product System: Geist for UI, Sora for display,
  IBM Plex Mono for data, EssilorLuxottica endorsement in the primary shell.
  Existing apps predate it; each module doc records its current fonts.
- Docs ship with code: when a module's responsibilities, interfaces or
  constraints change, update its `ARCHITECTURE.md` / `CONSTRAINTS.md` in the
  same commit, and update `PROGRESS.md` at the end of each slice.

## Map
- `app.py` — WSGI entry: portal routes, `/api/my-access`, project mounts
- `portal/ARCHITECTURE.md` — launcher front-end served at `/`
- `shared/ARCHITECTURE.md` — access control and Databricks SQL helpers
- `projects/ARCHITECTURE.md` — how a project plugs into the app
- `projects/kelly_dashboard/ARCHITECTURE.md` — Project Kelly
- `projects/cortana_dashboard/ARCHITECTURE.md` — Cortana Usage Monitor
- `projects/galileo_dashboard/ARCHITECTURE.md` and `CONSTRAINTS.md` — Galileo Observatory
- `projects/galileo_dashboard/src/{app,components,data,lib}/ARCHITECTURE.md` — Galileo frontend
- `projects/laplace_dashboard/ARCHITECTURE.md` — Laplace Pipeline Monitor
- `tests/` — portal and Galileo contract regression tests (unittest)
- `scripts/check-structure.mjs` — vendored structure check; re-copy from the GLI skill, never edit
- `PROGRESS.md` — done, in progress, blocked
