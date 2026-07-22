/* ============================================================
   GLI NEXUS — Single View · controller
   Un prodotto alla volta. Si scorre SU RICHIESTA: frecce ai lati,
   dot, tastiera (frecce/1-9/Enter), rotella (uno step per gesto),
   swipe. Il passaggio è una transizione a portale (warp sullo
   sfondo + crossfade/slide dell'hero). Nessuno scorrimento
   automatico: comanda l'utente.
   ============================================================ */

(function () {
  const stage = document.getElementById("singleStage");
  const hero = document.getElementById("hero");
  const logoEl = document.getElementById("heroLogo");
  const nameEl = document.getElementById("heroName");
  const ctaEl = document.getElementById("heroCta");
  const ctaLabel = document.getElementById("heroCtaLabel");
  const ctaWrap = document.getElementById("heroCtaWrap");
  const ctaMenu = document.getElementById("heroCtaMenu");
  const counterEl = document.getElementById("singleCounter");
  const dotsBox = document.getElementById("singleDots");
  const liveEl = document.getElementById("worldLive");
  const flash = document.getElementById("warpFlash");
  const prevButton = document.getElementById("singlePrev");
  const nextButton = document.getElementById("singleNext");
  const categoryFilterEl = document.getElementById("categoryFilter");
  const categoryButtons = categoryFilterEl
    ? Array.from(categoryFilterEl.querySelectorAll(".category-toggle"))
    : [];

  const projects = NEXUS_WORLDS;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gateDone = () => document.body.classList.contains("gate-done");

  let backgroundStarted = false;
  let logosPreloaded = false;
  const preloadedLogos = [];

  function preloadLogos() {
    if (logosPreloaded) return;
    logosPreloaded = true;
    projects.forEach(project => {
      if (!project.logo) return;
      const image = new Image();
      image.decoding = "async";
      image.src = project.logo;
      preloadedLogos.push(image);
    });
  }

  function startBackground() {
    if (backgroundStarted) return;
    backgroundStarted = true;
    NexusBG.init(document.getElementById("worldCanvas"));
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preloadLogos, { timeout: 1500 });
    } else {
      window.setTimeout(preloadLogos, 350);
    }
  }

  if (gateDone()) startBackground();
  else document.addEventListener("nexus:gate-done", startBackground, { once: true });


  const wanted = new URLSearchParams(location.search).get("w");
  const startIdx = projects.findIndex(p => p.id === (wanted || NEXUS_WORLDS_START));
  let current = Math.max(0, startIdx);
  let warping = false;
  let activeCategory = "all";
  let visibleIndices = projects.map((_, i) => i);

  const visiblePosition = i => visibleIndices.indexOf(i);

  /* --- Dot --- */
  const dots = projects.map((p, i) => {
    const dot = document.createElement("button");
    dot.className = "sdot";
    dot.setAttribute("aria-label", `Go to ${p.name}`);
    dot.addEventListener("click", () => {
      const from = visiblePosition(current);
      const to = visiblePosition(i);
      goTo(i, to > from ? 1 : -1);
    });
    dotsBox.appendChild(dot);
    return dot;
  });

  const pad = n => String(n).padStart(2, "0");

  function syncCategoryUi() {
    categoryButtons.forEach(button => {
      const selected = button.dataset.category === activeCategory;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-filtered", !visibleIndices.includes(i));
    });
    const hasMultipleProducts = visibleIndices.length > 1;
    prevButton.disabled = !hasMultipleProducts;
    nextButton.disabled = !hasMultipleProducts;
  }

  function setCategory(category) {
    if (warping || category === activeCategory) return;
    const known = category === "all" || projects.some(p => p.category === category);
    if (!known) return;

    activeCategory = category;
    visibleIndices = projects.reduce((indices, project, i) => {
      if (category === "all" || project.category === category) indices.push(i);
      return indices;
    }, []);
    syncCategoryUi();

    const target = visibleIndices.includes(current) ? current : visibleIndices[0];
    applyProduct(target);
  }

  categoryButtons.forEach(button => {
    button.addEventListener("click", () => setCategory(button.dataset.category));
  });

  /* --- Accesso: un prodotto è apribile se ha una route e l'utente è
         autorizzato (grant o "*"). I prodotti senza `project` non sono
         gated; quelli con link "#" non hanno ancora una destinazione. --- */
  const access = () => window.NexusAccess;

  /* Apribilità di una destinazione (link + grant). Usata sia per la CTA
     a link singolo sia per ogni voce di un menu multi-destinazione. */
  function canOpenTarget(href, project) {
    if (!href || href === "#") return false;
    if (!project) return true;
    return !!access() && access().canOpen(project);
  }
  const isOpenable = p => canOpenTarget(p.link, p.project);
  const isItemOpenable = item => canOpenTarget(item.href, item.project);

  /* Un prodotto con più destinazioni: la CTA apre un menu a tendina. */
  const hasMenu = p => Array.isArray(p.links) && p.links.length > 0;

  /* --- Menu a tendina (prodotti multi-destinazione) --- */
  function closeMenu() {
    ctaMenu.hidden = true;
    ctaMenu.setAttribute("aria-hidden", "true");
    ctaEl.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    ctaMenu.hidden = false;
    ctaMenu.setAttribute("aria-hidden", "false");
    ctaEl.setAttribute("aria-expanded", "true");
  }

  const menuOpen = () => !ctaMenu.hidden;

  function toggleMenu() {
    if (ctaEl.classList.contains("is-disabled")) return;
    menuOpen() ? closeMenu() : openMenu();
  }

  /* Ricostruisce le voci del menu per il prodotto corrente. */
  function buildMenu(p) {
    ctaMenu.textContent = "";
    p.links.forEach(item => {
      const a = document.createElement("a");
      a.className = "cta-menu-item";
      a.setAttribute("role", "menuitem");
      const label = document.createElement("span");
      label.className = "cta-menu-label";
      label.textContent = item.label;
      a.appendChild(label);

      const allowed = isItemOpenable(item);
      const external = /^https?:/i.test(item.href);
      a.classList.toggle("is-disabled", !allowed);
      if (allowed) {
        a.href = item.href;
        if (external) { a.target = "_blank"; a.rel = "noopener"; }
        a.removeAttribute("aria-disabled");
      } else {
        a.href = "#";
        a.setAttribute("aria-disabled", "true");
        a.addEventListener("click", e => e.preventDefault());
      }
      // La navigazione avvenuta chiude il menu (utile in same-tab).
      a.addEventListener("click", () => { if (allowed) closeMenu(); });
      ctaMenu.appendChild(a);
    });
  }

  /* Stato della CTA in base all'accesso: attiva, "Access restricted"
     o "Coming soon". Per i prodotti a menu la CTA è un toggle. */
  function applyCta(p) {
    closeMenu();
    if (hasMenu(p)) {
      buildMenu(p);
      const anyOpenable = p.links.some(isItemOpenable);
      ctaLabel.textContent = p.cta;
      ctaEl.href = "#";
      ctaEl.setAttribute("aria-haspopup", "menu");
      ctaEl.setAttribute("aria-expanded", "false");
      ctaEl.classList.toggle("is-disabled", !anyOpenable);
      if (anyOpenable) ctaEl.removeAttribute("aria-disabled");
      else {
        ctaEl.setAttribute("aria-disabled", "true");
        // Prima dei grant teniamo l'etichetta prodotto (nessun flash).
        ctaLabel.textContent = access() && access().ready ? "Access restricted" : p.cta;
      }
      return;
    }

    // Prodotto a destinazione singola: comportamento storico.
    ctaEl.removeAttribute("aria-haspopup");
    ctaEl.removeAttribute("aria-expanded");
    const hasRoute = p.link && p.link !== "#";
    const allowed = isOpenable(p);
    ctaEl.classList.toggle("is-disabled", !allowed);
    if (allowed) {
      ctaLabel.textContent = p.cta;
      ctaEl.href = p.link;
      ctaEl.removeAttribute("aria-disabled");
    } else {
      ctaEl.href = "#";
      ctaEl.setAttribute("aria-disabled", "true");
      if (!hasRoute) ctaLabel.textContent = "Coming soon";
      // Prima che i grant arrivino teniamo l'etichetta del prodotto
      // (nessun flash di "Access restricted"); dopo mostriamo l'esito.
      else ctaLabel.textContent = access() && access().ready ? "Access restricted" : p.cta;
    }
  }

  /* --- Applica il prodotto (contenuto dell'hero + sfondo) --- */
  function applyProduct(i) {
    current = i;
    closeMenu();
    const p = projects[i];
    stage.style.setProperty("--accent", p.accent);
    document.body.dataset.world = p.backgroundType;
    if (p.logo) { logoEl.src = p.logo; logoEl.style.display = ""; }
    else logoEl.style.display = "none";
    nameEl.innerHTML = p.titleHtml;
    applyCta(p);
    const position = visiblePosition(i);
    const visibleCount = visibleIndices.length;
    counterEl.innerHTML = "<b>" + pad(position + 1) + "</b> / " + pad(visibleCount);
    dots.forEach((d, idx) => {
      d.classList.toggle("is-active", idx === i);
      d.setAttribute("aria-current", idx === i ? "true" : "false");
    });
    if (liveEl) {
      const scope = activeCategory === "all" ? "all products" : activeCategory;
      liveEl.textContent = p.name + ", " + (position + 1) + " of " + visibleCount + " in " + scope;
    }
    NexusBG.setWorld({ type: p.backgroundType, accent: p.accent, accent2: p.accent2 });
  }

  /* --- Transizione a portale: warp sullo sfondo + slide/fade hero --- */
  function goTo(i, dir) {
    if (!visibleIndices.includes(i) || i === current || warping) return;
    dir = dir || 1;                       // +1 = avanti (esce verso sinistra)
    closeMenu();

    if (reduced) { applyProduct(i); return; }

    warping = true;
    flash.style.setProperty("--flash", projects[i].accent);
    flash.classList.add("is-active");

    const T = 760, t0 = performance.now();
    let swapped = false;

    (function step(now) {
      const prog = Math.min(1, (now - t0) / T);
      NexusBG.setWarp(Math.sin(prog * Math.PI));

      if (prog < 0.5) {
        const h = prog / 0.5;             // 0 → 1: l'hero esce verso -dir
        hero.style.opacity = (1 - h).toFixed(3);
        hero.style.transform = `translateX(${(-dir * 42 * h).toFixed(1)}px)`;
      } else {
        if (!swapped) { swapped = true; applyProduct(i); }
        const h = (prog - 0.5) / 0.5;     // 0 → 1: il nuovo entra da +dir
        hero.style.opacity = h.toFixed(3);
        hero.style.transform = `translateX(${(dir * 42 * (1 - h)).toFixed(1)}px)`;
      }

      if (prog < 1) requestAnimationFrame(step);
      else {
        NexusBG.setWarp(0);
        hero.style.opacity = "";
        hero.style.transform = "";
        flash.classList.remove("is-active");
        warping = false;
      }
    })(t0);
  }

  function moveBy(delta) {
    const position = Math.max(0, visiblePosition(current));
    const nextPosition = (position + delta + visibleIndices.length) % visibleIndices.length;
    goTo(visibleIndices[nextPosition], delta > 0 ? 1 : -1);
  }

  const next = () => moveBy(1);
  const prev = () => moveBy(-1);

  function openCurrent() {
    const p = projects[current];
    if (hasMenu(p)) { toggleMenu(); return; }
    if (isOpenable(p)) window.location.href = p.link;
  }

  // Per i prodotti a menu la CTA è un toggle; altrimenti blocca l'anchor
  // quando il prodotto non è apribile (grant mancante, "Coming soon", o
  // grant non ancora arrivati).
  ctaEl.addEventListener("click", e => {
    const p = projects[current];
    if (hasMenu(p)) { e.preventDefault(); toggleMenu(); return; }
    if (!isOpenable(p)) e.preventDefault();
  });

  // Chiudi il menu al click fuori dalla CTA/menu.
  document.addEventListener("pointerdown", e => {
    if (menuOpen() && !ctaWrap.contains(e.target)) closeMenu();
  });

  // Quando arrivano i grant da api/my-access, riallinea la CTA corrente.
  document.addEventListener("nexus:access", () => applyCta(projects[current]));

  /* --- Frecce ai lati --- */
  nextButton.addEventListener("click", next);
  prevButton.addEventListener("click", prev);

  /* --- Tastiera --- */
  document.addEventListener("keydown", e => {
    if (!gateDone()) return;              // durante il gate comanda gate.js
    if (e.key === "Escape" && menuOpen()) { e.preventDefault(); closeMenu(); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    else if (e.key >= "1" && e.key <= String(Math.min(9, visibleIndices.length))) {
      const i = visibleIndices[Number(e.key) - 1];
      goTo(i, visiblePosition(i) > visiblePosition(current) ? 1 : -1);
    }
    else if (e.key === "Enter" && e.target === document.body) openCurrent();
  });

  /* --- Rotella / trackpad: uno step per gesto, poi cooldown --- */
  let wheelAcc = 0, wheelLastT = 0, wheelLockUntil = 0;
  window.addEventListener("wheel", e => {
    if (!gateDone()) return;
    const now = performance.now();
    if (now < wheelLockUntil) return;
    if (now - wheelLastT > 300) wheelAcc = 0;
    wheelLastT = now;
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    wheelAcc += e.deltaMode === 1 ? raw * 33 : raw;
    if (Math.abs(wheelAcc) >= 120) {
      wheelAcc > 0 ? next() : prev();
      wheelAcc = 0;
      wheelLockUntil = now + 780;
    }
  }, { passive: true });

  /* --- Swipe orizzontale: l'hero segue un po' il dito, poi commit/snap --- */
  const drag = { active: false, id: null, x0: 0, dx: 0 };
  stage.addEventListener("pointerdown", e => {
    if (warping || drag.active) return;
    if (e.target.closest("a, button")) return;   // non rubare click a CTA/frecce/dot
    drag.active = true; drag.id = e.pointerId;
    drag.x0 = e.clientX; drag.dx = 0;
  });
  window.addEventListener("pointermove", e => {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    hero.style.transform = `translateX(${(drag.dx * 0.28).toFixed(1)}px)`;
  });
  function endDrag(e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.active = false;
    const d = drag.dx;
    hero.style.transform = "";
    if (Math.abs(d) > 60) (d < 0 ? next() : prev());
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  /* --- Parallasse al puntatore (solo pointer fine, no reduced motion) --- */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    let tx = 0, ty = 0, rafP = 0;
    window.addEventListener("pointermove", e => {
      if (drag.active) return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!rafP) rafP = requestAnimationFrame(() => {
        rafP = 0;
        document.body.style.setProperty("--px", tx.toFixed(3));
        document.body.style.setProperty("--py", ty.toFixed(3));
      });
    }, { passive: true });
  }

  /* --- Stato iniziale --- */
  syncCategoryUi();
  applyProduct(current);
})();
