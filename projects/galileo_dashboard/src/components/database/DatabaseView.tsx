"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import type { DatabasePage, DbRow } from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import { fmtInt } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Tour, type TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { MappingGrid } from "./MappingGrid";
import { DbTable } from "./DbTable";
import styles from "./Database.module.css";

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

export function DatabaseView({ config }: { config: DatabasePage }) {
  const raw = useSearchParams().get("area");
  const area = isGeoArea(raw) ? raw : GEO_DEFAULT;

  // Heavy records (944 KB) lazy-loaded ONLY when this route mounts (MASTER §7).
  const [rows, setRows] = useState<DbRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    import("@/data/db.json").then((m) => {
      if (alive) setRows((m.default ?? m) as unknown as DbRow[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [page, setPage] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);

  // Reset to first page whenever the result set changes.
  useEffect(() => {
    setPage(0);
  }, [area, deferredSearch, filters]);

  const geoCol = config.geo_col;
  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = deferredSearch.trim().toLowerCase();
    const active = Object.entries(filters).filter(([, v]) => v);
    return rows.filter((row) => {
      if (area !== "ALL" && row[geoCol] !== area) return false;
      for (const [col, val] of active) if (row[Number(col)] !== val) return false;
      if (s) {
        const hay = `${row[1]} ${row[2]} ${row[3]} ${row[4]} ${row[9]}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, area, deferredSearch, filters, geoCol]);

  const pageSize = config.page_size;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const loading = rows === null;

  // Export ALL filtered records (respects area + search + Market/Product/Site
  // Type filters) — not just the current page. Visible columns only.
  const exportCsv = () => {
    if (loading || filtered.length === 0) return;
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = config.columns.map((c) => esc(c.label)).join(",");
    const body = filtered
      .map((r) => config.columns.map((_, ci) => esc(r[ci])).join(","))
      .join("\n");
    const csv = "﻿" + header + "\n" + body; // BOM so Excel reads UTF-8
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
            <span className={styles.badge}>{fmtInt(config.row_count)} records</span>
          </h2>
          <TutorialButton onClick={() => setTourOpen(true)} />
        </div>
        <p className={styles.lede}>
          Browsable source records for the selected area, plus how each{" "}
          <em>plant / flow</em> maps onto the Content rows.
        </p>
      </div>

      <div data-tour="db-mapping">
        <MappingGrid mapping={config.mapping} source={config.mapping_source} />
      </div>

      <div className={styles.controls} data-tour="db-controls">
        <label className={styles.filter}>
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="site, product, market…"
            disabled={loading}
          />
        </label>

        {config.filters.map((f) => (
          <label key={f.key} className={styles.filter}>
            <span>{f.label}</span>
            <select
              value={filters[f.col] ?? ""}
              disabled={loading}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, [f.col]: e.target.value }))
              }
            >
              <option value="">All</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}

        <div className={styles.status} aria-live="polite" data-tour="db-status">
          <span className={`${styles.dot} ${filtered.length ? styles.dotActive : ""}`} />
          {loading ? (
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
          disabled={loading || filtered.length === 0}
          title="Download all filtered records as CSV"
        >
          ↓ Download CSV
        </Button>
      </div>

      {loading ? (
        <DbSkeleton columns={config.columns.length} />
      ) : (
        <div data-tour="db-table">
          <DbTable columns={config.columns} rows={slice} />
          {filtered.length > pageSize && (
            <div className={styles.pager}>
              <Button
                variant="ghost"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                ‹ Prev
              </Button>
              <span className={styles.pageInfo}>
                Page {safePage + 1} / {pages}
              </span>
              <Button
                variant="ghost"
                disabled={safePage >= pages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next ›
              </Button>
            </div>
          )}
        </div>
      )}

      <Tour
        steps={TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        label="Database tutorial"
      />
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
