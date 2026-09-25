# Progress

## Done
- 2026-09-24 Galileo Content: Pieces, Shipments and Pcs/ship side by side; Metric toggle and Coverage column removed; `out/` rebuilt.
- 2026-09-24 Repo structure: `AGENTS.md` entry, a doc in every module, `PROGRESS.md`, `Makefile`, vendored `scripts/check-structure.mjs`.
- 2026-09-25 Galileo shared comments: API, Delta-table store, `CommentPanel` on the server, 12 tests (branch `fix/comments`).
- 2026-09-25 Galileo metric explorer: trend chart at real width, "Where the change comes from" area list on one shared scale, phone layout (branch `feat/explorer-clarity`).
- 2026-09-25 Galileo Content table: fixed column widths and row heights, so REP ↔ LM no longer shifts the layout; narrower Sub-category, wider trends (branch `fix/finetuning`).
- 2026-09-25 Galileo `out/` rebuilt on `fix/finetuning`: ships shared comments, metric explorer and the Content table layout.

## In progress
- Branch `fix/finetuning`: Content table layout and rebuilt `out/` awaiting review and merge; live after merge and a Databricks redeploy.

## Blocked
- Galileo comments table: run `projects/galileo_dashboard/comments_table.sql` and grant the app service principal before deploying; until then the panel says shared comments are unavailable.
- Python lint: no linter configured, so `make lint` only type-checks Galileo. Unblocks when the team picks a tool and adds it to the dev requirements.
- Product brief `.gli/brief.md`: not written; needs audience, job and outcome confirmed by the product owners.
- GLI fonts: portal and Kelly use Avenir LT Std, Galileo Schibsted Grotesk and Spline Sans Mono, not Geist / Sora / IBM Plex Mono. Needs an explicit design task.
- Stale docs: root `README.md` says Galileo data is baked at build time, Laplace reads a table and Cortana uses `str.format`; the code no longer does. Needs a doc update pass.
- Laplace publish path: `publish_to_nexus.py` writes the `laplace_report` table, `server.py` reads a volume. Needs the notebook owner to confirm the live path.
