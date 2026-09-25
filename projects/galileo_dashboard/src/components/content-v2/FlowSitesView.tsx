"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getContent } from "@/data/content";
import { getSiteAnalysis } from "@/data/siteAnalysis";
import { areaLabel, isGeoArea } from "@/data/geo";
import type { ContentRow, CurrentView, MetricCell } from "@/data/types";
import { Button } from "@/components/ui/Button";
import { PeriodSelect } from "./PeriodSelect";
import { contentRowLabel } from "@/lib/products";
import { fmtCompact, fmtDeltaCompact, fmtInt, fmtPct, fmtPctSigned, fmtRatio, sign } from "@/lib/format";
import {
  contentScopeHref, flowSites, flowTotals, isSiteSort, SITE_SORTS, visibleFlowSites,
  type FlowScope, type FlowSite, type SiteMetric, type SiteMetricKey,
} from "@/lib/flowSites";
import styles from "./FlowSitesView.module.css";

const METRICS: { key: SiteMetricKey; label: string }[] = [
  { key: "pieces", label: "Pieces" },
  { key: "shipments", label: "Shipments" },
  { key: "efficiency", label: "Pcs/ship" },
];
const PAGE_SIZE = 25;

function value(value: number | null | undefined, key: SiteMetricKey): string {
  // Zero pieces with positive shipments is a measured ratio of zero.
  return key === "efficiency" ? value === 0 ? "0.0" : fmtRatio(value) : fmtInt(value);
}

function Yoy({ metric }: { metric: SiteMetric | undefined }) {
  return <span className={`${styles.yoy} ${styles[sign(metric?.yoy)]}`}>
    {metric?.cur == null || metric.py == null ? "Not available" :
      metric.yoy == null ? "No prior baseline" : `${fmtPctSigned(metric.yoy)} YoY`}
  </span>;
}

function ScopeError({ message }: { message: string }) {
  return <section className="panel" role="alert">
    <h1>Site view unavailable</h1><p>{message}</p><Link href="/content">Back to Content</Link>
  </section>;
}

export function FlowSitesView() {
  const params = useSearchParams();
  const view = getContent().current_view;
  const area = params.get("area") ?? "ALL";
  const market = params.get("market") ?? "REP";
  const rawPeriod = params.get("period");
  const period = rawPeriod == null ? Number(view.period_number) : Number(rawPeriod);
  const flow = params.get("flow") ?? "";
  const index = view.rows.findIndex((row) => `${row.category}|${row.sub_category}` === flow);
  if (params.get("acct") === "1") return <ScopeError message="Site exploration is available for geographical areas, not the International accounting perimeter." />;
  if (!isGeoArea(area)) return <ScopeError message="The link contains an unknown geographical area." />;
  if (market !== "REP" && market !== "LM") return <ScopeError message="The link contains an unknown market. Choose REP or LM from Content." />;
  if (!Number.isInteger(period) || period < 1 ||
      (period !== Number(view.period_number) && !view.period_options.some((option) => option.n === period))) {
    return <ScopeError message="The link contains an unavailable reporting period." />;
  }
  if (index < 0) return <ScopeError message="Choose a valid flow using View sites on Content." />;
  const snapshot = view.periods[String(period)];
  if (period !== Number(view.period_number) && !snapshot?.rows[index]) {
    return <ScopeError message="The flow totals are unavailable for this reporting period." />;
  }
  const row = view.rows[index];
  const geo = period === Number(view.period_number) ? row.geo_data : snapshot.rows[index].geo_data;
  const scope: FlowScope = { flow, area, market, period };
  return <SiteWorkspace key={`${flow}|${area}|${market}|${period}`}
    scope={scope} row={row} cell={geo[area] ?? null} view={view} />;
}

function SiteWorkspace({ scope, row, cell, view }: {
  scope: FlowScope; row: ContentRow; cell: MetricCell | null; view: CurrentView;
}) {
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const rawSort = params.get("sort") ?? "pieces";
  const sort = isSiteSort(rawSort) ? rawSort : "pieces";
  const selected = [...new Set(params.getAll("selected"))];
  const requestedSite = params.get("site");
  const comparing = params.get("compare") === "1";
  const listMetric = sort.startsWith("shipments") ? "shipments" : "pieces";
  const byChange = sort.endsWith("-change");
  const metricLabel = listMetric === "pieces" ? "Pieces" : "Shipments";
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const focusIntent = useRef(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState(false);
  const result = useMemo(() => flowSites(getSiteAnalysis(), scope), [scope]);
  const totals = flowTotals(cell, scope.market);
  const rows = result.rows;
  const filtered = useMemo(() => visibleFlowSites(rows, search, sort), [rows, search, sort]);
  const byName = new Map(rows.map((site) => [site.site, site]));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, pageCount) : 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = requestedSite ? byName.get(requestedSite) : pageRows[0];
  const label = contentRowLabel(row, scope.area);
  const flowLabel = `${label.category} / ${label.sub_category}`;
  const year = Number(view.year);
  const periodLabel = view.period_options.find((option) => option.n === scope.period)?.label ?? view.period_label;
  const scopedLabel = `${flowLabel} · ${scope.market} · ${areaLabel(scope.area)} · ${periodLabel} ${view.year}`;
  const unavailable = selected.filter((site) => !byName.has(site));
  const missingDetail = !result.error && rows.length === 0 && totals &&
    [totals.pieces.cur, totals.pieces.py, totals.shipments.cur, totals.shipments.py].some((n) => n != null && n !== 0);
  const dataError = result.error ?? (missingDetail ? "The flow has activity, but its site detail is unavailable in this scope." : null);

  // Next's native History integration keeps URL state and browser Back in sync
  // without a network transition for every search keystroke or checkbox.
  const update = (changes: Record<string, string | string[] | null>, push = false) => {
    const url = new URL(window.location.href);
    for (const [key, next] of Object.entries(changes)) {
      url.searchParams.delete(key);
      if (Array.isArray(next)) next.forEach((item) => url.searchParams.append(key, item));
      else if (next != null) url.searchParams.set(key, next);
    }
    window.history[push ? "pushState" : "replaceState"](null, "", url);
  };
  const toggle = (site: string) => {
    const current = new Set(new URLSearchParams(window.location.search).getAll("selected"));
    current.has(site) ? current.delete(site) : current.add(site);
    update({ selected: [...current] });
  };
  const openSite = (site: string) => {
    if (requestedSite === site && !comparing) {
      detailRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        detailRef.current?.scrollIntoView({ block: "start" });
      }
      return;
    }
    focusIntent.current = true;
    update({ site, compare: null }, true);
  };
  const openComparison = () => {
    focusIntent.current = true;
    update({ compare: "1" }, true);
  };
  const backToList = () => {
    if (comparing) update({ compare: null }, true);
    searchRef.current?.focus();
    if (window.matchMedia("(max-width: 900px)").matches) {
      searchRef.current?.scrollIntoView({ block: "center" });
    }
  };
  useEffect(() => {
    if (!focusIntent.current) return;
    focusIntent.current = false;
    detailRef.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 900px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start" });
    }
  }, [requestedSite, comparing]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [search, sort, page]);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage("View link copied.");
      setCopyError(false);
    } catch (error) {
      setCopyMessage(`${error instanceof Error ? error.message : "Could not copy the link."} Copy the address from your browser instead.`);
      setCopyError(true);
    }
  };

  return <div className={styles.workspace}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <Link href={contentScopeHref(scope)}>Content</Link><span aria-hidden="true">/</span><span>{label.category}</span><span aria-hidden="true">/</span><span aria-current="page">Sites</span>
    </nav>
    <header className={styles.heading}>
      <h1>
        <span className={styles.titleScope}>{areaLabel(scope.area)} · <abbr title={scope.market === "LM" ? "Last Mile" : "Intra-Network"}>{scope.market}</abbr> · </span>
        {label.category}<span className={styles.titleSeparator}> / </span>{label.sub_category}
      </h1>
      <div className={styles.actions}>
        <PeriodSelect options={view.period_options} value={scope.period} year={view.year}
          onChange={(n) => update({ period: String(n), page: null }, true)} />
        <Button onClick={copyLink}>Copy view link</Button>
      </div>
    </header>
    {copyMessage && <p className={styles.message} role={copyError ? "alert" : "status"}>{copyMessage}</p>}
    {dataError ? <section className={styles.notice} role="alert"><h2>Site detail unavailable</h2><p>{dataError} Reload to retry, or return to Content.</p><Button onClick={() => window.location.reload()}>Reload data</Button></section> : <>
      {rawSort !== sort && <p className={styles.notice} role="status">The sort in this link is not supported. Showing Pieces, highest first.</p>}
      <div className={styles.split}>
        <section className={styles.listPane} aria-label="Sites in this flow">
          <div className={styles.toolbar}>
            <label className={styles.search}>Find a site<input ref={searchRef} type="search" value={search}
              placeholder="Search all sites in this flow..."
              onChange={(event) => update({ q: event.target.value || null, page: null })} /></label>
            <label>Order by<select value={sort} onChange={(event) => update({ sort: event.target.value, page: null })}>
              {SITE_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <span className={styles.count} role="status">{filtered.length} of {rows.length} sites</span>
          </div>
          <div className={styles.listFrame}>
            <div className={styles.listScroll} ref={listRef}>
              <table className={styles.listTable}>
                <caption className="sr-only">{scopedLabel}. Select sites for comparison or open a site for detail.</caption>
                <thead><tr><th scope="col" className={styles.checkCol}><span className="sr-only">Select</span></th>
                  <th scope="col" aria-sort={sort === "name" ? "ascending" : undefined}>Site</th>
                  <th scope="col" className={styles.num} aria-sort={sort === "name" ? undefined : byChange ? "other" : "descending"}>
                    {byChange ? `Change in ${metricLabel.toLowerCase()}` : metricLabel}
                  </th></tr></thead>
                <tbody>{pageRows.map((site) => <tr key={site.site} className={selected.includes(site.site) ? styles.selected : ""}>
                  <td className={styles.checkCol}><input type="checkbox" checked={selected.includes(site.site)}
                    aria-label={`Compare ${site.site}`} onChange={() => toggle(site.site)} /></td>
                  <th scope="row"><button type="button" className={styles.siteName} onClick={() => openSite(site.site)}
                    aria-current={!comparing && active?.site === site.site ? "true" : undefined}
                    aria-controls="flow-site-detail">{site.site}</button></th>
                  <td className={styles.num}><span title={value(site[listMetric].cur, listMetric)}>
                    {byChange ? fmtDeltaCompact(site[listMetric].delta) : fmtCompact(site[listMetric].cur)}
                  </span><Yoy metric={site[listMetric]} /></td>
                </tr>)}</tbody>
              </table>
              {filtered.length === 0 && <div className={styles.empty}>
                <p>{rows.length ? "No sites match this search in the selected flow." : "No contributing sites with activity in this flow, market and period."}</p>
                {search && <Button onClick={() => update({ q: null, page: null })}>Clear search</Button>}
              </div>}
            </div>
            <p className={styles.tableNote}>{byChange ? "Ordered by absolute change, including increases and decreases." : "Current YTD with YoY underneath."} Click a site for its full metrics.</p>
          </div>
          {pageCount > 1 && <nav className={styles.pagination} aria-label="Site pages">
            <Button disabled={page === 1} onClick={() => update({ page: String(page - 1) })}>Previous</Button>
            <span>Page {page} of {pageCount}</span>
            <Button disabled={page === pageCount} onClick={() => update({ page: String(page + 1) })}>Next</Button>
          </nav>}
          <div className={styles.selection}>
            <div><strong role="status">{selected.length} selected</strong><span>Kept while you search for another site</span></div>
            <Button disabled={!selected.length} onClick={() => update({ selected: [], compare: null })}>Clear</Button>
            <Button variant="accent" disabled={selected.length < 2} onClick={openComparison}>Compare ({selected.length})</Button>
          </div>
          {selected.length > 0 && <details className={styles.selectedNames}><summary>Manage selected sites</summary>
            <ul>{selected.map((name) => <li key={name}><span>{name}</span><button type="button" onClick={() => toggle(name)} aria-label={`Remove ${name} from comparison`}>Remove</button></li>)}</ul>
          </details>}
        </section>
        <section id="flow-site-detail" ref={detailRef} tabIndex={-1} className={styles.inspection} aria-label={comparing ? "Site comparison" : "Site detail"}>
          <div className={styles.inspectionTop}><Button onClick={backToList}>Back to site list</Button><span>{scope.market} · {areaLabel(scope.area)}</span></div>
          {comparing ? <>
            <header className={styles.detailHead}><h2>Compare sites</h2><p>{scopedLabel}</p></header>
            <p className={styles.help}>Same context. Each site is shown separately, not summed.</p>
            {selected.length < 2 ? <p className={styles.empty}>Select at least two sites from the list to compare them.</p> : <>
              {unavailable.length > 0 && <p className={styles.notice} role="status">No activity in this scope for: {unavailable.join(", ")}. Their figures are unavailable, not zero.</p>}
              <div className={styles.comparisonScroll} tabIndex={0} role="region" aria-label="Site comparison table; scroll horizontally for more sites">
                <table className={styles.comparison}>
                  <caption className="sr-only">{scopedLabel}, selected sites</caption>
                  <thead><tr><th scope="col">Metric</th>{selected.map((name) => <th scope="col" key={name}>
                    <button type="button" className={styles.siteName} onClick={() => openSite(name)}>{name}</button>
                    <button type="button" className={styles.remove} onClick={() => toggle(name)} aria-label={`Remove ${name} from comparison`}>Remove</button>
                  </th>)}</tr></thead>
                  <tbody>{METRICS.map(({ key, label: name }) => <tr key={key}><th scope="row">{name}</th>{selected.map((site) => {
                    const metric = byName.get(site)?.[key];
                    return <td key={site} className={styles.num}>{metric ? <>
                      <span>{value(metric.cur, key)}</span><span className={styles.baseline}>{year - 1}: {value(metric.py, key)}</span><Yoy metric={metric} />
                    </> : <span className={styles.noData}>No activity in this scope</span>}</td>;
                  })}</tr>)}</tbody>
                </table>
              </div>
            </>}
          </> : active ? <SiteDetail site={active} label={scopedLabel} year={year}
            totalPieces={totals?.pieces.cur ?? null} selected={selected.includes(active.site)}
            onToggle={() => toggle(active.site)} /> :
            <div className={styles.empty}><h2>{requestedSite ? "Site not available in this scope" : "Choose a site"}</h2>
              <p>{requestedSite ? `${requestedSite} has no contributing figures for this flow, area, market and period.` : "Search or select a site in the list to see its figures here."}</p>
            </div>}
        </section>
      </div>
    </>}
  </div>;
}

function SiteDetail({ site, label, year, totalPieces, selected, onToggle }: {
  site: FlowSite; label: string; year: number; totalPieces: number | null; selected: boolean; onToggle: () => void;
}) {
  return <>
    <header className={styles.detailHead}><h2>{site.site}</h2><p>{label}</p></header>
    <div className={styles.detailScroll} tabIndex={0} role="region" aria-label={`${site.site} metrics table`}>
      <table className={styles.detailTable}>
        <caption className="sr-only">{site.site}, current and prior metrics within {label}</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col" className={styles.num}>{year} YTD</th><th scope="col" className={styles.num}>{year - 1} YTD</th><th scope="col" className={styles.num}>YoY</th></tr></thead>
        <tbody>{METRICS.map(({ key, label: name }) => <tr key={key}>
          <th scope="row">{name}</th><td className={styles.num}>{value(site[key].cur, key)}</td><td className={styles.num}>{value(site[key].py, key)}</td>
          <td className={`${styles.num} ${styles[sign(site[key].yoy)]}`}>{site[key].yoy == null ?
            <span className={styles.noData}>{site[key].cur == null || site[key].py == null ? "Not available" : "No prior baseline"}</span> :
            fmtPctSigned(site[key].yoy)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className={styles.contribution}><h3>Contribution to this flow</h3>
      <p>{totalPieces != null && totalPieces > 0 ? <><strong>{fmtPct((site.pieces.cur ?? 0) / totalPieces)}</strong> of current pieces. </> : "No current volume share is available. "}
        Change vs prior YTD: <strong>{fmtDeltaCompact(site.pieces.delta)}</strong> pieces.</p>
    </div>
    <Button onClick={onToggle}>{selected ? "Remove from comparison" : "Add to comparison"}</Button>
    <p className={styles.detailNote}>These figures include only the selected flow, market, area and period, not the site&apos;s overall activity. A dash means the ratio is unavailable; zero remains zero.</p>
  </>;
}
