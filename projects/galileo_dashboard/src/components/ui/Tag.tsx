import type { ReactNode } from "react";
import styles from "./Tag.module.css";

/**
 * The one pill primitive. Replaces the prototype's seven look-alike classes:
 *   .geo-tag · .product-tag · .market-tag · .flow-tag · .dim-badge · .intl-chip · .wip-pill
 *
 * Tone = which categorical hue (see docs/design-system/tokens-audit.md).
 * Variant: `soft` = filled pale (default) · `outline` = surface bg + tone border/text.
 *
 * Presentational + server-safe (no hooks). Map domain values to tones with the
 * helpers in lib/tags.ts (toneForProduct / toneForArea / toneForMarket).
 */

export type TagTone = "azure" | "sage" | "terracotta" | "clay" | "brass" | "neutral";
export type TagSize = "sm" | "md";
export type TagVariant = "soft" | "outline";

export interface TagProps {
  tone?: TagTone;
  size?: TagSize;
  variant?: TagVariant;
  uppercase?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Tag({
  tone = "neutral",
  size = "md",
  variant = "soft",
  uppercase = false,
  title,
  className,
  children,
}: TagProps) {
  const cls = [
    styles.tag,
    styles[tone],
    styles[size],
    variant === "outline" && styles.outline,
    uppercase && styles.uppercase,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}
