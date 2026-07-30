/* ============================================================
   GLI NEXUS — Single View · controller
   Un prodotto alla volta. Navigazione su richiesta: frecce, dot,
   tastiera, rotella, swipe. Transizione a portale (warp + hero).

   API pubblica (window.NexusSingle) usata da detail.js e
   launcher.js — non leggono più il DOM dei pallini.
   ============================================================ */

(function () {
  const stage = document.getElementById("singleStage");
  const hero = document.getElementById("hero");
  const logoEl = document.getElementById("heroLogo");
  const nameEl = document.getElementById("heroName");
  const ctaEl = document.getElementById("heroCta");
  const ctaLabel = document.getElementById("heroCtaLabel");
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

  function applyProduct(i) {
    current = i;
    const p = projects[i];
    stage.style.setProperty("--accent", p.accent);
    document.body.dataset.world = p.backgroundType;
    if (p.logo) { logoEl.src = p.logo; logoEl.style.display = ""; }
    else logoEl.style.display = "none";
    nameEl.innerHTML = p.titleHtml;
    ctaLabel.textContent = p.cta;
    ctaEl.href = p.link || "#";
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
    document.dispatchEvent(new CustomEvent("nexus:product", { detail: p }));
  }

  function goTo(i, dir) {
    if (!visibleIndices.includes(i) || i === current || warping) return;
    dir = dir || 1;

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
        const h = prog / 0.5;
        hero.style.opacity = (1 - h).toFixed(3);
        hero.style.transform = `translateX(${(-dir * 42 * h).toFixed(1)}px)`;
      } else {
        if (!swapped) { swapped = true; applyProduct(i); }
        const h = (prog - 0.5) / 0.5;
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

  /** Salto assoluto: resetta il filtro categoria se serve, poi goTo. */
  function goToAbsolute(i) {
    if (i < 0 || i >= projects.length || warping) return;
    if (activeCategory !== "all") {
      activeCategory = "all";
      visibleIndices = projects.map((_, idx) => idx);
      syncCategoryUi();
    }
    if (i === current) return;
    goTo(i, i > current ? 1 : -1);
  }

  function moveBy(delta) {
    const position = Math.max(0, visiblePosition(current));
    const nextPosition = (position + delta + visibleIndices.length) % visibleIndices.length;
    goTo(visibleIndices[nextPosition], delta > 0 ? 1 : -1);
  }

  const next = () => moveBy(1);
  const prev = () => moveBy(-1);

  function openCurrent() {
    const link = projects[current].link;
    if (link && link !== "#") window.location.href = link;
  }

  nextButton.addEventListener("click", next);
  prevButton.addEventListener("click", prev);

  document.addEventListener("keydown", e => {
    if (!gateDone()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    else if (e.key >= "1" && e.key <= String(Math.min(9, visibleIndices.length))) {
      const i = visibleIndices[Number(e.key) - 1];
      goTo(i, visiblePosition(i) > visiblePosition(current) ? 1 : -1);
    }
    else if (e.key === "Enter" && e.target === document.body) openCurrent();
  });

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

  const drag = { active: false, id: null, x0: 0, dx: 0 };
  stage.addEventListener("pointerdown", e => {
    if (warping || drag.active) return;
    if (e.target.closest("a, button")) return;
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

  /* API per detail / launcher (niente coupling sui pallini DOM) */
  window.NexusSingle = {
    getIndex: () => current,
    getProduct: () => projects[current],
    goTo: goToAbsolute,
    isWarping: () => warping
  };

  syncCategoryUi();
  applyProduct(current);
})();
