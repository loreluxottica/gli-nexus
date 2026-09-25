# galileo_dashboard — constraints

Before changing this project, read `DATA_PIPELINE_READTHROUGH.md`.

## Galileo data-pipeline protection

The Galileo ingestion, extraction, transformation, and frontend data contracts
are protected. A general cleanup, refactor, formatting pass, dependency audit,
code audit, dead-code removal, or "fix everything" request does **not** authorize
changes to them.

Unless the user explicitly asks to change the Galileo data pipeline or one of
its contracts, do not edit, move, rename, delete, reformat, or "simplify":

- `data_pipeline/*.py`
- `reference-data-pipeline/**`
- `src/data/types.ts`
- `src/data/geo.ts`
- `src/data/content.ts`
- `src/data/contentPeriods.ts`
- `src/data/contentTrends.ts`
- `src/data/siteAnalysis.ts`
- generated `src/data/content.json`
- generated `src/data/db.json`
- generated `src/data/content_trends.json`
- generated `src/data/site_analysis.json`
- hand-authored `src/data/content_comments.json` and `src/data/story.json`
  during any generic cleanup; edit them only for an explicit narrative/content
  request
- the committed deployment artifact `out/**`

For audits, inspect these paths read-only and report findings without applying
fixes. Do not hand-edit generated JSON or `out/`; they may change only through
an explicitly authorized pipeline regeneration and Next.js build.

Frontend features should normally be implemented in `src/components/`, route
composition in `src/app/`, component styles, or additive selectors/helpers in
`src/lib/`. Consume the existing typed data contract without changing its
meaning. If a feature truly needs a new source column, aggregation, table, JSON
field, tuple position, geographical rule, or reporting-window rule, stop and
ask for an explicit data-contract change request.

The deleted temporary Databricks upload notebook must not be recreated,
optimized, or replaced during cleanup work. Its required behavior is preserved
as the immutable upstream contract in `DATA_PIPELINE_READTHROUGH.md`.

## Shipping a frontend change

`out/` is the static shell that `server.py` serves as-is; Databricks Apps does
not run a Node build. A change under `src/` is live only after an authorized
`npm run build` regenerates `out/` and that `out/` is committed. `make check`
never builds.
