"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./PageTabs.module.css";

const SECTIONS = ["/content", "/database", "/coverage"];

const PAGES = [
  { href: "/content", label: "Content" },
  { href: "/database", label: "Database" },
  { href: "/coverage", label: "Coverage" },
] as const;

/**
 * Section navigation. Each page is a route; links preserve the current ?area
 * so switching pages keeps the selected Geographical Area (MASTER §4).
 */
export function PageTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  // Remember the current section + lens so the landing can resume here instead
  // of re-gating the visitor through the splash (EnterLink reads this).
  useEffect(() => {
    if (!SECTIONS.includes(pathname)) return;
    try {
      // Never resume mid-pitch: the stored lens drops the story param.
      const clean = new URLSearchParams(qs);
      clean.delete("story");
      const cq = clean.toString();
      localStorage.setItem("galileo:last-section", cq ? `${pathname}?${cq}` : pathname);
    } catch {
      /* storage unavailable — resume simply falls back to the default */
    }
  }, [pathname, qs]);

  return (
    <nav className={styles.pagetabs} aria-label="Primary">
      {PAGES.map((p) => {
        const isActive = pathname === p.href || pathname === `${p.href}/`;
        return (
          <Link
            key={p.href}
            href={qs ? `${p.href}?${qs}` : p.href}
            className={`${styles.pagetab} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
