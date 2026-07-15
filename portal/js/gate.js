/* ============================================================
   GLI NEXUS — Gate · controller
   Schermata di apertura (GLI / Group Logistics Intelligence /
   Open Nexus). Al click accelera il wormhole e sfuma verso il
   Worlds View sottostante.

   Il rito vale una volta per sessione: sui ritorni (stessa tab)
   e sui deep-link ?w=<id> si entra dritti nel Worlds View, e il
   wormhole non viene nemmeno avviato.
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
  const deepLink = new URLSearchParams(location.search).has("w");

  let appActive = false;
  function activateApp(moveFocus) {
    if (appActive) return;
    appActive = true;
    document.body.classList.add("gate-done");
    app.removeAttribute("aria-hidden");
    app.removeAttribute("inert");
    gate.setAttribute("aria-hidden", "true");
    document.dispatchEvent(new CustomEvent("nexus:gate-done"));
    if (moveFocus) requestAnimationFrame(() => heroName.focus({ preventScroll: true }));
  }

  if (seen || deepLink) {
    gate.classList.add("is-skipped");
    activateApp(false);
    return;
  }

  GateBG.init(document.getElementById("gateCanvas"));
  openBtn.focus({ preventScroll: true });

  let opening = false;
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
    activateApp(true);

    const T = 900, start = performance.now();
    (function step(now) {
      const prog = Math.min(1, (now - start) / T);
      GateBG.setWarp(prog);
      if (prog < 1) requestAnimationFrame(step);
      else {
        gate.classList.add("is-hidden");
        // il gate resta a video il tempo della dissolvenza (620ms),
        // poi il canvas può fermarsi davvero
        setTimeout(() => GateBG.stop(), 700);
      }
    })(start);
  }

  function onKey(e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNexus(); }
  }

  openBtn.addEventListener("click", openNexus);
  gate.addEventListener("click", openNexus);   // tutta la soglia è cliccabile
  document.addEventListener("keydown", onKey);
})();
