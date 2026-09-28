"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import type { CurrentView, DatabasePage, DbRow } from "@/data/types";
import { loadPayload } from "@/data/api";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import { fmtInt } from "@/lib/format";
import { databaseCsv, flowRecordsScope, flowSitesReturnHref, scopedSourceRecords } from "@/lib/flowSites";
import { contentRowLabel } from "@/lib/products";
import { Button } from "@/components/ui/Button";
import type { TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { MappingGrid } from "./MappingGrid";
import { DbTable } from "./DbTable";
import styles from "./Database.module.css";

const Tour = dynamic(() => import("@/components/ui/Tour").then((m) => m.Tour), {
  ssr: false,
});

/** Walkthrough of how to explore the source records. The flow: browse the
 *  records for granularity, then — if a site is unclear — drill into the
 *  mapping to see where the data comes from. */
const TOUR_STEPS: TourStep[] = [
  {
    title: "How to use the Database",
    body: (
      <>
        The database holds every <strong>source record</strong>, the finest
        granularity in Galileo. Browse it to see the detail behind any figure.
      </>
    ),
  },
  {
    target: '[data-tour="area-tabs"]',
    title: "Scoped by area",
    body: (
      <>
        The <strong>Geographical Area</strong> selected up top filters these
        records too. Leave it on All to browse every area.
      </>
    ),
  },
  {
    target: '[data-tour="db-controls"]',
    title: "Search and filter for granularity",
    body: (
      <>
        Narrow down to what you need: search by site, product or market, and
        combine the <strong>Market</strong>, <strong>Product</strong> and{" "}
        <strong>Site Type</strong> filters.
      </>
    ),
  },
  {
    target: '[data-tour="db-status"]',
    title: "The live count",
    body: (
      <>
        This tells you how many records match the current area, search and
        filters right now.
      </>
    ),
  },
  {
    target: '[data-tour="db-table"]',
    title: "Read the records",
    body: (
      <>
        Each row is a single source record. This is the granular detail behind
        every Content and Coverage figure, 50 per page.
      </>
    ),
  },
  {
    target: '[data-tour="db-export"]',
    title: "Export what you see",
    body: (
      <>
        Download exactly the records you have filtered as a <strong>CSV</strong>,
        ready for Excel.
      </>
    ),
  },
  {
    target: '[data-tour="db-mapping"]',
    title: "Unclear site? Drill into the mapping",
    body: (
      <>
        If a site or flow in the records isn&rsquo;t clear, open the{" "}
        <strong>mapping</strong> to see where the data comes from and how each
        plant maps onto the Content rows.
      </>
    ),
  },
];

export function DatabaseView({ config, view }: { config: DatabasePage; view: CurrentView }) {
  const params = useSearchParams();
  const raw = params.get("area");
  const area = isGeoArea(raw) ? raw : GEO_DEFAULT;
  // Database refinements must not overwrite the originating site's working state.
  const scopeQuery = new URLSearchParams([...params].filter(([key]) => !key.startsWith("db-"))).toString();
  const resolved = useMemo(() => flowRecordsScope(new URLSearchParams(scopeQuery), view), [scopeQuery, view]);
  const scopeError = resolved && "error" in resolved ? resolved.error : null;
  const investigation = resolved && "scope" in resolved ? resolved : null;
  const scoped = params.has("records");

  const [rows, setRows] = useState<DbRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (scopeError) return;
    let alive = true;
    setLoadError(null);
    loadPayload<DbRow[]>("db").then((data) => {
      if (alive) setRows(data);
    }).catch((error: unknown) => {
      if (alive) setLoadError(error instanceof Error ? error.message : "Galileo could not load its source records.");
    });
    return () => {
      alive = false;
    };
  }, [retry, scopeError]);

  const search = params.get("db-q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const filterQuery = new URLSearchParams(config.filters.map((filter) =>
    [filter.key, params.get(`db-${filter.key}`) ?? ""])).toString();
  const filters = useMemo(() => {
    const values = new URLSearchParams(filterQuery);
    return config.filters.map((filter) => ({ ...filter, value: values.get(filter.key) ?? "" }));
  }, [config.filters, filterQuery]);
  const invalidFilter = filters.find((filter) => filter.value && !filter.options.includes(filter.value));
  const filterError = invalidFilter ? `The ${invalidFilter.label.toLowerCase()} filter in this link is unavailable. Clear the filters to continue.` : null;
  const error = scopeError ?? loadError ?? filterError;
  const rawPage = Number(params.get("db-page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0;
  const [tourOpen, setTourOpen] = useState(false);

  const update = (changes: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", url);
  };
  const clearFilters = () => update(Object.fromEntries(
    ["db-q", "db-page", ...config.filters.map((filter) => `db-${filter.key}`)].map((key) => [key, null]),
  ));

  const geoCol = config.geo_col;
  const sourceRows = useMemo(() => {
    if (!rows || scopeError) return [];
    return investigation
      ? scopedSourceRecords(rows, investigation.scope, investigation.sites, investigation.year)
      : area === "ALL" ? rows : rows.filter((row) => row[geoCol] === area);
  }, [rows, scopeError, investigation, area, geoCol]);
  const filtered = useMemo(() => {
    if (error) return [];
    const s = deferredSearch.trim().toLowerCase();
    const active = filters.filter((filter) => filter.value);
    return sourceRows.filter((row) => {
      for (const filter of active) if (row[filter.col] !== filter.value) return false;
      if (s) {
        const hay = `${row[1]} ${row[2]} ${row[3]} ${row[4]} ${row[9]}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [sourceRows, deferredSearch, filters, error]);

  const pageSize = config.page_size;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const loading = rows === null && !error;
  const refining = search !== deferredSearch;
  const hasFilters = !!search || filters.some((filter) => filter.value);
  const label = investigation ? contentRowLabel(investigation.row, investigation.scope.area) : null;
  const periodLabel = investigation
    ? view.period_options.find((option) => option.n === investigation.scope.period)?.label ?? view.period_label
    : "";

  // Export ALL filtered records (respects area + search + Market/Product/Site
  // Type filters) — not just the current page. Visible columns only.
  const exportCsv = () => {
    if (loading || refining || filtered.length === 0) return;
    const csv = databaseCsv(config.columns, filtered);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `galileo-db-${area.toLowerCase()}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel">
      <div className={styles.head}>
        <div className={styles.headTop}>
          <h2>
            Database{" "}
            {!error && (!scoped || !loading) && <span className={styles.badge}>
              {fmtInt(scoped ? sourceRows.length : config.row_count)} records
            </span>}
          </h2>
          {scoped ? <div className={styles.scopeActions}>
            <Link href={flowSitesReturnHref(params.toString())}>Back to sites</Link>
            <Link href={`/database?${new URLSearchParams({ area })}`}>All records</Link>
          </div> : <TutorialButton onClick={() => setTourOpen(true)} />}
        </div>
        {investigation && label ? <div className={styles.recordScope} role="group" aria-label="Record scope">
          <p className={styles.lede}><strong>{areaLabel(investigation.scope.area)} · {investigation.scope.market}</strong>
            {" · "}{label.category} / {label.sub_category}{" · "}{periodLabel} {investigation.year} &amp; {investigation.year - 1}
          </p>
          <details className={styles.scopeSites}>
            <summary>{investigation.sites.length} selected {investigation.sites.length === 1 ? "site" : "sites"}</summary>
            <ul>{investigation.sites.map((site) => <li key={site}>{site}</li>)}</ul>
          </details>
        </div> : !scoped && <p className={styles.lede}>
          Browsable source records for the selected area, plus how each{" "}
          <em>plant / flow</em> maps onto the Content rows.
        </p>}
      </div>

      {!scoped && <div data-tour="db-mapping">
        <MappingGrid mapping={config.mapping} source={config.mapping_source} />
      </div>}

      {!scopeError && <div className={styles.controls} data-tour="db-controls">
        <label className={styles.filter}>
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => update({ "db-q": e.target.value, "db-page": null })}
            placeholder="site, product, market…"
            disabled={loading || !!loadError}
          />
        </label>

        {filters.map((f) => (
          <label key={f.key} className={styles.filter}>
            <span>{f.label}</span>
            <select
              value={f.value}
              disabled={loading || !!loadError}
              onChange={(e) => update({ [`db-${f.key}`]: e.target.value, "db-page": null })}
            >
              <option value="">{scoped ? "All in scope" : "All"}</option>
              {f.value && !f.options.includes(f.value) && <option value={f.value}>Unavailable: {f.value}</option>}
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hasFilters && <Button onClick={clearFilters}>Clear filters</Button>}

        <div className={styles.status} aria-live="polite" data-tour="db-status">
          <span className={`${styles.dot} ${filtered.length ? styles.dotActive : ""}`} />
          {error ? "Records unavailable" : loading ? (
            "Loading records…"
          ) : (
            <>
              <b>{fmtInt(filtered.length)}</b> records
              {area !== "ALL" && (
                <>
                  {" "}
                  in <b>{areaLabel(area)}</b>
                </>
              )}
            </>
          )}
        </div>

        <Button
          variant="accent"
          className={styles.exportBtn}
          data-tour="db-export"
          onClick={exportCsv}
          disabled={loading || refining || filtered.length === 0}
          title="Download all filtered records as CSV"
        >
          ↓ Download CSV
        </Button>
      </div>}

      {error ? <div className={styles.recordNotice} role="alert">
        <h3>Source records unavailable</h3><p>{error}</p>
        {loadError && !scopeError && <Button onClick={() => { setRows(null); setRetry((value) => value + 1); }}>Retry</Button>}
        {scopeError && <Link href="/content">Back to Content</Link>}
      </div> : loading ? (
        <DbSkeleton columns={config.columns.length} />
      ) : filtered.length === 0 ? (
        <p className={styles.recordNotice} role="status">
          {hasFilters ? "No source records match these filters." : scoped
            ? "No source records for the selected sites in this scope." : "No source records in this area."}
        </p>
      ) : (
        <div data-tour="db-table" aria-busy={refining || undefined}>
          <DbTable columns={config.columns} rows={slice} />
          {filtered.length > pageSize && (
            <div className={styles.pager}>
              <Button
                variant="ghost"
                disabled={safePage === 0}
                onClick={() => update({ "db-page": safePage === 1 ? null : String(safePage) })}
              >
                ‹ Prev
              </Button>
              <span className={styles.pageInfo}>
                Page {safePage + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                disabled={safePage >= pages - 1}
                onClick={() => update({ "db-page": String(safePage + 2) })}
              >
                Next ›
              </Button>
            </div>
          )}
        </div>
      )}

      {tourOpen ? (
        <Tour
          steps={TOUR_STEPS}
          open
          onClose={() => setTourOpen(false)}
          label="Database tutorial"
        />
      ) : null}
    </section>
  );
}

/** Shimmer placeholder instead of a blocking spinner (MASTER §3 progressive-loading). */
function DbSkeleton({ columns }: { columns: number }) {
  return (
    <div className={styles.tableWrap} aria-hidden="true">
      <div className={styles.skeleton}>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className={styles.skeletonRow}>
            {Array.from({ length: columns }).map((__, c) => (
              <div key={c} className={styles.skeletonCell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
