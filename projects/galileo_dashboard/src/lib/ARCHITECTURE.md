# src/lib — view helpers

**Owns:** pure, additive helpers for the UI: `format.ts` (number and percent
formatting, sign and trend glyph), `contentMetrics.ts` (pieces, shipments and
efficiency values and series per market), `tags.ts` (domain value to tag
tone), `products.ts` (product order and labels, plus the display-only
Content row label: EMEA shows `Frames · GV Frames*` as
`GV · Frames, Contact Lenses, Lenses`), `features.ts` (build-time
feature switches).

**Interfaces:** imported by components and routes; no data fetching and no
side effects.

**Constraints:** view-only semantics. Never change source units, `null` versus
`0`, geo attribution or the REP/LM split. Efficiency is always pieces ÷
shipments of the same market.
