# GLI Nexus - Galileo product context

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

Galileo users inspect logistics flows from Content, both for quick site
lookups and for deeper exploration across sites. They need to find a named
site beyond the current top-three drivers and compare selected sites.
Specific organizational roles are not yet confirmed.

## Confirmed workflow

Open a flow's sites directly from Content or from the metric explorer's
driver summary. Preserve geographical area, market, flow and reporting
period. Search and sort the contributing sites, inspect a scoped site
detail, and compare selected sites side by side.

The comparison is not a new aggregate. Returning to the list must preserve
search, sort, selection and position. Searching does not change the flow's
total. A general site overview is distinct from a flow-scoped detail.

## Constraints

This addition is Galileo-only. Other Nexus products are out of scope.
Use the existing site-analysis payload and retain data semantics, access
control and reporting windows. Do not change ingestion or database schemas.
Keep the current Content overview and top-three summary.

## Product continuity

Extend the existing Galileo interface rather than redesigning its identity.
Keep the EssilorLuxottica endorsement and existing shared shell.
Detailed scope, evidence and the pending layout choice: `.gli/brief.md`.
