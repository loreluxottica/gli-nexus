"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadContent } from "./content";
import { loadContentTrends } from "./contentTrends";
import { loadSiteAnalysis } from "./siteAnalysis";
import { SectionSkeleton } from "@/components/shell/SectionSkeleton";

/**
 * Gate that holds back rendering until the payloads are in memory.
 *
 * The app is a static export with no server render of its data, so every
 * consumer used to rely on the payload being present the moment its module was
 * imported. Fetching breaks that assumption: rather than thread `data | null`
 * through dozens of components, this waits and only then renders children —
 * which lets `getContent()` and friends stay synchronous everywhere below.
 *
 * That also means children never execute during the static export (the gate is
 * always "loading" on the server), so the prerendered HTML carries the skeleton
 * and the real markup arrives on hydration.
 *
 * `needsSiteAnalysis` pulls in the extra ~270 KB per-plant payload. Only the
 * Content route asks for it; the landing and the other routes never pay for it.
 */
export function GalileoData({
  children,
  needsSiteAnalysis = false,
  fallback,
}: {
  children: ReactNode;
  needsSiteAnalysis?: boolean;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const wanted: Promise<unknown>[] = [loadContent(), loadContentTrends()];
    if (needsSiteAnalysis) wanted.push(loadSiteAnalysis());
    Promise.all(wanted)
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [needsSiteAnalysis]);

  if (error) return <DataError message={error} />;
  if (!ready) return <>{fallback ?? <SectionSkeleton label="Loading Galileo data" />}</>;
  return <>{children}</>;
}

/** The API is down or the warehouse is unreachable — say so instead of a blank page. */
function DataError({ message }: { message: string }) {
  return (
    <section className="panel" role="alert" style={{ padding: "32px", textAlign: "center" }}>
      <p style={{ fontWeight: 600, marginBottom: "8px" }}>Data unavailable</p>
      <p style={{ color: "var(--muted, #667)", fontSize: "14px" }}>
        Galileo could not load its data. It refreshes from Databricks on a short
        cycle, so this usually clears on a reload.
      </p>
      <p style={{ color: "var(--muted, #667)", fontSize: "12px", marginTop: "12px" }}>{message}</p>
    </section>
  );
}
