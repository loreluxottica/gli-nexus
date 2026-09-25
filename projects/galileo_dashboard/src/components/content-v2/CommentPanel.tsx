"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoArea, KpiComment, Market } from "@/data/types";
import { seededComments } from "@/data/contentComments";
import {
  deleteComment,
  fetchComments,
  postComment,
  type SharedComment,
} from "@/data/comments";
import { getSiteAnalysis, getSiteNames } from "@/data/siteAnalysis";
import { areaLabel } from "@/data/geo";
import { Button } from "@/components/ui/Button";
import styles from "./CommentPanel.module.css";

/** Browser-only drafts written by the pre-sharing version of this panel. */
const LS_KEY = "galileo:eff-comments";
const AREAS = ["ALL", "EMEA", "NA", "APAC", "LATAM"];
// Lazy: the payload arrives by fetch, so this cannot be built at module scope.
let siteSet: Set<string> | null = null;
const knownSite = (name: string) => (siteSet ??= new Set(getSiteNames())).has(name);
const MENTION_RE = /@\[([^\]]+)\]/g;

function loadDrafts(): KpiComment[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveDrafts(list: KpiComment[]) {
  try {
    if (list.length) localStorage.setItem(LS_KEY, JSON.stringify(list));
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Item = KpiComment & { kind: "seed" | "shared" | "draft"; mine: boolean };
type Status = "loading" | "ready" | "error";

/**
 * Comments on a Content KPI (a flow + market), shared with everyone who has
 * Galileo access: the thread is read from and written to the server, and the
 * author is the signed-in user. Committed seed comments (content_comments.json)
 * show read-only alongside. Drafts left in this browser by the earlier
 * local-only version can be published or discarded. The area is recorded per
 * comment as context.
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
  const [shared, setShared] = useState<SharedComment[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [drafts, setDrafts] = useState<KpiComment[]>([]);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [areaSel, setAreaSel] = useState<string>(area);
  const [siteQuery, setSiteQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDrafts(loadDrafts()), []);
  useEffect(() => setAreaSel(area), [area]);
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    fetchComments(flow, market)
      .then((thread) => {
        if (!alive) return;
        setShared(thread.comments);
        setMe(thread.me);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [flow, market]);

  // Only plants that belong to THIS section (flow + the comment's area) are
  // taggable — e.g. Sedico (EMEA Frames/RX) never shows for Stock Lenses · NA.
  const sectionSites = getSiteAnalysis().flow_sites[flow]?.[areaSel] ?? [];
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
        knownSite(name) ? (
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
  const items: Item[] = [
    ...seededComments.filter(match).map((c) => ({ ...c, kind: "seed" as const, mine: false })),
    ...shared.map((c) => ({ ...c, kind: "shared" as const })),
    ...drafts.filter(match).map((c) => ({ ...c, kind: "draft" as const, mine: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  async function add() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy("new");
    setError(null);
    try {
      const saved = await postComment({ flow, market, area: areaSel, text: t });
      setShared((list) => [saved, ...list]);
      setText("");
      setComposing(false);
    } catch {
      setError("Could not save the comment. Your text is still here; try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await deleteComment(id);
      setShared((list) => list.filter((c) => c.id !== id));
    } catch {
      setError("Could not delete the comment. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function discardDraft(id: string) {
    const next = drafts.filter((c) => c.id !== id);
    setDrafts(next);
    saveDrafts(next);
  }

  async function publishDraft(d: KpiComment) {
    if (busy) return;
    setBusy(d.id);
    setError(null);
    try {
      const saved = await postComment({ flow: d.flow, market: d.market, area: d.area, text: d.text });
      setShared((list) => [saved, ...list]);
      discardDraft(d.id);
    } catch {
      setError("Could not publish the draft. Try again.");
    } finally {
      setBusy(null);
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

      {status === "loading" && <p className={styles.empty}>Loading comments…</p>}
      {status === "error" && (
        <p className={styles.empty} role="status">
          Shared comments are unavailable right now
          {items.length ? "; showing only the published ones." : "."}
        </p>
      )}
      {status === "ready" && items.length === 0 && !composing && (
        <p className={styles.empty}>
          No comments on this KPI yet. Add an insight on what is driving the change.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((c) => (
            <li
              key={`${c.kind}-${c.id}`}
              className={`${styles.item} ${c.kind === "draft" ? styles.itemLocal : ""}`}
            >
              <div className={styles.meta}>
                <span className={styles.author}>{c.author}</span>
                <span className={styles.dot}>·</span>
                <span className={styles.date}>{c.date}</span>
                <span className={styles.areaTag}>{areaLabel(c.area as GeoArea)}</span>
                {c.kind === "draft" && <span className={styles.localTag}>unpublished draft</span>}
              </div>
              <p className={styles.text}>{renderText(c.text)}</p>
              {c.kind === "draft" && (
                <div className={styles.localActions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => publishDraft(c)}
                    disabled={busy !== null}
                  >
                    {busy === c.id ? "publishing…" : "publish"}
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => discardDraft(c.id)}
                    disabled={busy !== null}
                  >
                    discard
                  </button>
                </div>
              )}
              {c.kind === "shared" && c.mine && (
                <div className={styles.localActions}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => remove(c.id)}
                    disabled={busy !== null}
                  >
                    {busy === c.id ? "deleting…" : "delete"}
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
            placeholder={`Insight on what is driving ${flowLabel} (${market})…`}
            maxLength={2000}
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
            <Button variant="accent" onClick={add} disabled={busy !== null || !text.trim()}>
              {busy === "new" ? "Saving…" : "Save comment"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setComposing(false);
                setText("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <p className={styles.note}>
            Visible to everyone with access to Galileo
            {me ? <>, posted as <strong>{me}</strong></> : null}. With &ldquo;Tag a site&rdquo;
            you mention a plant: in the comment it becomes clickable and opens its analysis.
          </p>
        </div>
      )}
    </section>
  );
}
