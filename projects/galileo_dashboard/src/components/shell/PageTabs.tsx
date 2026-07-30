"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./PageTabs.module.css";

const PAGES = [
  { href: "/content", label: "Content" },
  { href: "/database", label: "Database" },
  { href: "/coverage", label: "Coverage" },
] as const;

/**
 * Section navigation. Each page is a route; links preserve the current ?area
 * so switching pages keeps the selected Geographical Area (MASTER §4).
 *
 * Prefetch: Next Link prefetches in view; we also warm all section routes after
 * mount and the heavy db.json when the user aims at Database.
 */
export function PageTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const qs = params.toString();

  // Warm the three section bundles as soon as the shell is up (idle), so the
  // first tab click doesn't pay the full cold-load cost.
  useEffect(() => {
    const run = () => {
      for (const p of PAGES) {
        router.prefetch(qs ? `${p.href}?${qs}` : p.href);
      }
    };
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      const id = ric(run, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 200);
    return () => window.clearTimeout(t);
  }, [router, qs]);

  const warmDatabase = () => {
    router.prefetch(qs ? `/database?${qs}` : "/database");
    // Kick off the 900 KB records chunk before the route mounts.
    void import("@/data/db.json");
  };

  return (
    <nav className={styles.pagetabs} aria-label="Primary">
      {PAGES.map((p) => {
        const isActive = pathname === p.href || pathname === `${p.href}/`;
        const href = qs ? `${p.href}?${qs}` : p.href;
        return (
          <Link
            key={p.href}
            href={href}
            prefetch
            className={`${styles.pagetab} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
            onMouseEnter={() => {
              router.prefetch(href);
              if (p.href === "/database") warmDatabase();
            }}
            onFocus={() => {
              router.prefetch(href);
              if (p.href === "/database") warmDatabase();
            }}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
