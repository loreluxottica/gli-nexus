/* ============================================================
   GLI NEXUS — Gate · controller
   Schermata di apertura (GLI / Group Logistics Intelligence /
   Open Nexus). La firma entra insieme all'accensione del corridoio,
   appena i font GLI sono pronti. Hover o focus sulla CTA caricano il
   corridoio; al click la camera accelera nel corridoio, la firma
   vola verso chi guarda e, sotto la luce piena, il gate sfuma sulla
   suite già aperta.

   Il rito vale una volta per sessione: sui ritorni (stessa tab)
   e sui deep-link ?w=<id> si entra dritti nel Worlds View, e il
   corridoio WebGL non viene nemmeno avviato.
   ============================================================ */

(function () {
  const gate = document.getElementById("gate");
  const openBtn = document.getElementById("gateOpen");
  const app = document.getElementById("nexusApp");
  const heroName = document.getElementById("heroName");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SEEN_KEY = "gli-nexus-entered";
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch (_) { /* file:// o storage negato */ }
  const params = new URLSearchParams(location.search);
  /* Skip gate su deep-link: prodotto, detail card, o elenco completo */
  const deepLink = params.has("w") || params.get("d") === "1" || params.get("all") === "1";

  let appActive = false;
  function activateApp(moveFocus) {
    if (appActive) return;
    appActive = true;
    document.body.classList.add("gate-done");
    app.removeAttribute("aria-hidden");
    app.removeAttribute("inert");
    gate.setAttribute("aria-hidden", "true");
    // prima il rAF del focus, poi l'evento: chi apre un pannello sul
    // gate-done in un rAF (launcher.js) trova il focus già sull'hero
    if (moveFocus) requestAnimationFrame(() => heroName.focus({ preventScroll: true }));
    document.dispatchEvent(new CustomEvent("nexus:gate-done"));
  }

  if (seen || deepLink) {
    gate.classList.add("is-skipped");
    activateApp(false);
    return;
  }

  const signature = gate.querySelector(".gate-signature");
  if (!GateBG.init(document.getElementById("gateCanvas"), signature)) {
    gate.classList.add("is-static");   // niente WebGL: fondo CSS statico
  }
  // Focus sul dialog, non sulla CTA: nessun anello di focus al caricamento.
  // Enter/Spazio aprono comunque (listener sul documento qui sotto).
  gate.focus({ preventScroll: true });

  // Firma e accensione del corridoio partono insieme quando Sora e Geist
  // sono pronti (al massimo 1.5 s: a cache vuota arrivano in ~1 s): il
  // wordmark non compare mai nel font di ripiego. Fino ad allora gate.css
  // tiene fermo l'ingresso. Due fotogrammi di attesa: l'arrivo dei font
  // riimpagina tutta la pagina (un fotogramma lungo), meglio a schermo
  // ancora scuro.
  let opening = false;
  const faces = ["700 1em Sora", "500 1em Geist", "600 1em Geist"];
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {})
    : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (opening) return;
      gate.classList.add("is-ready");
      GateBG.begin();
    }));
  });

  const charge = (on) => () => GateBG.setCharge(on);
  openBtn.addEventListener("pointerenter", charge(true));
  openBtn.addEventListener("pointerleave", charge(false));
  openBtn.addEventListener("focus", charge(true));
  openBtn.addEventListener("blur", charge(false));

  function openNexus() {
    if (opening) return;
    opening = true;
    document.removeEventListener("keydown", onKey);
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (_) {}

    if (reduced) {
      gate.classList.add("is-hidden");
      GateBG.stop();
      activateApp(true);
      return;
    }

    gate.classList.add("is-leaving");

    // Warp di 1300 ms: la camera accelera, le luci si stirano in scie, la
    // firma vola verso chi guarda e la luce del fondo inonda lo schermo.
    // Il Worlds View (e la suite, launcher.js) si attiva solo sotto la luce
    // piena, dal 92%, quando il corridoio si ferma: i suoi primi disegni
    // sono pesanti e farebbero scattare il warp. Dopo sei fotogrammi
    // disegnati (la suite è a video) il gate sfuma (480 ms) e il contesto
    // WebGL viene rilasciato.
    const T = 1300, t0 = performance.now();
    let since = -1;   // fotogrammi dall'attivazione del Worlds View
    (function step(now) {
      const prog = Math.min(1, (now - t0) / T);
      GateBG.setWarp(prog);
      if (since >= 0) since++;
      else if (prog >= 0.92) { gate.classList.add("is-handoff"); activateApp(true); since = 0; }
      if (prog < 1 || since < 6) return requestAnimationFrame(step);
      gate.classList.add("is-hidden");
      setTimeout(() => GateBG.stop(), 520);
    })(t0);
  }

  function onKey(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNexus(); }
  }

  openBtn.addEventListener("click", openNexus);
  gate.addEventListener("click", openNexus);   // tutta la soglia è cliccabile
  document.addEventListener("keydown", onKey);
})();
