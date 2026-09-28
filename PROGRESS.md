# Progress

## Done
- 2026-09-28 Cleanup verified locally: 74 unittest cases, frontend typecheck, unified/standalone dependency dry-runs, pip check and structure check pass. Checkout reduced from 364 to 332 files (about 30% smaller); protected Galileo paths and access-control implementation unchanged.
- 2026-09-28 Asset consolidation: removed 33 byte-identical image/font copies and the redundant font ZIP (6,323,220 bytes). Canonical assets, unique intake material and all eleven legacy branding URLs preserved.
- 2026-09-28 Kelly caches: one daily forecast frame per plant, concurrent misses coalesced per plant, unavailable data still retryable; holiday failures logged with a 30-second retry window instead of a permanent empty calendar.
- 2026-09-28 Source cleanup: removed the unreferenced Coverage TopSiteCard and exclusive CSS; optional roadmap and compatibility routes retained. Galileo pipeline, data contracts, payloads and deployment export unchanged.
- 2026-09-28 Tooling: shared Python requirements declared once with version ranges unchanged; TypeScript unused-symbol checks and lint alias enabled. GitHub Actions CI deferred at the user's request; all local regressions, typecheck and Makefile checks retained.
- 2026-09-28 Docs aligned with runtime data loading, gated Galileo assets, Kelly navigation and Laplace volume reads. Historical implementation notes consolidated here; module contracts remain next to code.
- 2026-09-28 Galileo Content/Sites and connected Database investigation merged into main, with scoped search/comparison, CSV, return navigation, compact controls and responsive table. Existing approved export retained; product brief and synthetic browser evidence in `.gli/brief.md`.
- 2026-09-25 Galileo shared comments and metric explorer implemented and exported; comments require the deployment grant below.
- 2026-09-24 Repo entry, module docs, Makefile and vendored structure checker established.

## In progress
- None. Cleanup on `clean/light` is ready for review; no production deployment performed.

## Blocked
- Galileo comments table: run `projects/galileo_dashboard/comments_table.sql` and grant the app service principal before deploying; until then the panel says shared comments are unavailable.
- Python lint: no linter configured, so `make lint` only type-checks Galileo. Unblocks when the team picks a tool and adds it to the dev requirements.
- Product brief: Galileo site-exploration job and outcome confirmed in `.gli/brief.md`; broader product audiences and organizational roles remain unconfirmed.
- GLI fonts: portal and Kelly use Avenir LT Std, Galileo Schibsted Grotesk and Spline Sans Mono, not Geist / Sora / IBM Plex Mono. Needs an explicit design task.
- Laplace publish path: `publish_to_nexus.py` writes the `laplace_report` table, `server.py` reads a volume. Needs the notebook owner to confirm the live path.
- Live Databricks and internal-network journeys require staging access. Local checks use synthetic sources and do not establish production service availability.
