/* ============================================================
   GLI NEXUS — Worlds View · sfondo dinamico (canvas)
   Un solo loop rAF disegna il mondo attivo. Il controller
   chiama setWorld() al culmine del warp e setWarp() per la
   transizione a portale (che avviene tutta sul background).
     NexusBG.init(canvas)
     NexusBG.setWorld({ type, accent, accent2 })
     NexusBG.setWarp(0..1)
   Mondi: "ai" (cortana), "cosmic" (galileo), "forecast" (kelly),
   "docs" (laplace), "database" (data entry).
   ============================================================ */

const NexusBG = (function () {
  let canvas, ctx;
  let W = 0, H = 0, DPR = 1;
  let world = { type: "ai", accent: "#00D9FF", accent2: "#FF2E97" };
  let warp = 0;
  let t0 = performance.now();
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

  /* --- RNG deterministico --- */
  function makeRng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* --- Helpers disegno --- */
  function glowDot(x, y, r, hex, a) {
    // guardia: createRadialGradient lancia su valori non-finiti o raggio <= 0
    if (!(isFinite(x) && isFinite(y) && isFinite(r)) || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  /* ============================================================
     Mondo 1 · Cortana — NEURAL FIELD (assistente AI)
     (animazione ripresa da nexus-single.html, resa a tutto schermo)
     Campo neurale: nodi in orbita ellittica ampia collegati da una
     rete sinaptica, ciascuno con nucleo bianco, tutto converge in un
     core luminoso centrale. Blending normale su base scura.
     (le scanline sono un overlay CSS su body[data-world="ai"])
     ============================================================ */
  function drawCyber(t) {
    const ac = world.accent;
    const cx = W * 0.5, cy = H * 0.5;
    const base = Math.min(W, H);

    // aura del core
    glowDot(cx, cy, base * 0.52, ac, 0.10);

    // nodi su un campo neurale ampio (orbita ellittica che riempie il viewport)
    const N = 16;
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const a = i * 1.07 + t * 0.06;
      const r = base * 0.30 + Math.sin(i * 1.7 + t * 0.3) * base * 0.12;
      nodes.push({
        x: cx + Math.cos(a) * r * 1.5,
        y: cy + Math.sin(a * 0.9) * r * 0.78
      });
    }

    // connessioni (rete sinaptica)
    ctx.strokeStyle = rgba(ac, 0.13);
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if ((i + j) % 3 !== 0) continue;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }

    // nodi pulsanti con nucleo bianco
    nodes.forEach((n, idx) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + idx);
      glowDot(n.x, n.y, base * 0.018 + pulse * base * 0.01, ac, 0.4);
      ctx.fillStyle = ac;
      ctx.beginPath(); ctx.arc(n.x, n.y, 3 + pulse * 2.2, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.3, 0, 6.2832); ctx.fill();
    });

    // core luminoso centrale
    const coreSize = base * 0.05 + Math.sin(t * 1.8) * base * 0.008;
    const g = ctx.createRadialGradient(cx, cy, base * 0.01, cx, cy, coreSize * 3.6);
    g.addColorStop(0, rgba(ac, 0.72));
    g.addColorStop(0.4, rgba(ac, 0.2));
    g.addColorStop(1, rgba(ac, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, coreSize * 3.6, 0, 6.2832); ctx.fill();

    // nucleo bianco pulsante
    const cp = 0.7 + 0.3 * Math.sin(t * 2);
    ctx.fillStyle = "rgba(234,246,255,0.92)";
    ctx.beginPath(); ctx.arc(cx, cy, 3.5 + cp, 0, 6.2832); ctx.fill();
  }

  /* ============================================================
     Mondo 2 · Galileo — COSMIC
     ============================================================ */
  const COSMIC = (function () {
    const rng = makeRng(7717);
    const stars = Array.from({ length: 170 }, () => ({
      x: rng(), y: rng(),
      z: [0.35, 0.6, 1][Math.floor(rng() * 3)],
      r: 0.4 + rng() * 1.2, ph: rng() * 6.28
    }));
    const orbits = [
      { rx: 0.20, ry: 0.085, rot: -0.45, sp: 0.22, ph: 0.0, sat: 2.3 },
      { rx: 0.31, ry: 0.13, rot: -0.45, sp: -0.15, ph: 2.1, sat: 2.0 },
      { rx: 0.42, ry: 0.185, rot: -0.45, sp: 0.10, ph: 4.0, sat: 1.8 }
    ];
    const arcs = [
      { cx: 0.18, cy: 0.22, r: 0.26, a0: 0.2, a1: 1.5 },
      { cx: 0.84, cy: 0.8, r: 0.3, a0: 3.4, a1: 4.9 }
    ];
    return { stars, orbits, arcs, cx: 0.5, cy: 0.46 };
  })();

  function drawCosmic(t) {
    const ac = world.accent, ac2 = world.accent2;
    const cx = COSMIC.cx * W, cy = COSMIC.cy * H;

    glowDot(W * 0.28, H * 0.34, Math.min(W, H) * 0.5, ac2, 0.10);
    glowDot(W * 0.74, H * 0.64, Math.min(W, H) * 0.45, ac, 0.08);

    COSMIC.stars.forEach(s => {
      const drift = (t * 6 * s.z) / W;
      const x = ((s.x + drift) % 1) * W, y = s.y * H;
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + s.z) + s.ph);
      ctx.fillStyle = rgba("#FFFFFF", (0.25 + 0.55 * tw) * s.z);
      ctx.beginPath(); ctx.arc(x, y, s.r * s.z, 0, 6.2832); ctx.fill();
    });

    COSMIC.orbits.forEach(o => {
      ctx.strokeStyle = rgba(ac, 0.16);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(cx, cy, o.rx * W, o.ry * W, o.rot, 0, 6.2832); ctx.stroke();
      const a = t * o.sp + o.ph;
      const ex = o.rx * W * Math.cos(a), ey = o.ry * W * Math.sin(a);
      const x = cx + ex * Math.cos(o.rot) - ey * Math.sin(o.rot);
      const y = cy + ex * Math.sin(o.rot) + ey * Math.cos(o.rot);
      glowDot(x, y, o.sat * 5, ac, 0.6);
      ctx.fillStyle = rgba("#FFFFFF", 0.9);
      ctx.beginPath(); ctx.arc(x, y, o.sat, 0, 6.2832); ctx.fill();
    });

    glowDot(cx, cy, Math.min(W, H) * 0.09, ac, 0.4);

    ctx.lineWidth = 1.3;
    COSMIC.arcs.forEach((arc, i) => {
      ctx.strokeStyle = rgba(i ? ac2 : ac, 0.3);
      ctx.beginPath(); ctx.arc(arc.cx * W, arc.cy * H, arc.r * Math.min(W, H) * 1.4, arc.a0, arc.a1); ctx.stroke();
    });
  }

  /* ============================================================
     Mondo 3 · Data Entry — DATABASE
     (animazione ripresa da nexus-single.html, resa a tutto schermo)
     Matrice di celle che riempie il viewport + evidenziazioni che
     scorrono riga per riga (onda diagonale). Blending normale su base scura.
     ============================================================ */
  function drawDatabase(t) {
    const ac = world.accent;
    const cellW = Math.max(80, Math.min(W, H) * 0.11);
    const cellH = Math.max(38, Math.min(W, H) * 0.05);
    const cols = Math.ceil(W / cellW) + 1;
    const rows = Math.ceil(H / cellH) + 1;

    // griglia di celle a tutto schermo
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, H); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(W, r * cellH); ctx.stroke(); }

    // celle evidenziate che scorrono, una per riga → onda diagonale
    for (let r = 0; r < rows; r++) {
      const phase = (t * 1.5 + r * 0.85) % (cols + 3);
      const col = Math.floor(phase);
      if (col >= 0 && col < cols) {
        const x = col * cellW, y = r * cellH;
        glowDot(x + cellW / 2, y + cellH / 2, cellW * 0.6, ac, 0.35);
        ctx.fillStyle = rgba(ac, 0.42);
        ctx.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
      }
    }
  }

  /* ============================================================
     Mondo 4 · Kelly — FORECAST ("previsione mirata")
     (animazione ripresa da nexus-single.html, resa a tutto schermo)
     Griglia di targeting a tutto schermo + tre curve di forecast a
     tutta larghezza + reticolo che vaga. Ambra. Blending normale.
     ============================================================ */
  function drawForecast(t) {
    const ac = world.accent;
    const cx = W * 0.5, cy = H * 0.5;

    // griglia di targeting a tutto schermo
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1.5;
    const gap = Math.max(70, Math.min(W, H) * 0.11);
    for (let x = 0; x <= W + 1; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H + 1; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // curve di forecast a tutta larghezza
    ctx.strokeStyle = rgba(ac, 0.5);
    ctx.lineWidth = 2.5;
    const amp = Math.min(H * 0.12, 170);
    const k = (6.2832 * 2.4) / W;          // ~2.4 onde sull'intera larghezza
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += W / 90) {
        const y = cy + Math.sin(x * k + t * 0.9) * amp * (0.9 + c * 0.16) - (c - 1) * H * 0.06;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // reticolo target che vaga (previsione mirata)
    const tx = cx + Math.sin(t * 0.7) * W * 0.3;
    const ty = cy + Math.cos(t * 0.6) * H * 0.26;
    const R = Math.min(W, H) * 0.05;
    ctx.strokeStyle = ac;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(tx, ty, R, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, R * 0.36, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = ac;
    ctx.beginPath(); ctx.arc(tx, ty, R * 0.14, 0, 6.2832); ctx.fill();
  }

  /* ============================================================
     Mondo 5 · Laplace — DOCS (document intelligence)
     (animazione ripresa da nexus-single.html, resa a tutto schermo)
     Costellazione di documenti sparsi su tutto il viewport + linee di
     estrazione che convergono verso l'hub centrale pulsante. Blending normale.
     ============================================================ */
  const DOC_POS = [
    [0.14, 0.24], [0.14, 0.76], [0.30, 0.20], [0.30, 0.80],
    [0.86, 0.24], [0.86, 0.76], [0.70, 0.20], [0.70, 0.80]
  ];

  function drawDocs(t) {
    const ac = world.accent;
    const cx = W * 0.5, cy = H * 0.5;

    // hub centrale della conoscenza: alone
    glowDot(cx, cy, Math.min(W, H) * 0.40, ac, 0.06);

    const dw = Math.max(64, Math.min(W, H) * 0.085);
    const dh = dw * 1.28;

    DOC_POS.forEach((p, i) => {
      const dx = p[0] * W, dy = p[1] * H + Math.sin(t + i) * 10;
      const x = dx - dw / 2, y = dy - dh / 2;

      // linea di estrazione verso il centro (quadratica)
      ctx.strokeStyle = rgba(ac, 0.32);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.quadraticCurveTo((dx + cx) / 2, cy, cx, cy);
      ctx.stroke();

      // corpo documento con righe di testo
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x, y, dw, dh);
      ctx.fillStyle = rgba(ac, 0.16);
      ctx.fillRect(x + dw * 0.16, y + dh * 0.20, dw * 0.66, 2);
      ctx.fillRect(x + dw * 0.16, y + dh * 0.36, dw * 0.66, 2);
      ctx.fillRect(x + dw * 0.16, y + dh * 0.52, dw * 0.46, 2);

      // dato estratto che vola verso l'hub
      const f = (t * 0.25 + i * 0.13) % 1;
      const e = f * f * (3 - 2 * f);
      glowDot(dx + (cx - dx) * e, dy + (cy - dy) * e, 5, ac, 0.6 * (1 - f * 0.4));
    });

    // nucleo dell'hub pulsante
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.5);
    glowDot(cx, cy, Math.min(W, H) * 0.06 * (1 + pulse * 0.2), ac, 0.45);
    ctx.fillStyle = rgba(ac, 0.7);
    ctx.beginPath(); ctx.arc(cx, cy, 5 + pulse * 2, 0, 6.2832); ctx.fill();
  }

  /* --- Streak del warp (tunnel di luce, sul background) --- */
  let streaks = null;
  function drawStreaks(t) {
    if (!streaks) {
      const rng = makeRng(555);
      streaks = Array.from({ length: 64 }, () => ({ a: rng() * 6.2832, o: rng() }));
    }
    const cx = W * 0.5, cy = H * 0.5, maxR = Math.hypot(W, H) * 0.62;
    ctx.strokeStyle = rgba(world.accent, 0.55 * warp);
    ctx.lineWidth = 1.8;
    streaks.forEach(s => {
      const inner = (0.10 + (s.o + t * 0.5) % 0.85) * maxR;
      const len = maxR * (0.12 + 0.42 * warp);
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      ctx.beginPath();
      ctx.moveTo(cx + ca * inner, cy + sa * inner);
      ctx.lineTo(cx + ca * (inner + len), cy + sa * (inner + len));
      ctx.stroke();
    });
  }

  /* ============================================================
     Mondo 6 · Prism — SPECTRUM
     Un fascio di luce bianca entra da sinistra, colpisce il punto-
     prisma e si APRE in un ventaglio che scompone tutto lo spettro
     (rosso → violetto). Il ventaglio respira (si apre e si chiude),
     scintille corrono lungo ogni banda, pacchetti bianchi alimentano
     il prisma. Eco del logo Prism (triangolo + archi spettro).
     ============================================================ */
  const SPECTRUM = (function () {
    const rng = makeRng(9091);
    const bands = ["#FF5A5A", "#FF9E3D", "#FFD23D", "#4FD08A", "#3DC9FF", "#5B7CFF", "#9B6DFF"];
    const feed = Array.from({ length: 5 }, () => ({ ph: rng(), sp: 0.15 + rng() * 0.12 }));
    const sparks = bands.map(() => ({ ph: rng(), sp: 0.09 + rng() * 0.11 }));
    return { px: 0.33, py: 0.5, incAngle: -0.14, bands, feed, sparks };
  })();

  function drawSpectrum(t) {
    const P = { x: SPECTRUM.px * W, y: SPECTRUM.py * H };
    const base = Math.min(W, H);
    const bands = SPECTRUM.bands, N = bands.length;

    // apertura del ventaglio: respira lento (il fascio "si apre")
    const open = 0.5 + 0.5 * Math.sin(t * 0.45);
    const spread = 0.30 + open * 0.44;             // ampiezza angolare totale (rad)
    const center = 0.03;                           // direzione media (quasi orizzontale)
    const reach = Math.hypot(W, H) * 0.72;         // oltre il bordo destro

    // aura viola attorno al prisma
    glowDot(P.x, P.y, base * 0.5, "#6E5BE0", 0.08);

    // --- fascio incidente (luce bianca da sinistra verso il prisma) ---
    const ia = SPECTRUM.incAngle;
    const inLen = P.x / Math.cos(ia) + 40;
    const sx = P.x - Math.cos(ia) * inLen, sy = P.y - Math.sin(ia) * inLen;
    const ig = ctx.createLinearGradient(sx, sy, P.x, P.y);
    ig.addColorStop(0, rgba("#EAF0FF", 0));
    ig.addColorStop(1, rgba("#EAF0FF", 0.5));
    ctx.strokeStyle = ig; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(P.x, P.y); ctx.stroke();
    SPECTRUM.feed.forEach(f => {
      const u = (t * f.sp + f.ph) % 1;
      const x = sx + (P.x - sx) * u, y = sy + (P.y - sy) * u;
      glowDot(x, y, 6, "#EAF0FF", 0.4 * u);
      ctx.fillStyle = rgba("#FFFFFF", 0.9 * u);
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.2832); ctx.fill();
    });

    // --- corpo del fascio disperso: una banda-wedge per colore ---
    for (let i = 0; i < N; i++) {
      const a0 = center - spread / 2 + i / N * spread;
      const a1 = center - spread / 2 + (i + 1) / N * spread;
      const g = ctx.createRadialGradient(P.x, P.y, base * 0.04, P.x, P.y, reach);
      g.addColorStop(0, rgba(bands[i], 0.13));
      g.addColorStop(0.5, rgba(bands[i], 0.05));
      g.addColorStop(1, rgba(bands[i], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.arc(P.x, P.y, reach, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // --- raggi netti (asse di ogni banda) + scintille che scorrono ---
    for (let i = 0; i < N; i++) {
      const a = center - spread / 2 + (i + 0.5) / N * spread;
      const ex = P.x + Math.cos(a) * reach, ey = P.y + Math.sin(a) * reach;
      const rg = ctx.createLinearGradient(P.x, P.y, ex, ey);
      rg.addColorStop(0, rgba(bands[i], 0.6));
      rg.addColorStop(0.6, rgba(bands[i], 0.2));
      rg.addColorStop(1, rgba(bands[i], 0));
      ctx.strokeStyle = rg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(ex, ey); ctx.stroke();

      const s = SPECTRUM.sparks[i];
      const u = (t * s.sp + s.ph) % 1;
      const x = P.x + Math.cos(a) * reach * u, y = P.y + Math.sin(a) * reach * u;
      glowDot(x, y, 7, bands[i], 0.5 * (1 - u));
      ctx.fillStyle = rgba(bands[i], 0.9 * (1 - u));
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.2832); ctx.fill();
    }

    // --- nodo-prisma: dove la luce bianca si scompone ---
    const pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
    glowDot(P.x, P.y, base * 0.05 * (1 + pulse * 0.25), "#C9BEF7", 0.5);
    ctx.fillStyle = rgba("#FFFFFF", 0.92);
    ctx.beginPath(); ctx.arc(P.x, P.y, 3 + pulse, 0, 6.2832); ctx.fill();
  }

  /* --- Loop --- */
  function frame(now) {
    if (!running) return;
    if (!reduced && now - lastFrame < FRAME_INTERVAL) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    const t = ((now - t0) / 1000) * (reduced ? 0.35 : 1);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (warp > 0) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(1 + warp * 0.24, 1 + warp * 0.24);
      ctx.translate(-W / 2, -H / 2);
    }
    // I mondi ripresi da nexus-single (ai/database/forecast/docs) sono
    // calibrati per il blending normale su una base scura; gli altri
    // (cosmic/spectrum) usano il blending additivo storico.
    const nexusStyle = world.type === "ai" || world.type === "database" || world.type === "forecast" || world.type === "docs";
    if (nexusStyle) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(2,8,20,0.65)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.globalCompositeOperation = "lighter";
    }
    if (world.type === "cosmic") drawCosmic(t);
    else if (world.type === "database") drawDatabase(t);
    else if (world.type === "forecast") drawForecast(t);
    else if (world.type === "docs") drawDocs(t);
    else if (world.type === "spectrum") drawSpectrum(t);
    else drawCyber(t);
    if (warp > 0) { ctx.globalCompositeOperation = "lighter"; drawStreaks(t); }
    ctx.restore();
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
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
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
    setWorld(w) {
      world = { type: w.type, accent: w.accent, accent2: w.accent2 || w.accent };
      if (reduced) start();
    },
    setWarp(v) {
      warp = Math.max(0, Math.min(1, v));
      if (reduced) start();
    }
  };
})();
