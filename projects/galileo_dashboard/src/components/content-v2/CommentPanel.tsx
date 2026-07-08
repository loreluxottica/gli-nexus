"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoArea, KpiComment, Market } from "@/data/types";
import { seededComments } from "@/data/contentComments";
import { siteAnalysis, siteNames } from "@/data/siteAnalysis";
import { areaLabel } from "@/data/geo";
import { Button } from "@/components/ui/Button";
import styles from "./CommentPanel.module.css";

const LS_KEY = "galileo:eff-comments";
const AREAS = ["ALL", "APAC", "EMEA", "LATAM", "NA"];
const SITE_SET = new Set(siteNames);
const MENTION_RE = /@\[([^\]]+)\]/g;

function loadLocal(): KpiComment[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocal(list: KpiComment[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — POC degrades to in-memory only */
  }
}

/**
 * Comments on an efficiency KPI (a flow + market). Seeded comments come from the
 * committed JSON (shared with everyone); the compose form adds comments to
 * localStorage so they appear immediately, with "copy to publish" to promote one
 * into the committed file. Scoped by flow + market so each KPI keeps its own
 * thread; the area is recorded per comment as context.
 */
export function CommentPanel({
  flow,
  market,
  area,
  flowLabel,
  onSite,
}: {
  flow: string;
  market: Market;
  area: GeoArea;
  flowLabel: string;
  /** Open the single-site analysis for a tagged plant. */
  onSite: (site: string) => void;
}) {
  const [local, setLocal] = useState<KpiComment[]>([]);
  const [composing, setComposing] = useState(false);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [areaSel, setAreaSel] = useState<string>(area);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [siteQuery, setSiteQuery] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setLocal(loadLocal()), []);
  useEffect(() => setAreaSel(area), [area]);

  // Only plants that belong to THIS section (flow + the comment's area) are
  // taggable — e.g. Sedico (EMEA Frames/RX) never shows for Stock Lenses · NA.
  const sectionSites = siteAnalysis.flow_sites[flow]?.[areaSel] ?? [];
  const q = siteQuery.trim().toLowerCase();
  const siteMatches = q
    ? sectionSites.filter((n) => n.toLowerCase().includes(q)).slice(0, 8)
    : [];

  /** Insert an @[Site] token at the textarea cursor (or append). */
  function insertSite(name: string) {
    const token = `@[${name}] `;
    const ta = taRef.current;
    if (!ta) {
      setText((t) => (t ? `${t} ` : "") + token);
    } else {
      const start = ta.selectionStart ?? text.length;
      const end = ta.selectionEnd ?? text.length;
      const next = text.slice(0, start) + token + text.slice(end);
      setText(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + token.length;
        ta.setSelectionRange(pos, pos);
      });
    }
    setSiteQuery("");
  }

  /** Render comment text, turning @[Site] tokens into clickable chips. */
  function renderText(body: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const m of body.matchAll(MENTION_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push(body.slice(last, idx));
      const name = m[1];
      out.push(
        SITE_SET.has(name) ? (
          <button
            key={`s${key++}`}
            type="button"
            className={styles.siteChip}
            onClick={() => onSite(name)}
            title={`View ${name} site analysis`}
          >
            {name}
          </button>
        ) : (
          <span key={`s${key++}`}>@{name}</span>
        ),
      );
      last = idx + m[0].length;
    }
    if (last < body.length) out.push(body.slice(last));
    return out;
  }

  const match = (c: KpiComment) => c.flow === flow && c.market === market;
  const items = [
    ...seededComments.filter(match).map((c) => ({ ...c, local: false })),
    ...local.filter(match).map((c) => ({ ...c, local: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  function add() {
    const t = text.trim();
    if (!t) return;
    const c: KpiComment = {
      id: `local-${Date.now()}`,
      flow,
      market,
      area: areaSel,
      author: author.trim() || "Anonymous",
      date: new Date().toISOString().slice(0, 10),
      text: t,
    };
    const next = [...local, c];
    setLocal(next);
    saveLocal(next);
    setText("");
    setComposing(false);
  }

  function remove(id: string) {
    const next = local.filter((c) => c.id !== id);
    setLocal(next);
    saveLocal(next);
  }

  async function copyEntry(c: KpiComment) {
    const entry = {
      id: `c-${Date.now()}`,
      flow: c.flow,
      market: c.market,
      area: c.area,
      author: c.author,
      date: c.date,
      text: c.text,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <section className={styles.panel} aria-label="KPI comments">
      <div className={styles.head}>
        <h3 className={styles.title}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 4h16v12H7l-3 3V4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          Comments
          <span className={styles.count}>{items.length}</span>
        </h3>
        {!composing && (
          <Button variant="ghost" onClick={() => setComposing(true)}>
            + Add
          </Button>
        )}
      </div>

      {items.length === 0 && !composing && (
        <p className={styles.empty}>
          No comments on this KPI yet. Add an insight on what is driving the change.
        </p>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((c) => (
            <li key={c.id} className={`${styles.item} ${c.local ? styles.itemLocal : ""}`}>
              <div className={styles.meta}>
                <span className={styles.author}>{c.author}</span>
                <span className={styles.dot}>·</span>
                <span className={styles.date}>{c.date}</span>
                <span className={styles.areaTag}>{areaLabel(c.area as GeoArea)}</span>
                {c.local && <span className={styles.localTag}>local draft</span>}
              </div>
              <p className={styles.text}>{renderText(c.text)}</p>
              {c.local && (
                <div className={styles.localActions}>
                  <button type="button" className={styles.linkBtn} onClick={() => copyEntry(c)}>
                    {copiedId === c.id ? "copied ✓" : "copy to publish"}
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={() => remove(c.id)}>
                    delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <input
              className={styles.input}
              placeholder="Name (author)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            <select
              className={styles.input}
              aria-label="Reference area"
              value={areaSel}
              onChange={(e) => setAreaSel(e.target.value)}
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {areaLabel(a as GeoArea)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            ref={taRef}
            className={styles.textarea}
            rows={3}
            placeholder={`Insight on what is driving ${flowLabel} (${market}) efficiency…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={styles.siteRow}>
            <input
              className={styles.siteSearch}
              placeholder={
                sectionSites.length
                  ? `Tag a site: search the ${sectionSites.length} plants in this section…`
                  : "No plants in this section"
              }
              value={siteQuery}
              onChange={(e) => setSiteQuery(e.target.value)}
              disabled={sectionSites.length === 0}
            />
            {q && siteMatches.length > 0 && (
              <div className={styles.siteResults}>
                {siteMatches.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={styles.siteOpt}
                    onClick={() => insertSite(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {q && siteMatches.length === 0 && (
              <div className={styles.siteResults}>
                <span className={styles.siteNone}>No plants in this section.</span>
              </div>
            )}
          </div>
          <div className={styles.formActions}>
            <Button variant="accent" onClick={add}>
              Save comment
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setComposing(false);
                setText("");
              }}
            >
              Cancel
            </Button>
          </div>
          <p className={styles.note}>
            Saved in your browser (POC). Use &ldquo;copy to publish&rdquo; to make it visible to
            everyone. With &ldquo;Tag a site&rdquo; you mention a plant: in the comment it becomes
            clickable and opens its analysis.
          </p>
        </div>
      )}
    </section>
  );
}
