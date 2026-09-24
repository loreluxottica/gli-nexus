# src/data — data contract and loaders

**Owns:** the typed frontend data contract and its loaders.

**Interfaces:**
- `types.ts`: authoritative payload shapes.
- `api.ts`: fetches and memoizes `/galileo/api/*.json`
  (`NEXT_PUBLIC_GALILEO_API_BASE`).
- `GalileoData.tsx`: gate that renders children only once payloads are loaded.
- `content.ts`, `contentTrends.ts`, `contentPeriods.ts`, `siteAnalysis.ts`:
  synchronous getters; they throw if used outside the gate.
- `geo.ts`: area order and labels.
- Static, hand-maintained: `story.json`, `content_comments.json`,
  `roadmap.ts`, `internationalConditions.ts`, `worldMap.ts`.

**Constraints:** protected, see `../../CONSTRAINTS.md`.
- Do not change `types.ts`, `geo.ts`, `content.ts`, `contentPeriods.ts`,
  `contentTrends.ts` or `siteAnalysis.ts` without an explicit data-contract
  request.
- Edit `story.json` and `content_comments.json` only for an explicit
  narrative or content request.
- Offline payload copies (`content.json`, `db.json`, `content_trends.json`,
  `site_analysis.json`) are gitignored: never hand-edit or commit them.
