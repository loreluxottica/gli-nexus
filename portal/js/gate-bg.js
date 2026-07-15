/* ============================================================
   GLI NEXUS — Gate · sfondo wormhole (canvas)
   Anelli concentrici in prospettiva tunnel + streak radiali che
   accelerano verso il bordo: la sensazione di essere alle porte
   di un wormhole. setWarp(0..1) accelera tutto per la transizione
   di apertura (il portale "risucchia" verso un'altra dimensione).
     GateBG.init(canvas)
     GateBG.setWarp(0..1)
   ============================================================ */

const GateBG = (function () {
  let canvas, ctx;
  let W = 0, H = 0, DPR = 1;
  let t0 = performance.now();
  let lastT = null;
  let warp = 0;
  let running = false;
  let enabled = false;
  let rafId = null;
  let lastFrame = 0;
  let resizeRaf = null;
  const FRAME_INTERVAL = 1000 / 30;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colorCache = new Map();

  function rgb(hex) {
    let color = colorCache.get(hex);
    if (color) return color;
    const h = hex.replace("#", "");
    color = {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
    colorCache.set(hex, color);
    return color;
  }
  function rgba(hex, a) { const c = rgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; }

  function makeRng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function glowDot(x, y, r, hex, a) {
    if (!(isFinite(x) && isFinite(y) && isFinite(r)) || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  /* Anello "sfocato" senza ctx.filter: il blur gaussiano per-frame è il
     costo CPU dominante del gate. Lo stesso alone si ottiene con un
     gradiente anulare (trasparente → colore → trasparente) riempito su
     un disco, nel sistema di coordinate già traslato/ruotato/scalato. */
  function softRing(r, hex, alpha, lw, sigma) {
    const spread = sigma * 2;
    const inner = Math.max(0, r - lw / 2 - spread);
    const outer = r + lw / 2 + spread;
    if (!isFinite(outer) || outer <= inner) return;
    const span = outer - inner;
    const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
    const p1 = Math.min(1, spread / span);
    const p2 = Math.min(1, (spread + lw) / span);
    g.addColorStop(0, rgba(hex, 0));
    g.addColorStop(p1, rgba(hex, alpha));
    g.addColorStop(p2, rgba(hex, alpha));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, outer, 0, 6.2832); ctx.fill();
  }

  /* --- Anelli concentrici (tunnel) --- */
  // Palette sobria nella famiglia del GLI blue (#2F5EFF), desaturata:
  // il gate parla la lingua del master brand, senza accenti accesi.
  const rng = makeRng(4242);
  const RING_COUNT = 20;
  const RINGS = Array.from({ length: RING_COUNT }, (_, i) => ({
    f: i / (RING_COUNT - 1),
    spin: 0.5 + rng() * 0.5,               // stesso verso: rotazione coerente
    phase: rng() * 6.28,
    hue: rng() < 0.62 ? "#2B4A9E" : "#4A6FD4"
  }));

  /* --- Streak radiali (particelle risucchiate verso il bordo) --- */
  // Meno numerose e più tenui: presenza discreta, non "sciame".
  const PARTICLE_COUNT = 58;
  const PARTICLES = Array.from({ length: PARTICLE_COUNT }, () => ({
    a: rng() * 6.2832,
    d: rng(),
    sp: 0.09 + rng() * 0.16,
    hue: rng() < 0.5 ? "#9FB4E0" : "#6E8AD0"
  }));

  function draw(t, dt) {
    // L'occhio del wormhole è in asse con l'identità GLI (logo + wordmark),
    // che nel layout cade poco sopra il centro esatto del viewport.
    const cx = W / 2, cy = H * 0.455;
    const maxR = Math.hypot(W, H) * 0.62;

    // rotazione globale lenta: tutto il wormhole gira dolcemente in cerchio
    const gRot = t * 0.045;
    const swirl = t * 0.06;

    // nebulosa di fondo
    glowDot(cx, cy, maxR * 1.05, "#0A1B3E", 0.5);

    // nucleo dell'evento (event horizon), pulsa e si espande in warp.
    // A riposo è tenue: l'identità GLI gli sta sopra, quindi il nucleo
    // fa da retroilluminazione morbida senza lavare via il sottotitolo;
    // solo nel warp si accende davvero (transizione di apertura).
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.1);
    const coreR = maxR * (0.04 + warp * 0.55) * (1 + pulse * 0.08);
    glowDot(cx, cy, coreR * 2.6, "#2F5EC2", 0.14 + warp * 0.5);
    glowDot(cx, cy, coreR, "#D9E2F7", 0.12 + pulse * 0.06 + warp * 0.5);

    // anelli concentrici: spaziatura non lineare = prospettiva tunnel.
    // Il fondo del portale è sfocato e tenue (si guarda "dentro"); solo
    // avvicinandosi al bordo gli anelli diventano nitidi e definiti.
    const coreGap = maxR * 0.09;     // troppo vicino al nucleo: lo assorbe il glow
    const hazeZone = maxR * 0.34;    // zona di transizione sfocata → nitida
    RINGS.forEach(ring => {
      const depth = Math.pow(ring.f, 1.7);
      let r = maxR * (0.035 + depth * 0.98);
      r *= 1 + warp * 2.4;
      if (r < coreGap) return;
      const alpha = (0.10 + ring.f * 0.34) * Math.max(0, 1 - warp * 0.9);
      if (alpha <= 0.004) return;
      const haze = Math.max(0, Math.min(1, 1 - (r - coreGap) / (hazeZone - coreGap)));
      const rot = gRot * ring.spin + ring.phase;
      const lw = 1.2 + haze * 1.6;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      if (haze > 0.02) {
        // blur(haze*9px) ≈ σ = haze*4.5; il picco si attenua come in
        // una gaussiana vera, così la resa resta tenue come prima
        const sigma = haze * 4.5;
        const peak = Math.min(1, lw / (sigma * 2.2));
        ctx.scale(1, 0.92);
        softRing(r, ring.hue, alpha * Math.max(peak, 0.25), lw, sigma);
      } else {
        ctx.strokeStyle = rgba(ring.hue, alpha);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    });

    // streak radiali: partono lente dal centro e accelerano verso il bordo,
    // con una leggera deriva angolare che le fa spiraleggiare (moto circolare).
    const speedMul = 1 + warp * 14;
    PARTICLES.forEach(p => {
      p.d += dt * p.sp * speedMul;
      if (p.d > 1.08) { p.d = 0; p.a = Math.random() * 6.2832; }
      const ease = p.d * p.d;
      const r = ease * maxR;
      const prevR = Math.max(0, r - (6 + ease * 60 * (1 + warp * 3)));
      const ang = p.a + swirl;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const fadeOut = 1 - Math.max(0, p.d - 0.85) / 0.23;
      const alpha = Math.min(1, p.d * 2) * Math.max(0, fadeOut);
      if (alpha <= 0.01) return;
      ctx.strokeStyle = rgba(p.hue, alpha * (0.34 + warp * 0.5));
      ctx.lineWidth = 1 + ease * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + ca * prevR, cy + sa * prevR);
      ctx.lineTo(cx + ca * r, cy + sa * r);
      ctx.stroke();
    });
  }

  function frame(now) {
    if (!running) return;
    if (!reduced && now - lastFrame < FRAME_INTERVAL) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    const t = ((now - t0) / 1000) * (reduced ? 0.3 : 1);
    const dt = lastT === null ? 0 : Math.min(0.05, t - lastT);
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    draw(t, dt);
    ctx.globalCompositeOperation = "source-over";
    if (reduced) {
      running = false;
      rafId = null;
    } else {
      rafId = requestAnimationFrame(frame);
    }
  }

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    const dprLimit = Math.min(W, H) < 700 ? 1.5 : 2;
    DPR = Math.min(dprLimit, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (enabled && reduced) start();
  }

  function scheduleResize() {
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      resize();
    });
  }

  function start() {
    if (!enabled || running || document.hidden) return;
    running = true;
    lastT = null;
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastT = null;
    lastFrame = 0;
  }

  function onVisibilityChange() {
    if (document.hidden) pause();
    else start();
  }

  return {
    init(el) {
      if (enabled) return;
      canvas = el; ctx = canvas.getContext("2d");
      enabled = true;
      resize();
      window.addEventListener("resize", scheduleResize, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      start();
    },
    setWarp(v) {
      warp = Math.max(0, Math.min(1, v));
      if (reduced) start();
    },
    /* Ferma il loop quando il gate non è più visibile: senza stop il
       wormhole continuerebbe a disegnare per sempre dietro la scena. */
    stop() {
      enabled = false;
      pause();
    }
  };
})();
