# Repository working rules

## Galileo data-pipeline protection

Before changing `projects/galileo_dashboard/`, read
`projects/galileo_dashboard/DATA_PIPELINE_READTHROUGH.md`.

The Galileo ingestion, extraction, transformation, and frontend data contracts
are protected. A general cleanup, refactor, formatting pass, dependency audit,
code audit, dead-code removal, or "fix everything" request does **not** authorize
changes to them.

Unless the user explicitly asks to change the Galileo data pipeline or one of
its contracts, do not edit, move, rename, delete, reformat, or "simplify":

- `projects/galileo_dashboard/data_pipeline/*.py`
- `projects/galileo_dashboard/reference-data-pipeline/**`
- `projects/galileo_dashboard/src/data/types.ts`
- `projects/galileo_dashboard/src/data/geo.ts`
- `projects/galileo_dashboard/src/data/content.ts`
- `projects/galileo_dashboard/src/data/contentPeriods.ts`
- `projects/galileo_dashboard/src/data/contentTrends.ts`
- `projects/galileo_dashboard/src/data/siteAnalysis.ts`
- generated `projects/galileo_dashboard/src/data/content.json`
- generated `projects/galileo_dashboard/src/data/db.json`
- generated `projects/galileo_dashboard/src/data/content_trends.json`
- generated `projects/galileo_dashboard/src/data/site_analysis.json`
- hand-authored `content_comments.json` and `story.json` during any generic
  cleanup; edit them only for an explicit narrative/content request
- the committed deployment artifact `projects/galileo_dashboard/out/**`

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
