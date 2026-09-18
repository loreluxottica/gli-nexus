/* ============================================================
   GLI NEXUS — Access · grant per-utente da /api/my-access
   Il server dice quali progetti l'utente può aprire ("*" = tutti).
   Destinazioni chiuse finché non arriva una risposta vera.
   HTTP error / error: "lookup_failed" ≠ grant vuoto: non è
   "Access restricted", è un check fallito e si ritenta.
   I codici sono uppercase (vedi worlds-data.js).
   ============================================================ */

(function () {
  const FETCH_MS = 25000;
  const MAX_DELAY = 15000;
  const state = { ready: false, all: false, granted: new Set(), error: null };
  let delay = 1000;
  let timer = 0;

  state.canOpen = function (project) {
    if (!state.ready || state.error) return false;
    if (state.all) return true;
    return !!project && state.granted.has(project);
  };

  state.closedLabel = function (openLabel) {
    if (!state.ready) return openLabel;
    if (state.error) return "Access check failed";
    return "Access restricted";
  };

  window.NexusAccess = state;

  function resolve(all, projects, error) {
    state.all = all;
    state.granted = new Set(projects);
    state.error = error || null;
    state.ready = true;
    document.dispatchEvent(new CustomEvent("nexus:access"));
  }

  function scheduleRetry() {
    window.clearTimeout(timer);
    timer = window.setTimeout(load, delay);
    delay = Math.min(MAX_DELAY, delay * 2);
  }

  function load() {
    const ctrl = new AbortController();
    const kill = window.setTimeout(() => ctrl.abort(), FETCH_MS);
    fetch("/api/my-access", { signal: ctrl.signal, credentials: "same-origin" })
      .then(async r => {
        let data = {};
        try { data = await r.json(); } catch (e) { data = {}; }
        const projects = Array.isArray(data.projects) ? data.projects : [];
        return { projects, failed: !r.ok || data.error === "lookup_failed" };
      })
      .then(({ projects, failed }) => {
        if (failed) {
          resolve(false, [], "lookup_failed");
          scheduleRetry();
          return;
        }
        const list = projects.map(p => String(p).toUpperCase());
        delay = 1000;
        resolve(list.includes("*"), list, null);
      })
      .catch(() => {
        resolve(false, [], "lookup_failed");
        scheduleRetry();
      })
      .finally(() => window.clearTimeout(kill));
  }

  load();
})();
