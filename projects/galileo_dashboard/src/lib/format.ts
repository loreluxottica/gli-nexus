/** Number/label formatting — ported from the prototype's app.js helpers. */

const isBlank = (n: unknown): boolean =>
  n === null || n === undefined || n === "" || (typeof n === "number" && Number.isNaN(n));

/** Integer with thousands separators; em-dash for blank.
 *  `locale` controls the separators (e.g. "it-IT" -> "947.999"). */
export function fmtInt(n: number | null | undefined, locale = "en-US"): string {
  if (isBlank(n)) return "—";
  return Number(n).toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** Ratio (0.09) -> "9.0%"; em-dash for blank.
 *  `locale` controls the decimal separator (e.g. "it-IT" -> "9,0%"). */
export function fmtPct(
  n: number | null | undefined,
  minFrac = 1,
  locale = "en-US",
): string {
  if (isBlank(n)) return "—";
  return (
    (Number(n) * 100).toLocaleString(locale, {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: 1,
    }) + "%"
  );
}

/** Compact magnitude for bar/insight labels: 27_940_193 -> "27.9M". Blank -> em-dash. */
export function fmtCompact(n: number | null | undefined): string {
  if (isBlank(n)) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e4) return (v / 1e3).toFixed(0) + "K";
  if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(v));
}

/** Pieces-per-shipment ratio (batch size): 5382.4 -> "5,382", 14.1 -> "14.1".
 *  Blank / non-finite / zero -> em-dash (an undefined ratio = no shipments). */
export function fmtRatio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 100) return Math.round(v).toLocaleString("en-US");
  return v.toFixed(1);
}

/** Signed compact delta: +33.6M / −1.2M. Blank -> em-dash. */
export function fmtDeltaCompact(n: number | null | undefined): string {
  if (isBlank(n)) return "—";
  const v = Number(n);
  return (v >= 0 ? "+" : "−") + fmtCompact(Math.abs(v));
}

/** Signed percentage for a YoY ratio: 0.092 -> "+9.2%". Blank -> em-dash. */
export function fmtPctSigned(n: number | null | undefined, locale = "en-US"): string {
  if (isBlank(n)) return "—";
  const s = fmtPct(Math.abs(Number(n)), 1, locale);
  return Number(n) >= 0 ? `+${s}` : `−${s}`;
}

/** Semantic class hint for a delta: "pos" | "neg" | "muted". */
export function sign(n: number | null | undefined): "pos" | "neg" | "muted" {
  if (isBlank(n)) return "muted";
  const v = Number(n);
  return v > 0 ? "pos" : v < 0 ? "neg" : "muted";
}

/** Direction glyph so YoY survives grayscale (a11y: color-not-only). */
export function trend(n: number | null | undefined): "" | "▲" | "▼" {
  if (isBlank(n)) return "";
  const v = Number(n);
  return v > 0 ? "▲" : v < 0 ? "▼" : "";
}

/** kebab-case slug for class/token suffixes. */
export function slug(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Year-over-year ratio; null when no prior-year base. */
export function yoy(cur: number, py: number): number | null {
  return py > 0 ? (cur - py) / py : null;
}
