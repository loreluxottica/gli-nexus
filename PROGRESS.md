# Progress

## Done
- 2026-09-25 Galileo Sites controls: search and ordering share one row; the selection sentence is replaced by a count badge, row tint and filtered count. Authorized `out/` rebuild completed.
- 2026-09-25 Galileo Sites header: area, market, category and sub-category combined in the title; context subtitle and flow-total strip removed, with the recovered height assigned to the site list. Period controls and scoped calculations preserved; authorized `out/` rebuild completed.
- 2026-09-25 Galileo Content sites: approved layout B implemented at `content/sites`, with all-site search, size/change sorting, scoped detail, persistent selection and side-by-side comparison. Existing data contracts unchanged; source verified with synthetic browser fixtures and helper regressions.
- 2026-09-24 Galileo Content: Pieces, Shipments and Pcs/ship side by side; Metric toggle and Coverage column removed; `out/` rebuilt.
- 2026-09-24 Repo structure: `AGENTS.md` entry, a doc in every module, `PROGRESS.md`, `Makefile`, vendored `scripts/check-structure.mjs`.
- 2026-09-25 Galileo shared comments: API, Delta-table store, `CommentPanel` on the server, 12 tests (branch `fix/comments`).
- 2026-09-25 Galileo metric explorer: trend chart at real width, "Where the change comes from" area list on one shared scale, phone layout (PR #20).
- 2026-09-25 Galileo Content table: fixed column widths and row heights, so REP ↔ LM no longer shifts the layout; narrower Sub-category, wider trends (PR #21).
- 2026-09-25 Galileo `out/` rebuilt on `fix/finetuning` (PR #21): ships shared comments, metric explorer and the Content table layout.
- 2026-09-25 Galileo Content, EMEA: the GV row shows as `GV · Frames, Contact Lenses, Lenses` (label only; the `Frames|GV Frames*` key and data are unchanged); `out/` rebuilt (branch `tune/emea`).

## In progress
- Branch `data/aggregationview`: site workspace and authorized `out/` rebuild ready for review and merge. Live Databricks data not exercised locally. Brief: `.gli/brief.md`.

## Blocked
- Galileo comments table: run `projects/galileo_dashboard/comments_table.sql` and grant the app service principal before deploying; until then the panel says shared comments are unavailable.
- Python lint: no linter configured, so `make lint` only type-checks Galileo. Unblocks when the team picks a tool and adds it to the dev requirements.
- Product brief: Galileo site-exploration job and outcome confirmed in `.gli/brief.md`; broader product audiences and organizational roles remain unconfirmed.
- GLI fonts: portal and Kelly use Avenir LT Std, Galileo Schibsted Grotesk and Spline Sans Mono, not Geist / Sora / IBM Plex Mono. Needs an explicit design task.
- Stale docs: root `README.md` says Galileo data is baked at build time, Laplace reads a table and Cortana uses `str.format`; the code no longer does. Needs a doc update pass.
- Laplace publish path: `publish_to_nexus.py` writes the `laplace_report` table, `server.py` reads a volume. Needs the notebook owner to confirm the live path.
