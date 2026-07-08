"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

const KEY = "galileo:last-section";
const DEFAULT = "/content";
const SECTIONS = ["/content", "/database", "/coverage"];

/** A stored "last section" is only honoured if it points at a real section. */
function isValid(v: string | null): v is string {
  if (!v || !v.startsWith("/")) return false;
  const path = (v.split("?")[0].replace(/\/$/, "") || "/");
  return SECTIONS.includes(path);
}

/**
 * The landing "Enter" affordance. Instead of always dropping into the same
 * splash gate, a returning visitor is sent back to the section (and lens) they
 * last used, recorded by PageTabs in localStorage. First-time visitors get the
 * default entry. Resolved after mount, so SSR / the static export render the
 * default and there is no hydration mismatch.
 */
export function EnterLink({
  className,
  children,
  returningChildren,
}: {
  className?: string;
  children: ReactNode;
  returningChildren?: ReactNode;
}) {
  const [href, setHref] = useState(DEFAULT);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (isValid(v)) {
        setHref(v);
        setReturning(true);
      }
    } catch {
      /* storage unavailable — keep the default entry */
    }
  }, []);

  return (
    <Link href={href} className={className}>
      {returning && returningChildren ? returningChildren : children}
    </Link>
  );
}
