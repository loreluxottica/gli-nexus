/* ============================================================
   GLI NEXUS — Detail View · controller
   Scheda "come funziona": camera zoom, sfondo vivo, card glass.

   Un modo per volta, non due colonne che competono:
     story  (default all'apertura) il racconto in 6 passi, a tutta card
     demo   gli screenshot del prodotto, uno per passo, in autoplay
   Il pill DEMO nella barra di modo — o il tasto D — commuta il corpo.
   Le stesse due frecce (e ←/→) guidano il modo attivo, qualunque sia.

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
    screen: el("detailScreen"),
    steps: el("detailSteps"),
    caption: el("detailCaption"),
    demoTitle: el("demoTitle"),
    cta: el("detailCta"),
    ctaLabel: el("detailCtaLabel"),
    ctaWrap: el("detailCtaWrap"),
    ctaMenu: el("detailCtaMenu"),
    body: el("detailBody"),
    modeToggle: el("modeToggle"),
    modeToggleLabel: el("modeToggleLabel"),
    paneStory: el("paneStory"),
    paneDemo: el("paneDemo"),
    storyRail: el("storyRail"),
    demoRail: el("demoRail"),
    stepPrev: el("stepPrev"),
    stepNext: el("stepNext")
  };

  /* I ganci del cambio modo sono obbligatori: senza uno di loro il
     controller morirebbe alla prima addEventListener, cioè prima di
     collegare il bottone "Scopri come funziona" — e la scheda non si
     aprirebbe più, in silenzio. Il caso tipico è un index.html vecchio
     rimasto in cache accanto a un detail.js nuovo: qui lo diciamo. */
  const REQUIRED = ["body", "modeToggle", "modeToggleLabel",
                    "paneStory", "paneDemo",
                    "storyRail", "demoRail", "stepPrev", "stepNext",
                    "stage", "screen", "steps", "caption", "demoTitle"];
  const absent = REQUIRED.filter(key => !els[key]);
  if (absent.length) {
    console.error(
      "[nexus:detail] markup out of date, missing: " + absent.join(", ") +
      ". Detail card stays closed. Hard-reload past cache " +
      "(Ctrl+F5) and serve the portal via http://localhost:8000, not file://."
    );
    return;
  }

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
  let startInDemo = false;
  let stepTimer = 0;
  let trackEl = null;

  /* Storytelling: indici dei pannelli attivi (salta link se vuoto) */
  let storyActive = [];
  let storyIdx = 0;

  /* Modo corrente del corpo della card: "story" | "demo" */
  let mode = "story";
  const inDemo = () => mode === "demo";

  function currentProduct() {
    if (window.NexusSingle) return window.NexusSingle.getProduct();
    return NEXUS_WORLDS[0];
  }

  const access = () => window.NexusAccess;
  const canOpenTarget = (href, projectKey) => {
    if (window.NexusSingle) return window.NexusSingle.canOpenTarget(href, projectKey);
    if (!href || href === "#" || !projectKey) return false;
    const a = access();
    return !!(a && a.canOpen(projectKey));
  };
  const hasMenu = value => Array.isArray(value.links) && value.links.length > 0;
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function closeCtaMenu() {
    els.ctaMenu.hidden = true;
    els.ctaMenu.setAttribute("aria-hidden", "true");
    els.cta.setAttribute("aria-expanded", "false");
  }

  function openCtaMenu() {
    if (els.cta.classList.contains("is-disabled")) return;
    els.ctaMenu.hidden = false;
    els.ctaMenu.setAttribute("aria-hidden", "false");
    els.cta.setAttribute("aria-expanded", "true");
    const first = els.ctaMenu.querySelector('a:not(.is-disabled)');
    if (first) first.focus({ preventScroll: true });
  }

  function buildCtaMenu(value) {
    els.ctaMenu.textContent = "";
    value.links.forEach(item => {
      const anchor = document.createElement("a");
      anchor.className = "cta-menu-item";
      anchor.setAttribute("role", "menuitem");
      anchor.textContent = item.label;
      const allowed = canOpenTarget(item.href, item.project);
      anchor.classList.toggle("is-disabled", !allowed);
      if (allowed) {
        anchor.href = item.href;
        if (/^https?:/i.test(item.href)) {
          anchor.target = "_blank";
          anchor.rel = "noopener";
        }
        anchor.addEventListener("click", closeCtaMenu);
      } else {
        anchor.href = "#";
        anchor.setAttribute("aria-disabled", "true");
        anchor.addEventListener("click", event => event.preventDefault());
      }
      els.ctaMenu.appendChild(anchor);
    });
  }

  function applyCta(value) {
    closeCtaMenu();
    if (hasMenu(value)) {
      buildCtaMenu(value);
      const anyOpenable = value.links.some(item => canOpenTarget(item.href, item.project));
      els.ctaLabel.textContent = anyOpenable || !access().ready
        ? value.cta
        : "Access restricted";
      els.cta.href = "#";
      els.cta.setAttribute("aria-haspopup", "menu");
      els.cta.classList.toggle("is-disabled", !anyOpenable);
      els.cta.setAttribute("aria-disabled", anyOpenable ? "false" : "true");
      return;
    }

    els.cta.removeAttribute("aria-haspopup");
    els.cta.removeAttribute("aria-expanded");
    const hasRoute = !!value.link && value.link !== "#";
    const allowed = canOpenTarget(value.link, value.project);
    els.cta.classList.toggle("is-disabled", !allowed);
    if (allowed) {
      els.ctaLabel.textContent = value.cta || ("Open " + value.name);
      els.cta.href = value.link;
      els.cta.removeAttribute("aria-disabled");
      if (/^https?:/i.test(value.link)) {
        els.cta.target = "_blank";
        els.cta.rel = "noopener";
      } else {
        els.cta.removeAttribute("target");
        els.cta.removeAttribute("rel");
      }
    } else {
      els.cta.href = "#";
      els.cta.removeAttribute("target");
      els.cta.removeAttribute("rel");
      els.cta.setAttribute("aria-disabled", "true");
      els.ctaLabel.textContent = !hasRoute
        ? "Coming soon"
        : access().ready ? "Access restricted" : value.cta;
    }
  }

  /* Photo slot: real `photo` when present, otherwise a silhouette
     placeholder until headshots land in assets. */
  function personPhoto(person) {
    const label = person.name || "Team member";
    if (person.photo) {
      return `<img class="dperson-photo" src="${esc(person.photo)}" alt=""
                   width="96" height="96" loading="lazy" decoding="async">`;
    }
    return `
      <span class="dperson-photo dperson-photo--ph" role="img"
            aria-label="Photo coming soon: ${esc(label)}">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="18" r="8" stroke="currentColor" stroke-width="1.75"/>
          <path d="M10 40c2.5-8 9-12 14-12s11.5 4 14 12"
                stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </span>`;
  }

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
      .map(m => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`)
      .join("");

    /* innerHTML e non textContent: problem, answer e fitFor sono i
       tre blocchi lunghi della storia, e in `detail-data.js` portano
       <b> sui passaggi che reggono la frase. Senza, restavano muri di
       testo da rileggere da capo. Sono contenuti redazionali del
       repo, non input: stesso trattamento di titleHtml e delle
       metriche di shift. */
    els.problem.innerHTML = d.problem || "";
    els.answer.innerHTML = d.answer || "";

    /* Prima → Dopo */
    const s = d.shift;
    els.shift.innerHTML = s ? `
      <div class="dshift-cell">
        <span class="dshift-label">${esc(s.before.label)}</span>
        <b class="dshift-metric">${esc(s.before.metric)}</b>
        <span class="dshift-text">${esc(s.before.text)}</span>
      </div>
      <span class="dshift-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>
      </span>
      <div class="dshift-cell dshift-cell--after">
        <span class="dshift-label">${esc(s.after.label)}</span>
        <b class="dshift-metric">${esc(s.after.metric)}</b>
        <span class="dshift-text">${esc(s.after.text)}</span>
      </div>` : "";

    /* In / Out */
    const io = d.io || { in: [], out: [] };
    els.io.innerHTML = `
      <div>
        <p class="dio-head">What goes in</p>
        <ul>${io.in.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div>
        <p class="dio-head">What comes out</p>
        <ul class="dio-out">${io.out.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>`;

    /* Si collega a — chip nel colore dell'altro prodotto */
    const links = (d.connects || [])
      .map(id => NEXUS_WORLDS.find(w => w.id === id))
      .filter(Boolean);
    els.linksSec.dataset.skip = links.length === 0 ? "1" : "";
    els.links.innerHTML = links.map(w => `
      <span class="dlink" style="--chip:${esc(w.accent)}">
        ${w.logo ? `<img src="${esc(w.logo)}" alt="" width="64" height="64">` : ""}
        ${esc(w.name)}
      </span>`).join("");

    els.fit.innerHTML = d.fitFor || "";

    els.team.innerHTML = (d.team || []).map(person => `
      <li class="dperson">
        <span class="dperson-av">${personPhoto(person)}</span>
        <span class="dperson-text">
          <span class="dperson-name">${esc(person.name || "—")}</span>
          <span class="dperson-role">${esc(person.role || "Role TBD")}</span>
        </span>
      </li>`).join("");

    applyCta(p);

    buildPreview(d.preview || {});
    rebuildStory();
  }

  /* ---------------------------------------------------------
     Chrome condiviso dai due modi: due frecce e basta. A che
     punto sei lo dice la rail numerata in fondo alla card, che
     lo mostra già per intero — un contatore in più era la stessa
     informazione detta due volte, in caratteri piccoli.
     --------------------------------------------------------- */

  /* aria-disabled, non disabled: in demo è l'autoplay a toccare gli
     estremi, e un `disabled` che scatta sotto le dita farebbe perdere
     il focus a ogni giro. I due handler sono già no-op agli estremi. */
  function setOff(btn, off) {
    btn.classList.toggle("is-off", off);
    btn.setAttribute("aria-disabled", off ? "true" : "false");
  }

  /* Frecce nude: si spengono agli estremi invece di riavvolgere.
     Un "→" che salta da 06 a 01 senza dirlo era una trappola; per
     tornare all'inizio c'è la rail. In demo continua a ciclare solo
     l'autoplay, che è esplicito perché si vede scorrere. */
  function syncNav() {
    const idx = inDemo() ? stepIdx : storyIdx;
    const tot = inDemo() ? steps.length : storyActive.length;
    setOff(els.stepPrev, idx <= 0);
    setOff(els.stepNext, tot === 0 || idx >= tot - 1);
  }

  /* Il focus va sulla freccia avanti, così ←/→ funzionano subito;
     se è spenta (passo unico o ultimo) ripiega sul pill del modo. */
  function focusNav() {
    const target = els.stepNext.classList.contains("is-off")
      ? els.modeToggle
      : els.stepNext;
    (target || card).focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------
     Storytelling — un pannello a tutta card
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
                        aria-label="Step ${i + 1}: ${esc(title)}">
                  <b>${pad(i + 1)}</b><span>${esc(title)}</span>
                </button>`;
      }).join("");
      Array.from(els.storyRail.children).forEach(btn => {
        btn.addEventListener("click", () => showStory(Number(btn.dataset.i)));
      });
    }

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

    if (els.storyRail) {
      Array.from(els.storyRail.children).forEach((dot, idx) => {
        dot.classList.toggle("is-on", idx === storyIdx);
        dot.classList.toggle("is-done", idx < storyIdx);
        dot.setAttribute("aria-selected", idx === storyIdx ? "true" : "false");
      });
    }

    /* Finita la storia, il seguito naturale è la demo: il pill si
       accende una volta invece di restare un bottone qualunque. */
    els.modeToggle.classList.toggle(
      "is-nudge",
      !inDemo() && storyActive.length > 1 && storyIdx >= storyActive.length - 1
    );

    if (!inDemo()) syncNav();
  }

  function storyNext() {
    if (storyIdx >= storyActive.length - 1) return;
    showStory(storyIdx + 1, 1);
  }

  function storyPrev() {
    if (storyIdx <= 0) return;
    showStory(storyIdx - 1, -1);
  }

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
      <div class="dph" role="img" aria-label="Screenshot coming soon: ${esc(step.title)}">
        <span class="dph-n" aria-hidden="true">${n}</span>
        <p class="dph-soon">Screenshot coming soon</p>
      </div>`;
  }

  function buildPreview(pv) {
    steps = pv.steps || [];
    trackEl = null;
    /* Solo lo schermo: la fascia con titolo e didascalia vive nello
       stage e non va ricostruita a ogni prodotto. */
    els.screen.innerHTML = "";

    if (pv.kind === "video" && pv.video) {
      const video = document.createElement("video");
      video.className = "dvideo";
      video.src = pv.video;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";      // siamo già dentro la card: ora si può
      els.screen.appendChild(video);

    } else {
      trackEl = document.createElement("div");
      trackEl.className = "dtrack";
      trackEl.innerHTML = steps.map((s, i) => `
        <figure class="dslide">
          ${s.shot
            ? `<img class="dshot" data-src="${esc(s.shot)}" alt="${esc(s.title)}" decoding="async">`
            : placeholder(i, s)}
        </figure>`).join("");
      els.screen.appendChild(trackEl);
    }

    /* Demo step strip is hidden in CSS (stage-first). Do not build it. */
    if (els.steps) els.steps.innerHTML = "";
  }

  /* Gli screenshot pesano (uno supera i 5 MB): partono solo quando
     la slide serve davvero, cioè da quando si entra in modo demo. */
  function loadShot(idx) {
    if (!trackEl) return;
    const image = trackEl.children[idx]?.querySelector("img[data-src]");
    if (!image) return;
    image.src = image.dataset.src;
    delete image.dataset.src;
  }

  /* Entrando in demo scaldo anche la slide dopo: l'autoplay parte da
     solo e non deve trovare un buco bianco al primo avanzamento. */
  function warmNextShot() {
    loadShot(Math.min(stepIdx + 1, steps.length - 1));
  }

  function showStep(i) {
    if (steps.length) {
      stepIdx = Math.max(0, Math.min(steps.length - 1, i));
      const s = steps[stepIdx];

      if (trackEl) {
        loadShot(stepIdx);
        warmNextShot();
        trackEl.style.transform = `translateX(${-stepIdx * 100}%)`;
      }

      /* Title + caption on the shelf (bottom demo rail is intentionally off). */
      els.demoTitle.textContent = s ? s.title : "";
      els.demoTitle.dataset.n = pad(stepIdx + 1);

      els.caption.textContent = s ? s.caption : "";
      els.caption.classList.remove("is-swap");
      void els.caption.offsetWidth;          // riavvia l'animazione di scambio
      els.caption.classList.add("is-swap");
    }

    if (inDemo()) syncNav();
  }

  function scheduleStep() {
    window.clearTimeout(stepTimer);
    if (reduced || !inDemo() || steps.length < 2) return;
    const last = stepIdx >= steps.length - 1;
    stepTimer = window.setTimeout(
      () => showStep(last ? 0 : stepIdx + 1),
      last ? LOOP_PAUSE_MS : STEP_MS
    );
  }

  function demoNext() {
    if (stepIdx >= steps.length - 1) return;
    showStep(stepIdx + 1);
    scheduleStep();
  }

  function demoPrev() {
    if (stepIdx <= 0) return;
    showStep(stepIdx - 1);
    scheduleStep();
  }

  /* Con il mouse sullo stage l'utente sta guardando: niente autoplay */
  els.stage.addEventListener("mouseenter", () => window.clearTimeout(stepTimer));
  els.stage.addEventListener("mouseleave", scheduleStep);

  /* ---------------------------------------------------------
     Cambio modo — storia ⇄ demo, tutto il corpo della card
     --------------------------------------------------------- */
  function setMode(next, opts) {
    const options = opts || {};
    if (next === mode) return;
    mode = next;
    els.body.dataset.mode = mode;

    /* inert, non solo aria-hidden: il crossfade usa visibility, che
       lascia gli elementi con un box e quindi con un offsetParent —
       la trappola Tab qui sotto da sola non li escluderebbe. */
    [[els.paneStory, els.storyRail, "story"],
     [els.paneDemo, els.demoRail, "demo"]].forEach(([pane, rail, owner]) => {
      const off = owner !== mode;
      [pane, rail].forEach(node => {
        node.toggleAttribute("inert", off);
        node.setAttribute("aria-hidden", off ? "true" : "false");
      });
    });

    els.modeToggleLabel.textContent = inDemo() ? "Story" : "Demo";
    els.modeToggle.setAttribute("aria-pressed", inDemo() ? "true" : "false");
    els.modeToggle.setAttribute(
      "aria-label",
      inDemo() ? "Back to the story" : "Watch the demo"
    );
    if (inDemo()) els.modeToggle.classList.remove("is-nudge");

    if (inDemo()) {
      showStep(stepIdx);
      warmNextShot();
      scheduleStep();
    } else {
      window.clearTimeout(stepTimer);   // l'autoplay vive solo in demo
    }

    syncNav();
    if (!options.silent) focusNav();
  }

  els.stepPrev.addEventListener("click", () => (inDemo() ? demoPrev() : storyPrev()));
  els.stepNext.addEventListener("click", () => (inDemo() ? demoNext() : storyNext()));
  els.modeToggle.addEventListener("click", () => setMode(inDemo() ? "story" : "demo"));

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

    /* Si riparte sempre dalla storia: la demo è il secondo tempo. */
    setMode("story", { silent: true });

    fill(product, detail);
    document.body.classList.add("detail-open");
    layer.classList.add("is-open");
    layer.removeAttribute("aria-hidden");
    app.setAttribute("inert", "");
    if (typeof NexusBG !== "undefined" && NexusBG.pause) NexusBG.pause();
    warpPulse(0.7, 640);

    stepIdx = Math.min(startStep, Math.max(0, steps.length - 1));
    startStep = 0;
    showStory(0, 0);

    /* ?s=<n> vuol dire "guarda questa schermata": si atterra in demo */
    if (startInDemo) { startInDemo = false; setMode("demo", { silent: true }); }

    requestAnimationFrame(focusNav);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    window.clearTimeout(stepTimer);
    closeCtaMenu();

    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("detail-open");
    app.removeAttribute("inert");
    if (typeof NexusBG !== "undefined" && NexusBG.resume
        && !document.body.classList.contains("launcher-open")) {
      NexusBG.resume();
    }
    warpPulse(0.4, 480);

    // il video, se c'è, va fermato davvero
    window.setTimeout(() => { if (!isOpen) els.screen.innerHTML = ""; }, 420);

    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);

  els.cta.addEventListener("click", event => {
    if (!product) return;
    if (hasMenu(product)) {
      event.preventDefault();
      els.ctaMenu.hidden ? openCtaMenu() : closeCtaMenu();
    } else if (!canOpenTarget(product.link, product.project)) {
      event.preventDefault();
    }
  });

  document.addEventListener("pointerdown", event => {
    if (isOpen && !els.ctaMenu.hidden && !els.ctaWrap.contains(event.target)) closeCtaMenu();
  });

  document.addEventListener("nexus:access", () => {
    if (isOpen && product) applyCta(product);
  });

  /* ---------------------------------------------------------
     Mentre la scheda è aperta la pagina sotto non deve muoversi:
     intercetto in cattura, prima che gli handler di single.js
     (document/window) possano vedere l'evento.
     --------------------------------------------------------- */
  const FOCUSABLE = 'a[href]:not([aria-disabled="true"]), button:not(:disabled), [tabindex]:not([tabindex="-1"])';

  window.addEventListener("keydown", e => {
    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (!els.ctaMenu.hidden) closeCtaMenu();
      else close();
    }
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
      inDemo() ? demoNext() : storyNext();
    }
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      inDemo() ? demoPrev() : storyPrev();
    }
    else if (e.key === "d" || e.key === "D") {
      // stesso tasto che apre la scheda: dentro, commuta storia ⇄ demo
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setMode(inDemo() ? "story" : "demo");
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

  /* Deep-link: ?w=kelly&d=1 opens the card; &s=3 (only with d=1) lands
     on that demo screen. ?s= alone must not latch demo for later opens. */
  const params = new URLSearchParams(location.search);
  if (params.get("d") === "1") {
    const askedStep = Number(params.get("s"));
    if (askedStep >= 1) {
      startStep = askedStep - 1;
      startInDemo = true;
    }
    const run = () => window.setTimeout(open, reduced ? 0 : 520);
    if (gateDone()) run();
    else document.addEventListener("nexus:gate-done", run, { once: true });
  }
})();
