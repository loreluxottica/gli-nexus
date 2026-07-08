"use client";

import { useMemo, useState } from "react";
import type { DbMapping } from "@/data/types";
import { Tag } from "@/components/ui/Tag";
import { toneForProduct } from "@/lib/tags";
import styles from "./Database.module.css";

/**
 * Mapping reference — a 1:1 mirror of the workbook's "Mapping" sheet
 * (Raw Sites Names · Sites · Market · Product · Site Type · Area · Source ·
 * Owner), in the sheet's own row order. Collapsed by default: it is context,
 * not primary content — open it when you need to see how raw site names
 * resolve to sites, markets, products and areas.
 */
export function MappingGrid({
  mapping,
  source,
}: {
  mapping: DbMapping[];
  source: "sheet" | "derived";
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mapping;
    return mapping.filter((m) =>
      [
        m.raw_site,
        m.site,
        m.market,
        m.product,
        m.site_type,
        m.geo,
        m.source,
        m.owner,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [mapping, q]);

  return (
    <details className={styles.mapping}>
      <summary className={styles.mappingSummary}>
        Sites mapping reference{" "}
        <span className={styles.mapCount}>{mapping.length}</span>
        {source === "derived" && (
          <span className={styles.mapFallback} title="No Mapping sheet found in the workbook">
            fallback (derived)
          </span>
        )}
      </summary>

      <p className={styles.mapHint}>
        Mirrors the workbook&rsquo;s <strong>Mapping</strong> sheet row for row: how each
        raw site name resolves to site, market, product, site type and area, with its
        data source and owner.
      </p>

      <input
        type="search"
        className={styles.mapSearch}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search site, market, product, area, source, owner…"
        aria-label="Search mapping"
      />

      <div className={styles.mapTableWrap}>
        <table className={styles.mapTable}>
          <caption className="sr-only">
            Sites mapping, mirroring the workbook&rsquo;s Mapping sheet.
          </caption>
          <thead>
            <tr>
              <th scope="col">Raw Sites Names</th>
              <th scope="col">Sites</th>
              <th scope="col">Market</th>
              <th scope="col">Product</th>
              <th scope="col">Site Type</th>
              <th scope="col">Area</th>
              <th scope="col">Source</th>
              <th scope="col">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, i) => (
              <tr key={`${m.raw_site ?? m.site ?? m.product}-${i}`}>
                <td className={styles.mapMono}>{m.raw_site || "—"}</td>
                <td className={styles.mapSiteCell}>{m.site || "—"}</td>
                <td className={styles.mapMono}>{m.market || "—"}</td>
                <td>
                  <Tag tone={toneForProduct(m.product)} size="sm">
                    {m.product}
                  </Tag>
                </td>
                <td className={styles.mapMono}>{m.site_type || "—"}</td>
                <td className={styles.mapMono}>{m.geo || "—"}</td>
                <td className={styles.mapMono}>{m.source || "—"}</td>
                <td className={styles.mapMono}>{m.owner || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.mapEmpty}>
                  No mapping rows match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
