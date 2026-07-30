/* ============================================================
   GLI NEXUS — launcher "tutti i prodotti"
   La suite è la home: si apre da sola all'ingresso nel Nexus.
   L'auto-open salta solo su deep-link mirati (?w= / ?d=1), che
   portano dritti a un prodotto o alla sua scheda.

   Salto prodotto via window.NexusSingle.goTo (API di single.js).
   Card ricche: stato, kicker e tagline arrivano da NEXUS_DETAILS.
   Spotlight hover: bagliore nell'accento del prodotto che segue
   il cursore (--mx / --my) — pattern riusabile altrove.
   ============================================================ */

(function () {
  const layer = document.getElementById("launcher");
  const scrim = document.getElementById("launcherScrim");
  const openBtn = document.getElementById("allProducts");
  const closeBtn = document.getElementById("launcherClose");
  const body = document.getElementById("launcherBody");
  const search = document.getElementById("launcherSearch");
  const searchHint = document.getElementById("launcherSearchHint");
  const countEl = document.getElementById("launcherCount");
  const emptyEl = document.getElementById("launcherEmpty");
  const app = document.getElementById("nexusApp");
  if (!layer || !openBtn || !body) return;

  const GROUP_LABELS = {
    ai: "AI",
    analytics: "Analytics",
    reporting: "Reporting"
  };
  const GROUP_ORDER = ["ai", "analytics", "reporting"];

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const gateDone = () => document.body.classList.contains("gate-done");

  let isOpen = false;
  let lastFocus = null;
  const tiles = [];

  const groups = [];
  NEXUS_WORLDS.forEach(product => {
    let group = groups.find(g => g.id === product.category);
    if (!group) {
      group = { id: product.category, items: [] };
      groups.push(group);
    }
    group.items.push(product);
  });
  groups.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.id), ib = GROUP_ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const detailOf = id =>
    (typeof NEXUS_DETAILS !== "undefined" && NEXUS_DETAILS[id]) || null;

  /* Status badge: read from meta ("Status") on the detail card. */
  function statusOf(id) {
    const det = detailOf(id);
    if (!det || !det.meta) return null;
    const m = det.meta.find(x => x.label === "Status" || x.label === "Stato");
    if (!m || !m.value) return null;
    const key = m.value.trim().toLowerCase();
    return {
      label: m.value,
      cls: key === "live" ? "is-live" : key === "beta" ? "is-beta" : ""
    };
  }

  let n = 0;
  groups.forEach(group => {
    const section = document.createElement("section");
    section.className = "lsection";
    section.dataset.group = group.id;

    const head = document.createElement("h3");
    head.className = "lsection-head";
    head.innerHTML = `<b>${GROUP_LABELS[group.id] || group.id}</b>
                      <span class="lsection-count">${String(group.items.length).padStart(2, "0")}</span>`;
    section.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "lgrid";
    section.appendChild(grid);

    group.items.forEach(product => {
      const index = NEXUS_WORLDS.indexOf(product);
      const det = detailOf(product.id) || {};
      const status = statusOf(product.id);
      const kicker = det.kicker || GROUP_LABELS[product.category] || product.category;
      const tagline = det.tagline || "";

      /* href stays "#" so middle-click / open-in-new-tab cannot bypass the
         portal access gate for external apps. Tiles only select the world. */
      const tile = document.createElement("a");
      tile.className = "ltile";
      tile.href = "#";
      tile.dataset.index = index;
      tile.style.setProperty("--paccent", product.accent);
      tile.style.setProperty("--n", n++);
      tile.setAttribute("aria-label", product.name + " — " + kicker);
      tile.innerHTML = `
        <span class="ltile-top">
          <span class="ltile-art">
            ${product.logo
              ? `<img src="${product.logo}" alt="" width="96" height="96">`
              : ""}
          </span>
          ${status
            ? `<span class="ltile-status ${status.cls}"><i></i>${status.label}</span>`
            : ""}
        </span>
        <span class="ltile-name">${product.name}</span>
        <span class="ltile-kicker">${kicker}</span>
        <span class="ltile-tag">${tagline}</span>
        <span class="ltile-open" aria-hidden="true">View
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
        </span>
        <span class="ltile-flag" aria-hidden="true"></span>`;

      const selectOnly = e => {
        e.preventDefault();
        pick(index);
      };
      tile.addEventListener("click", selectOnly);
      tile.addEventListener("auxclick", selectOnly);

      /* Spotlight: il bagliore segue il cursore sulla card
         (solo pointer fini, mai con reduced motion). */
      if (!reduced && finePointer) {
        tile.addEventListener("pointermove", e => {
          const r = tile.getBoundingClientRect();
          tile.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
          tile.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
        });
      }

      grid.appendChild(tile);
      tiles.push({ el: tile, section: section, product: product, index: index });
    });

    body.appendChild(section);
  });

  countEl.innerHTML = "<b>" + String(NEXUS_WORLDS.length).padStart(2, "0") + "</b> products";
  if (NEXUS_WORLDS.length > 12) layer.setAttribute("data-dense", "");

  function pick(index) {
    if (window.NexusSingle) window.NexusSingle.goTo(index);
    close();
  }

  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;

    tiles.forEach(tile => {
      const p = tile.product;
      const hay = (p.name + " " + (p.category || "") + " " + (GROUP_LABELS[p.category] || "")).toLowerCase();
      const on = !q || hay.indexOf(q) >= 0;
      tile.el.hidden = !on;
      if (on) shown++;
    });

    body.querySelectorAll(".lsection").forEach(section => {
      section.hidden = !section.querySelector(".ltile:not([hidden])");
    });

    emptyEl.hidden = shown > 0;
    if (searchHint) searchHint.hidden = !(q && shown > 0);
    countEl.innerHTML = q
      ? "<b>" + String(shown).padStart(2, "0") + "</b> of " + String(tiles.length).padStart(2, "0")
      : "<b>" + String(tiles.length).padStart(2, "0") + "</b> products";
  }

  search.addEventListener("input", applyFilter);

  const visibleTiles = () => tiles.filter(t => !t.el.hidden).map(t => t.el);

  function moveFocus(dx, dy) {
    const list = visibleTiles();
    if (!list.length) return;

    const at = list.indexOf(document.activeElement);
    if (at < 0) { list[0].focus(); return; }

    if (dx) {
      const next = Math.min(list.length - 1, Math.max(0, at + dx));
      list[next].focus();
      return;
    }

    const here = list[at].getBoundingClientRect();
    let best = null, bestScore = Infinity;
    list.forEach((el, i) => {
      if (i === at) return;
      const r = el.getBoundingClientRect();
      const down = r.top > here.top + here.height * 0.5;
      const up = r.bottom < here.bottom - here.height * 0.5;
      if ((dy > 0 && !down) || (dy < 0 && !up)) return;
      const score = Math.abs(r.left - here.left) + Math.abs(r.top - here.top) * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) best.focus();
  }

  function currentIndex() {
    if (window.NexusSingle) return window.NexusSingle.getIndex();
    return 0;
  }

  function markCurrent() {
    const at = currentIndex();
    tiles.forEach(tile => {
      tile.el.classList.toggle("is-current", tile.index === at);
    });
  }

  function open() {
    if (isOpen || !gateDone()) return;
    if (document.body.classList.contains("detail-open")) return;
    isOpen = true;
    document.body.classList.add("launcher-open");
    lastFocus = document.activeElement;

    markCurrent();
    search.value = "";
    applyFilter();
    body.scrollTop = 0;

    layer.classList.add("is-open");
    layer.removeAttribute("aria-hidden");
    app.setAttribute("inert", "");
    if (typeof NexusBG !== "undefined" && NexusBG.pause) NexusBG.pause();

    requestAnimationFrame(() => {
      const current = body.querySelector(".ltile.is-current") || visibleTiles()[0];
      if (current) current.focus({ preventScroll: true });
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove("launcher-open");
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    app.removeAttribute("inert");
    if (typeof NexusBG !== "undefined" && NexusBG.resume) NexusBG.resume();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);

  window.addEventListener("keydown", e => {
    if (!isOpen) return;
    const onSearch = e.target === search;

    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" && !onSearch) { e.preventDefault(); moveFocus(1, 0); }
    else if (e.key === "ArrowLeft" && !onSearch) { e.preventDefault(); moveFocus(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(0, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(0, -1); }
    else if (e.key === "Enter" && onSearch) {
      e.preventDefault();
      const first = visibleTiles()[0];
      if (first) pick(Number(first.dataset.index));
    }
    else if (e.key === "Tab") {
      const focusables = Array.from(
        layer.querySelectorAll('a[href], button:not(:disabled), input')
      ).filter(node => node.offsetParent !== null);
      if (focusables.length) {
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    else if (!onSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      search.focus();
      search.value += e.key;
      applyFilter();
    }

    e.stopPropagation();
  }, true);

  window.addEventListener("wheel", e => {
    if (isOpen) e.stopPropagation();
  }, { capture: true, passive: true });

  document.addEventListener("keydown", e => {
    if (isOpen || !gateDone()) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target !== document.body) return;
    if (e.key === "a" || e.key === "A") { e.preventDefault(); open(); }
  });

  /* Landing: entrare nel Nexus significa vedere la suite. Niente
     auto-open su deep-link mirati: ?w=<id> va dritto al prodotto,
     ?d=1 alla sua scheda (?all=1 resta supportato: è il default). */
  const params = new URLSearchParams(location.search);
  if (!params.has("w") && params.get("d") !== "1") {
    const run = () => window.setTimeout(open, reduced ? 0 : 420);
    if (gateDone()) run();
    else document.addEventListener("nexus:gate-done", run, { once: true });
  }
})();
