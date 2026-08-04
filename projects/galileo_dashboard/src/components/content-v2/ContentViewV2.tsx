"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AcctArea,
  ContentTrends,
  CurrentView,
  ExportLabSite,
  Market,
  PeriodSnapshot,
} from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import type { TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { FirstRunHint } from "@/components/ui/FirstRunHint";
import { MarketMetricToggle, type Metric } from "./MarketMetricToggle";
import { ContentTableV2 } from "./ContentTableV2";
import { PeriodSelect } from "./PeriodSelect";
import styles from "./ContentViewV2.module.css";

/** Heavy surfaces — deferred so Content first paint stays lean. */
const MetricExplorer = dynamic(
  () => import("./MetricExplorer").then((m) => m.MetricExplorer),
  { ssr: false },
);
const Tour = dynamic(() => import("@/components/ui/Tour").then((m) => m.Tour), {
  ssr: false,
});

const ACCT_INTL: AcctArea = "INTERNATIONAL";

/** A decoder for one step: what you are looking at → what it means. Used only
 *  where the page encodes something (a solid vs ghost bar, an amber table). */
function TourKey({
  items,
}: {
  items: { term: string; def: string; swatch?: "cur" | "py" | "acct" }[];
}) {
  return (
    <dl className={styles.tourKey}>
      {items.map((it) => (
        <div key={it.term} className={styles.tourKeyRow}>
          <dt className={styles.tourKeyTerm}>
            {it.swatch ? (
              <span
                className={`${styles.tourSwatch} ${
                  it.swatch === "cur"
                    ? styles.swCur
                    : it.swatch === "py"
                      ? styles.swPy
                      : styles.swAcct
                }`}
                aria-hidden="true"
              />
            ) : null}
            {it.term}
          </dt>
          <dd className={styles.tourKeyDef}>{it.def}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The Content walkthrough. Built from the trend years so every step names the
 *  actual years on screen instead of "current" and "prior". */
function buildTourSteps(cy: number, py: number): TourStep[] {
  return [
    {
      title: "How to read Content",
      body: (
        <>
          Every row compares <strong>{cy} year to date</strong> against the exact
          same months of <strong>{py}</strong> — so a change you see is a real
          change, not a longer window.
        </>
      ),
    },
    {
      target: '[data-tour="area-tabs"]',
      title: "Choose the area",
      body: (
        <>
          Pick a <strong>Geographical Area</strong> here. Every number, bar and
          trend below re-scopes to it, and the choice follows you into Coverage
          and Database.
        </>
      ),
    },
    {
      target: '[data-tour="v2-toggle"]',
      title: "Choose market and metric",
      body: (
        <>
          One market and one metric at a time.
          <TourKey
            items={[
              { term: "REP", def: "Intra-Network flows" },
              { term: "LM", def: "last mile, to the ECP or customer" },
              {
                term: "Metric",
                def: "Pieces, Shipments, or Efficiency — pieces per shipment",
              },
            ]}
          />
        </>
      ),
    },
    {
      target: '[data-tour="v2-bar"]',
      title: "This year against last",
      body: (
        <>
          Each row draws both years as one paired bar on a shared scale, so size
          and direction read together.
          <TourKey
            items={[
              { swatch: "cur", term: "Solid bar", def: `${cy} year to date` },
              { swatch: "py", term: "Ghost bar", def: `${py}, same months` },
            ]}
          />
        </>
      ),
    },
    {
      target: '[data-tour="v2-yoy"]',
      title: "Why did it move?",
      body: (
        <>
          The <strong>YoY chip</strong> is the percent change against those same
          months last year — green up, red down. Click one for a one-line cause,
          the monthly trend and the areas that drove the move.
        </>
      ),
    },
    {
      target: '[data-tour="v2-trend"]',
      title: "The monthly shape",
      body: (
        <>
          The sparkline puts this year over last year&rsquo;s full shape, so
          seasonality and the month the two years split apart are both visible.
          Hover any month to compare the two years at that point.
          <TourKey
            items={[
              { swatch: "cur", term: "Solid line", def: `${cy}, month by month` },
              { swatch: "py", term: "Ghost line", def: `${py}, full year` },
            ]}
          />
        </>
      ),
    },
    {
      target: '[data-tour="v2-drill"]',
      title: "Open the detail",
      body: (
        <>
          A row with a <strong>▸</strong> expands. Click{" "}
          <strong>Export Labs</strong> to see the individual sites that add up to
          the total.
        </>
      ),
    },
    {
      target: '[data-tour="content-acct"]',
      title: "Which perimeter am I reading?",
      body: (
        <>
          The same table can be read two ways.
          <TourKey
            items={[
              { term: "Geographical", def: "the areas selected in the tabs above" },
              {
                swatch: "acct",
                term: "International",
                def: "the accounting perimeter — the table turns amber and the area tabs stop applying",
              },
            ]}
          />
        </>
      ),
    },
  ];
}

/** Validate a raw ?metric value. */
function toMetric(raw: string | null): Metric {
  return raw === "shipments" || raw === "efficiency" ? raw : "pieces";
}

export function ContentViewV2({
  view,
  drills,
  trends,
  periodsLazy = false,
}: {
  view: CurrentView;
  drills: ExportLabSite[];
  trends: ContentTrends;
  /** When true, only the latest period is in `view.periods`; load the rest on idle. */
  periodsLazy?: boolean;
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
  const tourSteps = useMemo(
    () => buildTourSteps(trends.current_year, trends.prior_year),
    [trends.current_year, trends.prior_year],
  );
  const [periods, setPeriods] = useState<Record<string, PeriodSnapshot>>(view.periods);
  const [periodsFull, setPeriodsFull] = useState(!periodsLazy);

  // Pull the full multi-month map after first paint (or immediately when a
  // non-default period is requested before the chunk has arrived).
  useEffect(() => {
    if (!periodsLazy || periodsFull) return;
    let alive = true;
    const load = () =>
      import("@/data/contentPeriods").then((m) => {
        if (!alive) return;
        setPeriods(m.getContentPeriods());
        setPeriodsFull(true);
      });
    const want = parseInt(params.get("period") || "", 10);
    const latestN = Number(view.period_number);
    const needNow = Number.isFinite(want) && want !== latestN;
    if (needNow) {
      load();
      return () => {
        alive = false;
      };
    }
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      const id = ric(() => load(), { timeout: 1800 });
      return () => {
        alive = false;
        window.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(load, 350);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [periodsLazy, periodsFull, view.period_number, params]);

  // End month of the cumulative YTD window. Defaults to the latest available
  // month; ?period=N (1..latest) rescopes the whole Content surface to that
  // window vs the same window last year. Row meta (coverage, driver) stays.
  const latest = Number(view.period_number);
  const rawPeriod = parseInt(params.get("period") || "", 10);
  const periodNum =
    Number.isFinite(rawPeriod) &&
    (periods[String(rawPeriod)] || view.period_options.some((o) => o.n === rawPeriod))
      ? rawPeriod
      : latest;
  const periodOpt = view.period_options.find((o) => o.n === periodNum);
  const period = `${periodOpt?.label ?? view.period_label} ${view.year}`;

  const viewWithPeriods = useMemo(
    () => ({ ...view, periods }),
    [view, periods],
  );

  const scopedView = useMemo(() => {
    if (periodNum === latest) return viewWithPeriods;
    const snap = periods[String(periodNum)];
    if (!snap) return viewWithPeriods; // still loading periods chunk
    return {
      ...viewWithPeriods,
      rows: view.rows.map((r, i) => ({ ...r, ...snap.rows[i] })),
    };
  }, [view, viewWithPeriods, periods, periodNum, latest]);

  const scopedDrills = useMemo(() => {
    if (periodNum === latest) return drills;
    const snap = periods[String(periodNum)];
    if (!snap) return drills;
    // A site absent from the period had no activity yet → empty cells so the
    // table filters it out (never show a later month's number for it).
    return drills.map((d) => {
      const pc = snap.drills[d.site];
      return pc ? { ...d, ...pc } : { ...d, geo_data: {}, acct_data: {} };
    });
  }, [drills, periods, periodNum, latest]);

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
  // Efficiency has no explorer, so entering it closes any open one; Pieces /
  // Shipments keep the explorer open (it's metric-aware).
  const setMetric = (m: Metric) =>
    commit({ metric: m === "pieces" ? null : m, ...(m === "efficiency" ? { explore: null } : {}) });
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
          </div>
        </div>

        <MarketMetricToggle
          market={market}
          metric={metric}
          acct={acct}
          onMarket={setMarket}
          onMetric={setMetric}
          onAcct={setAcct}
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
            <abbr className={styles.term} title="Replenishment — Intra-Network flows">
              REP
            </abbr>{" "}
            Intra-Network
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

      {explore ? (
        <MetricExplorer
          open
          onClose={() => setExplore(null)}
          rowKey={explore}
          view={scopedView}
          trends={trends}
          market={market}
          metric={metric}
          area={area}
          period={periodNum}
        />
      ) : null}

      {tourOpen ? (
        <Tour steps={tourSteps} open onClose={() => setTourOpen(false)} label="Content tutorial" />
      ) : null}
    </>
  );
}
