/* ============================================================
   GLI NEXUS — Gate · background "Monolith Corridor" (WebGL)
   Un corridoio infinito di portali a forma di monolite GLI
   (quadrato con gli angoli alto-dx e basso-sx smussati, lo stesso
   tracciato del favicon), illuminato in GLI blue dal fondo. Il
   punto di fuga coincide con la firma GLI.
   All'avvio si accende prima la luce dietro la firma, poi i portali
   uno dopo l'altro dal fondo verso chi guarda; ogni 8 s un'onda di
   luce risale il corridoio. Al click la camera accelera, le luci dei
   portali si stirano in scie radiali e la luce del fondo riempie lo
   schermo; a luce piena il corridoio si ferma.

   Un solo triangolo a schermo intero: il fragment shader calcola
   in forma chiusa dove il raggio tocca la parete del corridoio.
   Nessuna libreria, GLSL ES 1.00 (WebGL2 o WebGL1). Senza WebGL il
   canvas resta trasparente e si vede il gradiente CSS di .gate.

   API: init(canvas, anchorEl) -> false senza WebGL · begin() avvia
   l'accensione · setWarp(0..1) · setCharge(0|1) · stop()
   ============================================================ */

const GateBG = (function () {
  const VERT = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uCenter, uCam, uLight;
uniform float uZ, uF, uBlur, uReveal, uWave, uWarp, uCharge;

const float S = 0.62;     // passo tra i portali
const float D = 0.26;     // spessore del portale (sguancio)
const float CH = 1.4667;  // smusso del monolite: |x+y| = CH
const float FOCUS = 5.0;  // profondità a fuoco
const float RAYS = 36.0;  // file di luci lungo il corridoio (scie del warp)

float gauge(vec2 q) { return max(max(abs(q.x), abs(q.y)), abs(q.x + q.y) / CH); }

// gaussiana allargata all'impronta del pixel, a energia costante
float line(float d, float w, float fp) {
  float W2 = w * w + fp * fp;
  return w * inversesqrt(W2) * exp(-d * d / W2);
}

void face(vec2 m, vec2 p, inout float z1, inout vec2 m1, inout float z2, inout vec2 m2) {
  float mp = dot(m, p);
  if (mp > 1e-4) {
    float z = uF * (1.0 - dot(m, uCam)) / mp;
    if (z < z1) { z2 = z1; m2 = m1; z1 = z; m1 = m; }
    else if (z < z2) { z2 = z; m2 = m; }
  }
}

float shadeOf(vec2 m) { return 0.58 + 0.42 * dot(-normalize(m), uLight); }

float hash(float n) { return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }

// luminanza -> palette GLI: navy deep, navy nexus, GLI blue, tint, bianco
vec3 ramp(float L) {
  vec3 c = mix(vec3(0.008, 0.031, 0.078), vec3(0.043, 0.165, 0.267), smoothstep(0.0, 0.22, L));
  c = mix(c, vec3(0.184, 0.369, 1.0), smoothstep(0.18, 0.62, L));
  c = mix(c, vec3(0.631, 0.718, 1.0), smoothstep(0.58, 0.9, L));
  return mix(c, vec3(0.918, 0.941, 1.0), smoothstep(0.9, 1.3, L));
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uRes.y;

  float z1 = 1e4, z2 = 1e4;
  vec2 m1 = vec2(1.0, 0.0), m2 = m1;
  face(vec2( 1.0,  0.0), p, z1, m1, z2, m2);
  face(vec2(-1.0,  0.0), p, z1, m1, z2, m2);
  face(vec2( 0.0,  1.0), p, z1, m1, z2, m2);
  face(vec2( 0.0, -1.0), p, z1, m1, z2, m2);
  face(vec2( 1.0,  1.0) / CH, p, z1, m1, z2, m2);
  face(vec2(-1.0, -1.0) / CH, p, z1, m1, z2, m2);

  // impronta del pixel lungo la parete, profondità di campo, motion blur
  float px = uRes.y / 900.0;
  float fpZ = z1 * length(m1) / (max(dot(m1, p), 1e-4) * uRes.y);
  float coc = 5.5 * px * abs(1.0 - FOCUS / z1);
  float blurZ = sqrt(fpZ * fpZ * (1.0 + coc * coc) + uBlur * uBlur);

  // s: posizione rispetto al bordo frontale del portale k (sguancio in [0, D))
  float v = (z1 + uZ - 0.5 * D) / S + 0.5;
  float k = floor(v);
  float s = (v - k - 0.5) * S + 0.5 * D;
  float h = clamp(0.5 * blurZ, 1e-4, 0.45 * D);
  float cov = smoothstep(-h, h, s) - smoothstep(D - h, D + h, s);

  // oltre lo sguancio il raggio esce e colpisce la faccia del portale successivo
  float zf = (s < 0.5 * D ? k : k + 1.0) * S - uZ;
  float e = max(gauge(uCam + p * zf / uF) - 1.0, 0.0);

  float seam = 0.5 - 0.5 * smoothstep(0.0, 1.5 * blurZ, z2 - z1);
  float shade = mix(shadeOf(m1), shadeOf(m2), seam);

  float a = clamp(s / D, 0.0, 1.0);
  float L = mix(0.012 + 0.20 * exp(-e / 0.07), mix(0.05, 0.40, a * a) * shade, cov);
  float depth = mix(zf, z1, cov);

  // filo di luce sui bordi (nucleo nitido + alone costante in px) e impulsi
  float dw = depth - uWave;
  float wave = exp(-dw * dw);
  // i portali più vicini restano in controluce: la luce viene dal fondo
  float backlit = mix(0.55, 1.0, smoothstep(0.6, 4.5, depth));
  float gain = (1.0 + 3.0 * wave) * (1.0 + 0.5 * uCharge + 1.5 * uWarp) * (0.65 + 0.35 * shade) * backlit;
  float bloom = 7.0 * px * fpZ;
  L += gain * (0.28 * line(s, 0.010, blurZ) + 0.70 * line(s - D, 0.014, blurZ)
             + 0.10 * line(s - D, bloom, blurZ) + 0.05 * line(s, bloom, blurZ));
  L += 0.12 * wave * cov;

  // lontano i portali scendono sotto il pixel: media, poi nebbia verso il fondo
  L = mix(0.17, L, 1.0 - smoothstep(0.25, 0.8, blurZ / S));
  L = mix(L, 0.24, 1.0 - exp(-depth * 0.07));
  // accensione dal fondo verso chi guarda: il fronte uReveal corre dalla
  // nebbia alla camera, con il bordo morbido in proporzione alla
  // profondità (largo uguale a schermo a ogni distanza)
  L *= smoothstep(0.8 * uReveal, 1.2 * uReveal, depth);

  // warp: le luci dei portali, allineate lungo il corridoio, si stirano
  // in scie radiali (la luminanza media resta la stessa, si ridistribuisce)
  float r = length(p);
  vec2 q1 = uCam + p * z1 / uF;
  float ai = RAYS * atan(q1.y, q1.x) / 6.2831853;
  float ri = floor(ai + 0.5);
  float c = cos(3.1415927 * (ai - ri - 0.4 * (hash(ri + 17.0) - 0.5)));
  float c4 = c * c * c * c;
  float M = c4 * c4 * c4 * (0.4 + 0.6 * hash(ri)) / (0.2256 * 0.7);
  float streak = smoothstep(0.08, 0.55, uWarp) * smoothstep(3.0, 9.0, 6.2831853 * r * uRes.y / RAYS);
  L *= mix(1.0, 0.4 + 0.6 * M, streak);

  // luce del fondo: si accende per prima, dietro la firma; al warp
  // inonda lo schermo
  float spread = 1.0 + 10.0 * uWarp * uWarp;
  L += (1.0 - smoothstep(8.0, 45.0, uReveal))
     * (0.20 * exp(-r * r * 70.0 / spread) + 0.10 * exp(-r * 7.0 / spread))
     * (1.0 + 0.4 * uCharge + 3.0 * uWarp);
  L = mix(L, mix(1.12, 0.74, smoothstep(0.0, 1.1, r)), smoothstep(0.55, 0.9, uWarp));

  // vignetta, più scura in basso dove stanno CTA ed endorsement
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vig = 0.5 * smoothstep(0.45, 1.2, length(q)) + 0.3 * (1.0 - smoothstep(0.0, 0.34, uv.y));
  L *= 1.0 - min(vig, 0.62) * (1.0 - uWarp);

  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(ramp(L) + (n - 0.5) * (2.5 / 255.0), 1.0);
}`;

  const UNIFORMS = ["uRes", "uCenter", "uCam", "uLight", "uZ", "uF", "uBlur", "uReveal", "uWave", "uWarp", "uCharge"];
  const MAX_PX = 2.4e6;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let canvas = null, anchor = null, gl = null, U = {};
  let W = 1, H = 1, scale = 1, quality = 1, center = [0, 0];
  let raf = 0, running = false, stopped = false, live = false, begun = false, held = false;
  let t0 = 0, last = 0, qCheck = 0, frameAvg = 16;
  let camZ = 0, blur = 0, warp = 0, charge = 0, chargeTarget = 0;
  const cam = { x: 0, y: 0 }, ptr = { x: 0, y: 0 };

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("GateBG shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function setup() {
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    U = {};
    UNIFORMS.forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  /* Centro della firma GLI dal layout (catena offset*): ignora i
     transform delle animazioni d'ingresso e d'uscita. */
  function measure() {
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (anchor && anchor.offsetWidth) {
      x = anchor.offsetWidth / 2;
      y = anchor.offsetHeight / 2;
      for (let n = anchor; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    }
    center = [x * scale, H - y * scale];
  }

  function resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    let s = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
    if (cw * ch * s * s > MAX_PX) s = Math.sqrt(MAX_PX / (cw * ch));
    scale = s;
    W = Math.max(1, Math.round(cw * s));
    H = Math.max(1, Math.round(ch * s));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    measure();
    if (reduced && begun && !stopped) render(99);
  }

  // Fronte dell'accensione, in profondità (uF / raggio a schermo): nasce
  // nella nebbia del fondo e corre verso chi guarda accelerando, il raggio
  // a schermo cresce come t²; a ~1 s ha acceso anche i portali più vicini.
  function revealAt(t) {
    const u = t / 1.15;
    return Math.max(1e-3, 1.2 / (0.02 + 1.6 * u * u));
  }

  function waveAt(t) {
    if (reduced) return -100;
    // un lampo cavalca il fronte, poi esce alle spalle della camera
    if (t < 1.9) return 1.15 * revealAt(t) - 5 * Math.max(0, t - 0.9);
    // da 2.4 s, ogni 8 s un'onda nasce nella nebbia del fondo e risale
    // verso chi guarda: compare e sparisce dove non si vede, nessuno scatto
    const tp = t - 2.4;
    return tp < 0 ? -100 : 30 - 7.5 * (tp % 8);
  }

  function draw(t) {
    const lx = -0.42 + cam.x * 1.6, ly = 0.9 + cam.y * 1.6, ll = Math.hypot(lx, ly) || 1;
    gl.uniform2f(U.uRes, W, H);
    gl.uniform2f(U.uCenter, center[0], center[1]);
    gl.uniform2f(U.uCam, cam.x, cam.y);
    gl.uniform2f(U.uLight, lx / ll, ly / ll);
    gl.uniform1f(U.uZ, camZ);
    gl.uniform1f(U.uF, 1.2 * (1 - 0.34 * warp * warp));
    gl.uniform1f(U.uBlur, blur);
    gl.uniform1f(U.uReveal, revealAt(t));
    gl.uniform1f(U.uWave, waveAt(t));
    gl.uniform1f(U.uWarp, warp);
    gl.uniform1f(U.uCharge, charge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(t) {
    draw(t);
    if (!live) { live = true; canvas.classList.add("is-live"); }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    const t = (now - t0) / 1000;
    last = now;

    charge += (chargeTarget - charge) * (1 - Math.exp(-dt * 5));
    const speed = 0.16 * (1 + 1.6 * charge) + 42 * warp * warp;
    camZ = (camZ + speed * dt) % 62;   // multiplo del passo S = 0.62: nessuno scatto
    blur = speed * dt;

    const k = 1 - Math.exp(-dt * 2.2);
    cam.x += (ptr.x * 0.14 + 0.05 * Math.sin(t * 0.13) - cam.x) * k;
    cam.y += (-ptr.y * 0.1 + 0.035 * Math.sin(t * 0.17 + 1.3) - cam.y) * k;

    render(t);

    // a luce piena il fotogramma resta fermo: la GPU resta libera per il
    // primo disegno del Worlds View, che gate.js attiva lì sotto
    if (warp >= 0.92) { held = true; pause(); return; }

    // qualità adattiva: se il frame medio resta lento, meno pixel
    frameAvg += (dt * 1000 - frameAvg) * 0.05;
    if (now - qCheck > 2500) {
      qCheck = now;
      if (frameAvg > 26 && quality > 0.55) { quality = Math.max(0.55, quality * 0.8); resize(); }
    }
  }

  function start() {
    if (!begun || running || stopped || held || reduced || document.hidden) return;
    running = true;
    last = qCheck = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointer(e) {
    ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
  }
  function onPointerOut() { ptr.x = 0; ptr.y = 0; }
  function onVisibility() { if (document.hidden) pause(); else start(); }
  function onLost(e) { e.preventDefault(); pause(); }
  function onRestored() { if (!stopped && setup()) { resize(); start(); } }

  /* Prepara contesto e listener senza disegnare: false = niente WebGL. */
  function init(el, anchorEl) {
    if (stopped) return false;
    canvas = el;
    anchor = anchorEl || null;
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
    gl = canvas.getContext("webgl2", opts) || canvas.getContext("webgl", opts);
    if (!gl || !setup()) { gl = null; return false; }

    resize();
    // primo disegno a canvas ancora invisibile: la GPU compila lo shader
    // (anche 100+ ms) mentre si attendono i font, non a intro avviata
    draw(0);
    gl.flush();
    window.addEventListener("resize", resize);
    if (document.fonts) document.fonts.ready.then(() => { if (!stopped) resize(); });
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    if (reduced) return true;

    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerOut);
    document.addEventListener("visibilitychange", onVisibility);
    return true;
  }

  /* Avvia l'accensione: gate.js la chiama quando i font GLI sono
     pronti, insieme all'ingresso della firma. */
  function begin() {
    if (!gl || begun || stopped) return;
    begun = true;
    t0 = performance.now();
    if (reduced) render(99);
    else start();
  }

  function setWarp(w) { warp = Math.max(0, Math.min(1, w)); }
  function setCharge(on) { chargeTarget = on ? 1 : 0; }

  function stop() {
    if (stopped) return;
    stopped = true;
    pause();
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    document.documentElement.removeEventListener("pointerleave", onPointerOut);
    document.removeEventListener("visibilitychange", onVisibility);
    const lose = gl && gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();   // restituisce subito la memoria GPU
  }

  return { init, begin, setWarp, setCharge, stop };
})();
