"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AcctArea, ContentTrends, CurrentView, ExportLabSite, Market } from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import { Button } from "@/components/ui/Button";
import { Tour, type TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { FirstRunHint } from "@/components/ui/FirstRunHint";
import { MarketMetricToggle, type Metric } from "./MarketMetricToggle";
import { ContentTableV2 } from "./ContentTableV2";
import { MetricExplorer } from "./MetricExplorer";
import { PeriodSelect } from "./PeriodSelect";
import styles from "./ContentViewV2.module.css";

const ACCT_INTL: AcctArea = "INTERNATIONAL";

const TOUR_STEPS: TourStep[] = [
  {
    title: "Content — read trends at a glance",
    body: (
      <>
        Same volumes as before, rebuilt to <strong>confront this year against
        the same period last year</strong> and surface what moved. Quick tour.
      </>
    ),
  },
  {
    target: '[data-tour="area-tabs"]',
    title: "Pick the area",
    body: (
      <>
        Every figure re-scopes to the <strong>Geographical Area</strong> selected
        here.
      </>
    ),
  },
  {
    target: '[data-tour="v2-toggle"]',
    title: "One market, one metric",
    body: (
      <>
        <strong>REP</strong> (Replenishment, bulk to DCs) and <strong>LM</strong>{" "}
        (Last Mile, to the ECP / customer) are different units, so you view one at
        a time. Switch <strong>Pieces / Shipments</strong> alongside.
      </>
    ),
  },
  {
    target: '[data-tour="v2-bar"]',
    title: "This year vs last year",
    body: (
      <>
        The paired bar shows the current YTD (solid) over the same period last
        year (ghost) on a shared scale, so size and direction read instantly.
      </>
    ),
  },
  {
    target: '[data-tour="v2-yoy"]',
    title: "Why did it move?",
    body: (
      <>
        Click any <strong>YoY chip</strong> and the change explains itself: a
        one-line answer, the monthly trend and the areas that drove the move.
      </>
    ),
  },
  {
    target: '[data-tour="v2-trend"]',
    title: "The monthly trend",
    body: (
      <>
        The sparkline draws this year (solid) over last year&rsquo;s full shape
        (ghost) so you see seasonality and exactly where the lines diverge.
      </>
    ),
  },
  {
    target: '[data-tour="v2-toggle"]',
    title: "Efficiency — pcs / shipment",
    body: (
      <>
        Switch <strong>Metric</strong> to <strong>Efficiency</strong> to see pieces
        and shipments together as <strong>batch size</strong>: rising means each
        shipment carries more (consolidation). Click a ratio to open the same
        explorer, scoped to batch size.
      </>
    ),
  },
  {
    target: '[data-tour="v2-drill"]',
    title: "Drill into Export Labs",
    body: <>Open an <strong>Export Labs</strong> row to see the sites behind the total.</>,
  },
  {
    target: '[data-tour="content-acct"]',
    title: "Accounting Area",
    body: (
      <>
        Toggle the same table onto the <strong>International</strong> accounting
        perimeter. It turns <strong>amber</strong> — button and frame — so you
        always know which view you are reading. Toggle again to return to the
        geographical view.
      </>
    ),
  },
];

/** Validate a raw ?metric value. */
function toMetric(raw: string | null): Metric {
  return raw === "shipments" || raw === "efficiency" ? raw : "pieces";
}

export function ContentViewV2({
  view,
  drills,
  trends,
}: {
  view: CurrentView;
  drills: ExportLabSite[];
  trends: ContentTrends;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The analytical lens lives in the URL so it survives navigation between
  // sections and is shareable / deep-linkable, exactly like ?area (MASTER §4).
  const rawArea = params.get("area");
  const area = isGeoArea(rawArea) ? rawArea : GEO_DEFAULT;
  const market: Market = params.get("market") === "LM" ? "LM" : "REP";
  const metric: Metric = toMetric(params.get("metric"));
  const explore = params.get("explore") || null;
  // Accounting perimeter view (International) filters the same table in place.
  const acct = params.get("acct") === "1";

  const [tourOpen, setTourOpen] = useState(false);

  // End month of the cumulative YTD window. Defaults to the latest available
  // month; ?period=N (1..latest) rescopes the whole Content surface to that
  // window vs the same window last year. Row meta (coverage, driver) stays.
  const latest = Number(view.period_number);
  const rawPeriod = parseInt(params.get("period") || "", 10);
  const periodNum =
    Number.isFinite(rawPeriod) && view.periods[String(rawPeriod)] ? rawPeriod : latest;
  const periodOpt = view.period_options.find((o) => o.n === periodNum);
  const period = `${periodOpt?.label ?? view.period_label} ${view.year}`;

  const scopedView = useMemo(() => {
    if (periodNum === latest) return view;
    const snap = view.periods[String(periodNum)];
    return { ...view, rows: view.rows.map((r, i) => ({ ...r, ...snap.rows[i] })) };
  }, [view, periodNum, latest]);

  const scopedDrills = useMemo(() => {
    if (periodNum === latest) return drills;
    const snap = view.periods[String(periodNum)];
    // A site absent from the period had no activity yet → empty cells so the
    // table filters it out (never show a later month's number for it).
    return drills.map((d) => {
      const pc = snap.drills[d.site];
      return pc ? { ...d, ...pc } : { ...d, geo_data: {}, acct_data: {} };
    });
  }, [view, drills, periodNum, latest]);

  /** Merge search-param updates and replace the URL (no history spam, no scroll). */
  const commit = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const setMarket = (m: Market) => commit({ market: m === "REP" ? null : m });
  // The explorer is metric-aware, so switching metric no longer closes it.
  const setMetric = (m: Metric) => commit({ metric: m === "pieces" ? null : m });
  const setExplore = (key: string | null) => commit({ explore: key });
  const setPeriod = (n: number) => commit({ period: n === latest ? null : String(n) });
  // Toggling the accounting perimeter also closes the (geo-only) explorer.
  const setAcct = (on: boolean) => commit({ acct: on ? "1" : null, explore: null });

  return (
    <>
      <FirstRunHint onStart={() => setTourOpen(true)} />

      <section className="panel">
        <div className={styles.headRow}>
          <div className={styles.headLeft}>
            <h2 className={styles.headTitle}>{acct ? "International" : areaLabel(area)}</h2>
            <PeriodSelect
              options={view.period_options}
              value={periodNum}
              year={view.year}
              onChange={setPeriod}
            />
          </div>
          <div className={styles.headActions}>
            <TutorialButton onClick={() => setTourOpen(true)} />
            <Button
              variant="accent"
              className={acct ? styles.acctBtnOn : undefined}
              data-tour="content-acct"
              aria-pressed={acct}
              onClick={() => setAcct(!acct)}
            >
              <span>{acct ? "Accounting Area · International" : "View by Accounting Area"}</span>
              <span aria-hidden="true">{acct ? "×" : "›"}</span>
            </Button>
          </div>
        </div>

        <MarketMetricToggle
          market={market}
          metric={metric}
          onMarket={setMarket}
          onMetric={setMetric}
        />

        <div className={styles.legend}>
          <span className={styles.legItem}>
            <span className={`${styles.swatch} ${styles.swCur}`} aria-hidden="true" /> {trends.current_year}
          </span>
          <span className={styles.legItem}>
            <span className={`${styles.swatch} ${styles.swPy}`} aria-hidden="true" /> {trends.prior_year}
          </span>
          <span className={styles.legSep}>·</span>
          <span className={styles.legItem}>
            <abbr className={styles.term} title="Replenishment — bulk flow to distribution centres">
              REP
            </abbr>{" "}
            bulk
          </span>
          <span className={styles.legItem}>
            <abbr
              className={styles.term}
              title="Last Mile — delivery to the ECP (eye-care professional) / end customer"
            >
              LM
            </abbr>{" "}
            to customer
          </span>
        </div>

        {acct && (
          <div className={styles.acctBanner} role="status">
            <span className={styles.acctBannerDot} aria-hidden="true" />
            <span>
              Accounting Area · <strong>International</strong>
            </span>
            <span className={styles.acctBannerNote}>
              accounting perimeter — the geographical area filter does not apply here
            </span>
          </div>
        )}

        <ContentTableV2
          view={scopedView}
          drills={scopedDrills}
          trends={acct ? undefined : trends}
          months={periodNum}
          dim={acct ? "acct" : "geo"}
          area={acct ? ACCT_INTL : area}
          market={market}
          metric={metric}
          onExplore={acct ? undefined : setExplore}
          noFallback={acct}
          accent={acct}
          caption={
            acct
              ? `Content by Accounting Area — International, ${market} ${metric}, ${period}`
              : `Content — ${areaLabel(area)}, ${market} ${metric}, ${period}`
          }
        />

        {acct && view.footnote && <p className={styles.footnote}>{view.footnote}</p>}
      </section>

      <MetricExplorer
        open={!!explore}
        onClose={() => setExplore(null)}
        rowKey={explore}
        view={scopedView}
        trends={trends}
        market={market}
        metric={metric}
        area={area}
        period={periodNum}
      />

      <Tour steps={TOUR_STEPS} open={tourOpen} onClose={() => setTourOpen(false)} label="Content tutorial" />
    </>
  );
}
