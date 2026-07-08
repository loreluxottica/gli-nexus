"use client";

import { useEffect, useState } from "react";
import styles from "./LiveDemos.module.css";

/**
 * Right-edge dot navigation for the landing slide deck. Tracks the slide
 * currently in view (IntersectionObserver over [data-slide] sections) and
 * scrolls to a slide on click. Purely additive — native scrolling and
 * keyboard (PgUp/PgDn) keep working through the scroll-snap container.
 */
export function SlideNav({ slides }: { slides: { id: string; label: string }[] }) {
  const [active, setActive] = useState(slides[0]?.id);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-slide]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { threshold: 0.5 }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <nav className={styles.dots} aria-label="Slides">
      {slides.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`${styles.dot} ${active === s.id ? styles.dotActive : ""}`}
          aria-label={`${i + 1}. ${s.label}`}
          aria-current={active === s.id ? "true" : undefined}
          title={s.label}
          onClick={() =>
            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })
          }
        />
      ))}
    </nav>
  );
}
