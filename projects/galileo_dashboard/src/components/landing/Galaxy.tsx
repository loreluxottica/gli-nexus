"use client";

import { useEffect, useRef } from "react";
import styles from "./Galaxy.module.css";

/**
 * Rotating spiral galaxy, drawn as a precision star-chart: ultramarine ink
 * particles on the daylight paper, with faint survey rings. A nod to Galileo —
 * the whole picture, observed from above. Canvas is decorative (aria-hidden),
 * DPR-aware, and renders a single static frame under prefers-reduced-motion.
 */

type Star = {
  x: number; // unit-disc coordinates (galaxy plane, pre-tilt)
  y: number;
  size: number;
  alpha: number;
  twinkle: number; // phase for the alpha shimmer
  color: string;
};

// Deterministic PRNG so the field is stable across re-renders.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bright starlight on the landing's deep-blue night: pale blues + near-white,
// with rare warm amber sparks.
const INKS = [
  "168,196,255", // pale ultramarine
  "122,162,255", // ultramarine glow
  "224,233,250", // near-white starlight
];
const AMBER = "242,193,90"; // rare warm sparks

function buildStars(): Star[] {
  const rnd = mulberry32(1610); // Sidereus Nuncius, 1610
  const stars: Star[] = [];
  const ARMS = 3;
  const TWIST = 2.6; // radians of wind-up from core to rim

  // Spiral arms.
  for (let i = 0; i < 1150; i++) {
    const arm = i % ARMS;
    const t = Math.pow(rnd(), 0.72); // density bias toward the core
    const r = 0.08 + t * 0.92;
    const jitter = (rnd() - 0.5) * (0.16 + 0.22 * t); // arms blur outward
    const theta =
      (arm * 2 * Math.PI) / ARMS + TWIST * Math.log(1 + 3 * r) + jitter;
    const amber = rnd() < 0.055;
    stars.push({
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
      size: 0.6 + rnd() * (amber ? 1.6 : 1.3),
      alpha: (0.4 + 0.6 * (1 - t)) * (0.6 + rnd() * 0.4),
      twinkle: rnd() * Math.PI * 2,
      color: amber ? AMBER : INKS[Math.floor(rnd() * INKS.length)],
    });
  }
  // Central bulge.
  for (let i = 0; i < 240; i++) {
    const r = Math.pow(rnd(), 1.8) * 0.16;
    const theta = rnd() * Math.PI * 2;
    stars.push({
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
      size: 0.5 + rnd() * 1.0,
      alpha: 0.6 + rnd() * 0.4,
      twinkle: rnd() * Math.PI * 2,
      color: INKS[1],
    });
  }
  // Sparse halo.
  for (let i = 0; i < 110; i++) {
    const r = 0.55 + rnd() * 0.65;
    const theta = rnd() * Math.PI * 2;
    stars.push({
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
      size: 0.5 + rnd() * 0.8,
      alpha: 0.18 + rnd() * 0.28,
      twinkle: rnd() * Math.PI * 2,
      color: INKS[2],
    });
  }
  return stars;
}

const TILT = -0.42; // plane rotation (radians)
const SQUASH = 0.56; // perspective foreshortening
const SPIN_PERIOD = 200; // seconds per full revolution — barely perceptible

export function Galaxy() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const stars = buildStars();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      // Center sits high-right so the hero copy on the left stays clear.
      const cx = w * 0.68;
      const cy = h * 0.38;
      const R = Math.max(w, h) * 0.46;
      const spin = reduced ? 0.7 : (now / 1000 / SPIN_PERIOD) * Math.PI * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(TILT);
      ctx.scale(1, SQUASH);

      // Survey rings — the star-chart annotation, fixed while the field spins.
      ctx.strokeStyle = "rgba(168,196,255,.14)";
      ctx.lineWidth = 1;
      for (const rr of [0.42, 0.74, 1.02]) {
        ctx.beginPath();
        ctx.arc(0, 0, R * rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Core glow.
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
      glow.addColorStop(0, "rgba(122,162,255,.32)");
      glow.addColorStop(1, "rgba(122,162,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-R * 0.34, -R * 0.34, R * 0.68, R * 0.68);

      ctx.rotate(spin);
      const tw = now / 1000;
      for (const s of stars) {
        const a = reduced
          ? s.alpha
          : s.alpha * (0.78 + 0.22 * Math.sin(tw * 0.9 + s.twinkle));
        ctx.fillStyle = `rgba(${s.color},${a.toFixed(3)})`;
        const px = s.x * R;
        const py = s.y * R;
        ctx.fillRect(px, py, s.size, s.size);
      }
      ctx.restore();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      resize();
      if (reduced) draw(700); // re-render the single static frame
    };
    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={styles.galaxy} aria-hidden="true" />;
}
