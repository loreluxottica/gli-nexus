/* ============================================================
   GLI NEXUS — Detail View · controller
   Scheda "come funziona": camera zoom, sfondo vivo, card glass.

   Sinistra = storytelling a un passo per volta (Continua),
              con rail numerata che mostra tutto l'arco.
   Destra   = demo: screenshot del prodotto che scorrono in
              orizzontale, guidati dai bottoni sotto (auto + frecce).

   Prodotto attivo via window.NexusSingle.
   ============================================================ */

(function () {
  const layer = document.getElementById("detailLayer");
  const card = document.getElementById("detailCard");
  const scrim = document.getElementById("detailScrim");
  const openBtn = document.getElementById("detailOpen");
  const closeBtn = document.getElementById("detailClose");
  const app = document.getElementById("nexusApp");
  if (!layer || !card || !openBtn) return;

  const el = id => document.getElementById(id);
  const els = {
    logo: el("detailLogo"),
    kicker: el("detailKicker"),
    name: el("detailName"),
    tag: el("detailTag"),
    meta: el("detailMeta"),
    problem: el("detailProblem"),
    answer: el("detailAnswer"),
    shift: el("detailShift"),
    io: el("detailIo"),
    links: el("detailLinks"),
    linksSec: el("detailLinksSec"),
    fit: el("detailFit"),
    team: el("detailTeam"),
    stage: el("detailStage"),
    steps: el("detailSteps"),
    caption: el("detailCaption"),
    cta: el("detailCta"),
    ctaLabel: el("detailCtaLabel"),
    storyRail: el("storyRail"),
    storyMeterCur: el("storyMeterCur"),
    storyMeterTot: el("storyMeterTot"),
    storyPrev: el("storyPrev"),
    storyNext: el("storyNext"),
    storyNextLabel: el("storyNextLabel"),
    demoPrev: el("demoPrev"),
    demoNext: el("demoNext")
  };

  const storyPanels = Array.from(document.querySelectorAll("#storyStage .dsec[data-story]"));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gateDone = () => document.body.classList.contains("gate-done");
  const pad = n => String(n).padStart(2, "0");

  const STEP_MS = 4200;       // durata di un passo dello storyboard
  const LOOP_PAUSE_MS = 5400; // sosta sull'ultimo passo prima di ricominciare

  let isOpen = false;
  let lastFocus = null;
  let product = null;
  let detail = null;
  let steps = [];
  let stepIdx = 0;
  let startStep = 0;     // passo scenario, impostabile da ?s=<n>
  let stepTimer = 0;
  let trackEl = null;

  /* Storytelling sinistro: indici dei pannelli attivi (salta link se vuoto) */
  let storyActive = [];
  let storyIdx = 0;

  function currentProduct() {
    if (window.NexusSingle) return window.NexusSingle.getProduct();
    return NEXUS_WORLDS[0];
  }

  const initials = name => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("");

  /* ---------------------------------------------------------
     Riempimento della card
     --------------------------------------------------------- */
  function fill(p, d) {
    layer.style.setProperty("--accent", p.accent);
    layer.style.setProperty("--accent2", p.accent2 || p.accent);

    if (p.logo) { els.logo.src = p.logo; els.logo.hidden = false; }
    else els.logo.hidden = true;
    els.logo.alt = "";

    els.kicker.textContent = d.kicker || "";
    els.name.innerHTML = p.titleHtml || p.name;
    els.tag.textContent = d.tagline || "";

    els.meta.innerHTML = (d.meta || [])
      .map(m => `<div><dt>${m.label}</dt><dd>${m.value}</dd></div>`)
      .join("");

    els.problem.textContent = d.problem || "";
    els.answer.textContent = d.answer || "";

    /* Prima → Dopo */
    const s = d.shift;
    els.shift.innerHTML = s ? `
      <div class="dshift-cell">
        <span class="dshift-label">${s.before.label}</span>
        <b class="dshift-metric">${s.before.metric}</b>
        <span class="dshift-text">${s.before.text}</span>
      </div>
      <span class="dshift-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>
      </span>
      <div class="dshift-cell dshift-cell--after">
        <span class="dshift-label">${s.after.label}</span>
        <b class="dshift-metric">${s.after.metric}</b>
        <span class="dshift-text">${s.after.text}</span>
      </div>` : "";

    /* Entra / Esce */
    const io = d.io || { in: [], out: [] };
    els.io.innerHTML = `
      <div>
        <p class="dio-head">Cosa entra</p>
        <ul>${io.in.map(x => `<li>${x}</li>`).join("")}</ul>
      </div>
      <div>
        <p class="dio-head">Cosa esce</p>
        <ul class="dio-out">${io.out.map(x => `<li>${x}</li>`).join("")}</ul>
      </div>`;

    /* Si collega a — chip nel colore dell'altro prodotto */
    const links = (d.connects || [])
      .map(id => NEXUS_WORLDS.find(w => w.id === id))
      .filter(Boolean);
    els.linksSec.dataset.skip = links.length === 0 ? "1" : "";
    els.links.innerHTML = links.map(w => `
      <span class="dlink" style="--chip:${w.accent}">
        ${w.logo ? `<img src="${w.logo}" alt="" width="64" height="64">` : ""}
        ${w.name}
      </span>`).join("");

    els.fit.textContent = d.fitFor || "";

    els.team.innerHTML = (d.team || []).map(person => `
      <li class="dperson">
        <span class="dperson-av" aria-hidden="true">${initials(person.name)}</span>
        <span class="dperson-text">
          <span class="dperson-name">${person.name}</span>
          <span class="dperson-role">${person.role}</span>
        </span>
      </li>`).join("");

    els.cta.href = p.link || "#";
    els.ctaLabel.textContent = p.cta || ("Open " + p.name);

    buildPreview(d.preview || {});
    rebuildStory();
  }

  /* ---------------------------------------------------------
     Storytelling sinistro — un pannello a tutta colonna
     --------------------------------------------------------- */
  function rebuildStory() {
    storyActive = storyPanels
      .map((panel, i) => ({ panel, i }))
      .filter(({ panel }) => panel.dataset.skip !== "1")
      .map(({ i }) => i);

    if (els.storyRail) {
      /* Rail leggibile: numero + titolo di ogni passo, così l'arco
         della storia si vede tutto prima ancora di iniziare. */
      els.storyRail.innerHTML = storyActive.map((panelIdx, i) => {
        const label = storyPanels[panelIdx].querySelector(".dsec-label");
        const title = label ? label.textContent.trim() : "";
        return `<button class="dstory-step" type="button" role="tab" data-i="${i}"
                        aria-label="Passo ${i + 1}: ${title}">
                  <b>${pad(i + 1)}</b><span>${title}</span>
                </button>`;
      }).join("");
      Array.from(els.storyRail.children).forEach(btn => {
        btn.addEventListener("click", () => showStory(Number(btn.dataset.i)));
      });
    }

    if (els.storyMeterTot) els.storyMeterTot.textContent = pad(storyActive.length);
    showStory(0, 0);
  }

  function showStory(i, dir) {
    if (!storyActive.length) return;
    i = Math.max(0, Math.min(storyActive.length - 1, i));
    const prev = storyIdx;
    storyIdx = i;
    if (dir === undefined) dir = i >= prev ? 1 : -1;

    storyPanels.forEach((panel, panelIdx) => {
      const skip = panel.dataset.skip === "1";
      if (skip) {
        panel.hidden = true;
        panel.classList.remove("is-on");
        panel.setAttribute("aria-hidden", "true");
        delete panel.dataset.dir;
        return;
      }

      /* resta in layout (grid stack) per permettere il crossfade */
      panel.hidden = false;
      const on = storyActive[storyIdx] === panelIdx;
      panel.classList.toggle("is-on", on);
      panel.setAttribute("aria-hidden", on ? "false" : "true");

      if (on) {
        panel.dataset.dir = String(dir || 1);
        const label = panel.querySelector(".dsec-label");
        if (label) label.dataset.n = pad(storyIdx + 1);
      } else {
        delete panel.dataset.dir;
      }
    });

    if (els.storyMeterCur) els.storyMeterCur.textContent = pad(storyIdx + 1);

    if (els.storyRail) {
      Array.from(els.storyRail.children).forEach((dot, idx) => {
        dot.classList.toggle("is-on", idx === storyIdx);
        dot.classList.toggle("is-done", idx < storyIdx);
        dot.setAttribute("aria-selected", idx === storyIdx ? "true" : "false");
      });
    }

    const atStart = storyIdx <= 0;
    const atEnd = storyIdx >= storyActive.length - 1;
    if (els.storyPrev) els.storyPrev.disabled = atStart;
    if (els.storyNext) {
      els.storyNext.classList.toggle("is-last", atEnd);
      if (els.storyNextLabel) {
        els.storyNextLabel.textContent = atEnd ? "Ricomincia" : "Continua";
      }
    }
  }

  function storyNext() {
    if (!storyActive.length) return;
    if (storyIdx >= storyActive.length - 1) showStory(0, 1);
    else showStory(storyIdx + 1, 1);
  }

  function storyPrev() {
    if (storyIdx <= 0) return;
    showStory(storyIdx - 1, -1);
  }

  if (els.storyNext) els.storyNext.addEventListener("click", storyNext);
  if (els.storyPrev) els.storyPrev.addEventListener("click", storyPrev);

  /* ---------------------------------------------------------
     Demo — uno slider di screenshot, uno per passo:
       shots (default) immagine per passo se c'è `shot`,
                       altrimenti segnaposto generato al volo
       video           clip muta in loop, caricata solo ora
     --------------------------------------------------------- */
  /* Segnaposto: solo il numero del passo e una riga di stato.
     Titolo e descrizione stanno già nella rail e nella didascalia:
     ripeterli qui riempiva lo stage di testo doppio. */
  function placeholder(i, step) {
    const n = pad(i + 1);
    return `
      <div class="dph" role="img" aria-label="Screenshot in arrivo: ${step.title}">
        <span class="dph-n" aria-hidden="true">${n}</span>
        <p class="dph-soon">Screenshot in arrivo</p>
      </div>`;
  }

  function buildPreview(pv) {
    steps = pv.steps || [];
    trackEl = null;
    els.stage.innerHTML = "";

    if (pv.kind === "video" && pv.video) {
      const video = document.createElement("video");
      video.className = "dvideo";
      video.src = pv.video;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";      // siamo già dentro la card: ora si può
      els.stage.appendChild(video);

    } else {
      trackEl = document.createElement("div");
      trackEl.className = "dtrack";
      trackEl.innerHTML = steps.map((s, i) => `
        <figure class="dslide">
          ${s.shot ? `<img class="dshot" src="${s.shot}" alt="${s.title}">` : placeholder(i, s)}
        </figure>`).join("");
      els.stage.appendChild(trackEl);
    }

    /* Rail dei passi */
    els.steps.style.setProperty("--step-dur", STEP_MS + "ms");
    els.steps.innerHTML = steps.map((s, i) => `
      <button class="dstep" type="button" data-i="${i}">
        <b>${String(i + 1).padStart(2, "0")}</b>
        <span>${s.title}</span>
      </button>`).join("");
    Array.from(els.steps.children).forEach(btn => {
      btn.addEventListener("click", () => {
        showStep(Number(btn.dataset.i));
        scheduleStep();
      });
    });
  }

  function showStep(i) {
    if (!steps.length) return;
    stepIdx = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[stepIdx];

    Array.from(els.steps.children).forEach((btn, idx) => {
      btn.classList.toggle("is-on", idx === stepIdx);
      btn.classList.toggle("is-done", idx < stepIdx);
      btn.setAttribute("aria-current", idx === stepIdx ? "step" : "false");
    });

    if (trackEl) trackEl.style.transform = `translateX(${-stepIdx * 100}%)`;

    els.caption.textContent = s ? s.caption : "";
    els.caption.classList.remove("is-swap");
    void els.caption.offsetWidth;          // riavvia l'animazione di scambio
    els.caption.classList.add("is-swap");
  }

  function scheduleStep() {
    window.clearTimeout(stepTimer);
    if (reduced || steps.length < 2) return;
    const last = stepIdx >= steps.length - 1;
    stepTimer = window.setTimeout(
      () => showStep(last ? 0 : stepIdx + 1),
      last ? LOOP_PAUSE_MS : STEP_MS
    );
  }

  /* Frecce della demo: indietro si ferma al primo, avanti riparte in loop */
  if (els.demoPrev) els.demoPrev.addEventListener("click", () => {
    showStep(stepIdx - 1);
    scheduleStep();
  });
  if (els.demoNext) els.demoNext.addEventListener("click", () => {
    showStep(stepIdx >= steps.length - 1 ? 0 : stepIdx + 1);
    scheduleStep();
  });

  /* Con il mouse sullo stage l'utente sta guardando: niente autoplay */
  els.stage.addEventListener("mouseenter", () => window.clearTimeout(stepTimer));
  els.stage.addEventListener("mouseleave", scheduleStep);

  /* ---------------------------------------------------------
     Zoom di camera: una pulsazione di warp sullo sfondo, così
     l'ingresso nella scheda sembra un movimento, non un pannello.
     --------------------------------------------------------- */
  function warpPulse(amount, dur) {
    if (reduced || typeof NexusBG === "undefined") return;
    const t0 = performance.now();
    (function step(now) {
      const prog = Math.min(1, (now - t0) / dur);
      NexusBG.setWarp(Math.sin(prog * Math.PI) * amount);
      if (prog < 1) requestAnimationFrame(step);
      else NexusBG.setWarp(0);
    })(t0);
  }

  /* ---------------------------------------------------------
     Apertura / chiusura
     --------------------------------------------------------- */
  function open() {
    if (isOpen || !gateDone()) return;
    // sulla stessa pagina può esserci l'elenco completo: uno alla volta
    if (document.body.classList.contains("launcher-open")) return;
    product = currentProduct();
    detail = NEXUS_DETAILS[product.id];
    if (!detail) return;

    isOpen = true;
    lastFocus = document.activeElement;

    fill(product, detail);
    document.body.classList.add("detail-open");
    layer.classList.add("is-open");
    layer.removeAttribute("aria-hidden");
    app.setAttribute("inert", "");
    warpPulse(0.7, 640);

    showStep(Math.min(startStep, Math.max(0, steps.length - 1)));
    startStep = 0;
    scheduleStep();
    showStory(0, 0);

    requestAnimationFrame(() => {
      if (els.storyNext) els.storyNext.focus({ preventScroll: true });
      else card.focus({ preventScroll: true });
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    window.clearTimeout(stepTimer);

    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("detail-open");
    app.removeAttribute("inert");
    warpPulse(0.4, 480);

    // il video, se c'è, va fermato davvero
    window.setTimeout(() => { if (!isOpen) els.stage.innerHTML = ""; }, 420);

    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);

  /* ---------------------------------------------------------
     Mentre la scheda è aperta la pagina sotto non deve muoversi:
     intercetto in cattura, prima che gli handler di single.js
     (document/window) possano vedere l'evento.
     --------------------------------------------------------- */
  const FOCUSABLE = 'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])';

  window.addEventListener("keydown", e => {
    if (!isOpen) return;

    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") {
      const items = Array.from(card.querySelectorAll(FOCUSABLE))
        .filter(node => node.offsetParent !== null);
      if (items.length) {
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      showStep(Math.min(steps.length - 1, stepIdx + 1));
      scheduleStep();
    }
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      showStep(Math.max(0, stepIdx - 1));
      scheduleStep();
    }
    else if (e.key === "n" || e.key === "N") {
      // avanza lo storytelling di sinistra
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      storyNext();
    }
    else if (e.key === "b" || e.key === "B") {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      storyPrev();
    }

    e.stopPropagation();   // niente frecce/cifre alla Single View sotto
  }, true);

  window.addEventListener("wheel", e => {
    if (isOpen) e.stopPropagation();   // lo scroll interno resta, il warp no
  }, { capture: true, passive: true });

  /* Scorciatoia: D apre la scheda del prodotto a video */
  document.addEventListener("keydown", e => {
    if (isOpen || !gateDone()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target !== document.body) return;
    if (e.key === "d" || e.key === "D") { e.preventDefault(); open(); }
  });

  /* Deep-link: ?w=kelly&d=1 apre già in dettaglio; &s=3 parte dal
     terzo passo (utile per mandare a qualcuno un passo preciso). */
  const params = new URLSearchParams(location.search);
  const askedStep = Number(params.get("s"));
  if (askedStep >= 1) startStep = askedStep - 1;

  if (params.get("d") === "1") {
    const run = () => window.setTimeout(open, reduced ? 0 : 520);
    if (gateDone()) run();
    else document.addEventListener("nexus:gate-done", run, { once: true });
  }
})();
