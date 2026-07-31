/* ============================================================
   GLI NEXUS — Easter egg di Kelly
   Doppio click sul monolite: saltello, due giri e mezzo su se
   stesso, e si ferma sull'altra faccia — dove al posto del glyph
   c'e' il casco di Kelly-087 (assets/gli-kelly-back.png).

   Un altro doppio click lo rigira. Cambiando prodotto torna
   davanti da solo. Il retro viene scaricato solo quando Kelly
   entra in scena.
   ============================================================ */

(function () {
  const PRODUCT = "kelly";
  const BACK_SRC = "assets/gli-kelly-back.png";
  const DUR = 1550;      // ms
  const TURNS = 2.5;     // giri: i due interi si vedono, il mezzo scopre il retro

  const wrap = document.getElementById("heroLogoWrap");
  const flip = document.getElementById("heroLogoFlip");
  const front = document.getElementById("heroLogo");
  const back = document.getElementById("heroLogoBack");
  if (!wrap || !flip || !front || !back) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let armed = false;      // Kelly e' il prodotto a schermo
  let backVisible = false;
  let spin = 0;           // gradi a riposo: 0 = fronte, 180 = retro
  let raf = 0;
  let landTimer = 0;

  /* --- Curve del saltello (frazioni della durata) ---------------- */
  /* Interpolatore a fotogrammi chiave, raccordo smoothstep. */
  function track(keys, p) {
    let i = 1;
    while (i < keys.length - 1 && p > keys[i][0]) i++;
    const [p0, v0] = keys[i - 1];
    const [p1, v1] = keys[i];
    let k = (p - p0) / (p1 - p0);
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    return v0 + (v1 - v0) * k * k * (3 - 2 * k);
  }

  // quota, in frazioni dell'altezza del salto (positivo = giu')
  const LIFT = [[0, 0], [0.09, 0.06], [0.44, -1], [0.80, 0], [1, 0]];
  // schiacciata: positiva = appiattito, negativa = allungato
  const SQUASH = [[0, 0], [0.09, 0.12], [0.22, -0.08], [0.68, -0.03],
                  [0.80, -0.09], [0.86, 0.13], [0.93, -0.04], [1, 0]];
  // rotazione, in frazioni del giro totale — parte con una contromossa
  const SPIN = [[0, 0], [0.08, -0.02], [0.86, 1], [1, 1]];

  /* --- Rendering ------------------------------------------------- */
  function setFace(showBack) {
    if (showBack === backVisible) return;
    backVisible = showBack;
    front.style.opacity = showBack ? "0" : "1";
    back.style.opacity = showBack ? "1" : "0";
  }

  /* Le due facce ruotano ognuna per conto suo, sfalsate di mezzo giro:
     cosi' non serve un contesto 3D condiviso. Lo scambio avviene quando
     il monolite e' di taglio, quindi non si vede. */
  function paint(angle) {
    front.style.transform = "rotateY(" + angle.toFixed(2) + "deg)";
    back.style.transform = "rotateY(" + (angle + 180).toFixed(2) + "deg)";
    setFace(Math.cos(angle * Math.PI / 180) < 0);
  }

  function reset() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (landTimer) { clearTimeout(landTimer); landTimer = 0; }
    wrap.classList.remove("is-egg-land");
    flip.style.transform = "";
    front.style.transform = "";
    back.style.transform = "";
    front.style.opacity = "";
    back.style.opacity = "";
    backVisible = false;
    spin = 0;
  }

  function land() {
    if (landTimer) clearTimeout(landTimer);
    wrap.classList.remove("is-egg-land");
    void wrap.offsetWidth;                 // riavvia l'animazione se rilanciata
    wrap.classList.add("is-egg-land");
    landTimer = window.setTimeout(function () {
      wrap.classList.remove("is-egg-land");
      landTimer = 0;
    }, 800);
  }

  function flipOver() {
    if (reduced) { setFace(!backVisible); return; }

    const rise = flip.getBoundingClientRect().height * 0.46;
    const from = spin;
    const delta = TURNS * 360;
    const t0 = performance.now();
    let landed = false;

    raf = requestAnimationFrame(function step(now) {
      // il timestamp di rAF puo' precedere t0: teniamo p dentro [0,1]
      const p = Math.max(0, Math.min(1, (now - t0) / DUR));

      const squash = track(SQUASH, p);
      flip.style.transform =
        "translateY(" + (track(LIFT, p) * rise).toFixed(2) + "px)" +
        " scale(" + (1 + squash * 0.62).toFixed(4) + "," + (1 - squash).toFixed(4) + ")";
      paint(from + delta * track(SPIN, p));

      if (!landed && p >= 0.80) { landed = true; land(); }

      if (p < 1) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        spin = (from + delta) % 360;
        flip.style.transform = "";
        paint(spin);
      }
    });
  }

  /* --- Innesco e sincronia col prodotto a schermo ---------------- */
  flip.addEventListener("dblclick", function (e) {
    if (!armed || raf) return;
    if (!document.body.classList.contains("gate-done")) return;
    if (window.NexusSingle && window.NexusSingle.isWarping()) return;
    e.preventDefault();
    flipOver();
  });

  function sync(product) {
    const on = !!product && product.id === PRODUCT;
    if (on && !back.getAttribute("src")) back.src = BACK_SRC;
    if (!on) reset();
    armed = on;
  }

  document.addEventListener("nexus:product", function (e) { sync(e.detail); });
  if (window.NexusSingle) sync(window.NexusSingle.getProduct());
})();
