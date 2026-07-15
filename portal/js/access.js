/* ============================================================
   GLI NEXUS — Access · grant per-utente da api/my-access
   Ricrea la logica del portale precedente: il server dice quali
   progetti l'utente può aprire ("*" = tutti). Il fetch fallito
   lascia tutto chiuso. I codici sono uppercase (vedi worlds-data.js).
   ============================================================ */

(function () {
  const state = { ready: false, all: false, granted: new Set() };

  state.canOpen = function (project) {
    if (!state.ready) return false;          // prima della risposta: chiuso
    if (state.all) return true;              // "*" = accesso completo
    return !!project && state.granted.has(project);
  };

  window.NexusAccess = state;

  function resolve(all, projects) {
    state.all = all;
    state.granted = new Set(projects);
    state.ready = true;
    document.dispatchEvent(new CustomEvent("nexus:access"));
  }

  fetch("api/my-access")
    .then(r => (r.ok ? r.json() : { projects: [] }))
    .then(({ projects }) => {
      const list = (Array.isArray(projects) ? projects : []).map(p => String(p).toUpperCase());
      resolve(list.includes("*"), list);
    })
    .catch(() => resolve(false, []));         // fetch fallito ⇒ tutto ristretto
})();
