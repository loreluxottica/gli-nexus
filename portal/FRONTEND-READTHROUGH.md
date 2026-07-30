# GLI Nexus — UI/UX Frontend Read-Through Guide

A repeatable way to review, plan, and ship portal frontend work without rediscovering the architecture every time.

Use this guide when you:

- open a PR or self-review a UI change
- add a product, detail card, or visual treatment
- debug “feels wrong” spacing, motion, or access states
- hand work to another person (or an agent) with a clear path

**Scope:** the portal at `portal/` (`index.html` + CSS + JS). Sub-apps under `projects/` have their own UI; only the entry path and access contract touch the portal.

---

## 1. Mental model (read this first)

Nexus is **one HTML page, three stacked experiences**, not three routes.

| Layer | Job | Open state | Primary files |
|-------|-----|------------|---------------|
| **Gate** | Identity splash; first entry only | `body` without `gate-done` | `gate.css`, `gate.js`, `gate-bg.js` |
| **Single / Worlds** | One product at a time + category filter | `#nexusApp` visible after gate | `single.css`, `single.js`, `worlds-data.js`, `worlds-bg.js` |
| **Detail** | “How it works” story + demo shots | `body.detail-open`, `#detailLayer.is-open` | `detail.css`, `detail.js`, `detail-data.js` |
| **Launcher** | Full product grid/search | launcher dialog open | `launcher.css`, `launcher.js` |

**Data sources (do not invent parallel stores):**

| Source | Owns |
|--------|------|
| `js/worlds-data.js` → `NEXUS_WORLDS` | id, name, category, accents, logo, CTA link(s), project key, background type |
| `js/detail-data.js` → `NEXUS_DETAILS` | problem, answer, shift, io, fit, team, connects, preview steps/shots |
| `js/access.js` → `NexusAccess` | which project keys the user may open |
| Intake forms in `Project Details/<Product>/` | Official copy + screenshots for real cards |

**Script load order** (from `index.html` — keep this order if you add scripts):

```
worlds-data → worlds-bg → access → single → kelly-egg → gate-bg → gate → detail-data → detail → launcher
```

Controllers expose small APIs (`window.NexusSingle`, `window.NexusAccess`, `NexusBG`) instead of tight imports. Prefer that pattern over bundling.

---

## 2. Design system baseline

**Tokens live only in `css/tokens.css`.** Before adding a color, radius, duration, or z-index, check tokens. New one-off hex values in component CSS are a smell unless they are product accents from `NEXUS_WORLDS`.

| Token family | Use for |
|--------------|---------|
| `--navy-*`, `--cyan`, `--azure`, `--gli-blue` | Brand surfaces and accents |
| `--text-1/2/3` | Primary / secondary / muted copy |
| `--glass`, `--card-border*` | Glass cards and chrome |
| `--font-ui`, `--font-mono`, `--track-*` | Type and micro-labels |
| `--radius-card`, `--radius-pill` | Shape language |
| `--ease-out`, `--dur-fast/med/slow` | Motion |
| `--z-bg/page/nav` | Layering (detail/launcher may add local stacking on top) |

**Visual identity in one line:** deep navy space, cyan/GLI blue accents, glass panels, monospaced micro-labels, product-colored hero accents — not generic SaaS white cards.

**CSS file roles** (edit the right file):

| File | Owns |
|------|------|
| `tokens.css` | Variables only |
| `base.css` | Reset, body, wordmark, shared focus, selection, page enter |
| `gate.css` | Gate overlay and CTA |
| `single.css` | Header, hero, nav, product stage |
| `detail.css` | Detail layer, mode bar, story panes, demo slider |
| `launcher.css` | Launcher dialog, search, grid |

Avoid dumping product-specific rules into `base.css`. Avoid duplicating token values as magic numbers.

---

## 3. Standard read-through order

Walk the product **in user order**, then **in code order**. Do not start by grepping random CSS.

### Pass A — User journey (10–15 min)

Do this in a browser (local: `python app.py` → `http://localhost:8000/`).

1. **Cold open**  
   Gate visible? Focus on “Open Nexus”? Canvas ambient without jank?
2. **Enter Nexus**  
   Gate exits cleanly; hero shows a product; background matches product; keyboard focus lands sensibly.
3. **Browse products**  
   Prev/next (or arrows), category filters, deep link `?w=galileo`.
4. **Open detail**  
   Opens on the story at 01/06; arrows and `←`/`→` step it; `D` or the DEMO pill swaps to the shots (autoplay + rail); Escape closes, focus returns to opener.
5. **CTA / access**  
   With full local access (`*`) CTA opens; mentally check “Access restricted” / “Coming soon” copy for no-grant / no-route.
6. **Launcher**  
   `A` or “Tutti i prodotti”: search, empty state, keyboard nav, Escape.
7. **Deep links**  
   `?w=<id>`, `?w=<id>&d=1&s=<step>`, `?all=1` — gate skipped as designed.
8. **Reduced motion**  
   OS “reduce motion” on: no endless heavy loops; transitions still usable.
9. **Narrow viewport**  
   ~375px and ~768px: no horizontal scroll, readable type, tappable targets.

### Pass B — Architecture check (code)

1. Does the change touch the correct layer (gate / single / detail / launcher)?  
2. Is new content in `worlds-data` / `detail-data` rather than hard-coded in HTML/JS?  
3. Are accents applied via CSS variables from the product object, not hardcoded per product in CSS?  
4. Does access still go through `NexusAccess` / `canOpenTarget`?  
5. Are new assets under `portal/assets/` and referenced with relative paths from `index.html`?

### Pass C — Diff hygiene

1. Prefer one concern per PR (copy vs layout vs motion).  
2. No drive-by renames of public IDs (`#detailLayer`, `NEXUS_WORLDS` shape).  
3. Run `python -m unittest tests.test_portal -v`.  
4. Confirm every new `shot:` / `src` / `href` local path exists on disk.

---

## 4. Checklists by concern

Copy the relevant block into a PR description or ticket.

### 4.1 Layout & visual hierarchy

- [ ] One primary action per view (Open product / Open detail / Open Nexus).
- [ ] Eye path is top identity → hero thesis → secondary tools, not competing CTAs.
- [ ] Spacing uses consistent rhythm; no accidental 13px / 17px one-offs.
- [ ] Glass cards keep readable contrast on navy (`--text-1` on glass).
- [ ] Product accent colors tint chrome, not entire background text.
- [ ] Decorative layers (`canvas`, noise, scanlines, vignette) stay `aria-hidden` and do not steal clicks.

### 4.2 Typography & copy

- [ ] UI chrome language matches existing mix (IT labels in shell, EN ok for product-owned copy when intake is EN).
- [ ] Micro-labels stay uppercase + tracked (`--track-micro`); do not use them for long sentences.
- [ ] Detail fields respect intake limits in spirit: short problem/answer, scannable shift metrics.
- [ ] CTA labels say what happens: “Open Kelly”, not “Submit” / “Click here”.
- [ ] Empty / blocked states explain next step: “Access restricted”, “Coming soon”, “Screenshot in arrivo”.
- [ ] No placeholder lorem in Live products (Cortana/Laplace/etc. may stay demo until intake lands).

### 4.3 Interaction & state

- [ ] Hover, focus-visible, active, disabled are all distinct.
- [ ] Disabled controls are not focus-trapped dead ends; use `aria-disabled` where links stay in tab order carefully.
- [ ] Overlay open → background `inert` (or equivalent); close restores focus to the control that opened it.
- [ ] Escape closes the topmost layer only (detail before launcher, etc.).
- [ ] Auto-playing demos pause or respect reduced motion; user can still step manually.
- [ ] Warp / product switch does not double-fire during animation (`isWarping` pattern).

### 4.4 Accessibility

- [ ] Interactive elements are real `<button>` / `<a>`, not clickable `<div>`.
- [ ] Icon-only buttons have `aria-label`.
- [ ] Decorative images `alt=""`; meaningful images have short alt or are described by adjacent text.
- [ ] Dialogs: `role="dialog"`, `aria-modal`, labelled.
- [ ] Focus ring uses `:focus-visible` (see `base.css`); never `outline: none` without a replacement.
- [ ] Color is not the only signal (restricted vs open; active category).
- [ ] Keyboard path equals mouse path for core tasks.

### 4.5 Motion

- [ ] Motion supports orientation (enter/leave, story step), not pure ornament.
- [ ] Durations come from tokens (`--dur-*`) or documented constants next to the feature.
- [ ] `prefers-reduced-motion: reduce` short-circuits canvas thrash and long loops.
- [ ] No layout thrash: prefer transform/opacity for transitions.
- [ ] Story/demo auto-advance timings stay readable (current detail demo ~4.2s / loop pause ~5.4s).

### 4.6 Responsive

- [ ] No horizontal page scroll at 360–1440px.
- [ ] Detail arrows move from beside the content into the stage row under 900px, without overlapping the copy.
- [ ] Touch targets ≥ ~40px where possible; dense rails remain scrollable.
- [ ] Keyboard hints (`<kbd>`) hide or shrink on small screens if they clutter (pattern already used for some hints).

### 4.7 Performance (portal-scale)

- [ ] Heavy images (detail shots) load when needed; prefer `data-src` / lazy pattern already used in detail demo if adding more.
- [ ] Canvas backgrounds stop or idle when tab hidden / layer closed where possible.
- [ ] Avoid multi‑MB PNGs for UI chrome; product demos may be larger but should stay optimized.
- [ ] No new runtime frameworks without an explicit decision — portal is static JS by design.

### 4.8 Access & security UX

- [ ] Destinations closed until `/api/my-access` resolves (no flash of open then restricted).
- [ ] Missing route → “Coming soon”; missing grant → “Access restricted”.
- [ ] Multi-link products (Laplace) list each destination with its own project key.
- [ ] External links get `target="_blank"` + `rel="noopener"`.

---

## 5. Detail card read-through (product storytelling)

This is the most content-sensitive surface. Use it when adding or editing a product story.

### Structure

One mode at a time, not two columns competing: the card opens on the story
and the DEMO pill swaps the whole body for the shots. `#detailBody[data-mode]`
(`"story"` | `"demo"`) drives every CSS state; `detail.js` `setMode()` is the
single writer.

```
┌──────────────────────── detail card ────────────────────────┐
│  logo · kicker · name · tagline · meta                      │
├─────────────────────────────────────────────────────────────┤
│                                          [ ▶ DEMO ]         │  .dmode
│  ─────────────────────────────────────────────────────────  │
│  ╭─╮  02  COSA CAMBIA ─────────────────────────────  ╭─╮    │
│  │←│   mode "story": 1 Il problema · 2 Cosa cambia   │→│    │  .dstageset
│  ╰─╯      3 Ti serve se · 4 Entra / Esce             ╰─╯    │  (2 .dpane
│           5 Si collega a (opt) · 6 Chi lo ha costruito      │   stacked)
│                                                             │
│  mode "demo": screenshot full-bleed, .dshelf sul bordo basso │
│  ───────────────────────────────────────────────────────    │
│  01──02──03──04──05──06   ·or·   steps 1–4                  │  .drailset
├─────────────────────────────────────────────────────────────┤
│  Esc · ←→ naviga · D demo          CTA → product (gated)    │
└─────────────────────────────────────────────────────────────┘
```

Both modes render the same way: pill → `.dsec-label` (step number in accent +
title in the display font) → content → rail. There is no step counter: the
numbered rail already shows the whole arc, and a `02/06` chip repeated it in
micro-type.

**Demo is full-bleed.** In `data-mode="demo"` the pane cancels the body's
horizontal padding, the mode pill and the arrows float over the image, and the
step title + caption move into `.dshelf`, a gradient strip on the bottom edge.
`.dstage` deliberately has **no frame** — the shots do not share one aspect
ratio (Galileo 1.78:1, Kelly 2.0:1, one at 1.24:1), so a fixed box sat half
empty and its fill width jumped between steps. On a 1300×880 card the image
goes from 704×396 to ~970×546.

Note the split inside the stage: `#detailScreen` holds the track/video and is
what `buildPreview()` and `close()` wipe; `.dshelf` is a sibling and survives.

Controls: `←`/`→` and the two `.dnav` arrows drive whichever mode is active
(they go dim at the ends instead of wrapping); `D` or the pill toggles the
mode; `Esc` always closes. The demo autoplay runs **only** in demo mode, and
the shots (`data-src` → `src`) stay unloaded until you switch — that is the
point of the split, one product ships a 5 MB PNG.

### Content rules

1. **Source of truth** for real products: `Project Details/<Name>/` intake + screenshots.  
2. Map form fields → `NEXUS_DETAILS[id]` (see `detail-data.js` header comment).
   `problem`, `answer` and `fitFor` are the three long blocks and accept `<b>`
   on the phrases that carry the sentence — two or three anchors per field, so
   the panel can be read in jumps instead of as a wall. Every other field is
   plain text.  
3. **Story** = recognition and trust (problem → proof → fit → IO → people).  
4. **Demo** = proof of the product UI (prefer 4 real shots; placeholders only until assets land).  
5. `connects` uses **world ids** (`"galileo"`), not project keys (`"GALILEO"`).  
6. Empty `connects` skips the “Si collega a” panel automatically.  
7. Shots live under `portal/assets/details/<id>/` and are referenced as `assets/details/...` from `shot:`.

### Screenshot checklist

- [ ] 4 images, same aspect family if possible.
- [ ] No real PII / secrets in crops.
- [ ] Filenames stable and descriptive (`step-01-…png`).
- [ ] `tests/test_portal.py` media check still finds every `shot:`.

### Approval honesty

If intake checklist is unsigned, keep README/detail header note that content is pending owner approval. Do not present demo placeholders as “Live certified” copy.

---

## 6. Adding a product (streamlined path)

Minimal path to a complete portal presence:

1. **Logo** → `portal/assets/gli-<id>.png` (and branding folder if required).  
2. **Roster** → entry in `NEXUS_WORLDS` (`id`, category, accents, `backgroundType`, `link`, `project`).  
3. **Background** → ensure `worlds-bg.js` supports `backgroundType` (reuse an existing type if possible).  
4. **Detail** (optional but expected for launch) → `NEXUS_DETAILS[id]` + shots.  
5. **Backend** → route + auth key in `app.py` / project server (outside pure UI).  
6. **Access** → project key documented; grants in `user_access`.  
7. **Tests** → destinations in `test_production_destinations_and_grants_are_present` if production-ready.  
8. **Read-through** → Pass A on that product only.

Do **not** fork `index.html` per product. Do **not** copy a whole CSS file for one accent.

---

## 7. Decision shortcuts (resolve debates fast)

| Question | Default answer |
|----------|----------------|
| Where does this string live? | Data file if product-specific; HTML if chrome chrome shell |
| New color? | Token first; product accent only if per-world |
| New animation? | Only if it teaches structure or state; always honor reduced motion |
| IT vs EN? | Shell UI EN; product story follows intake (translated to EN when form is IT) |
| Fix in CSS or JS? | Layout/paint → CSS; state/ARIA/focus → JS |
| Can’t open destination? | Access layer, not a new modal system |
| Tempted to add React/Vue? | Stop — portal is multi-page static by product decision |
| Unsure about copy tone? | Intake form > clever marketing |

---

## 8. Common failure modes (watch list)

| Symptom | Likely cause |
|---------|----------------|
| Detail opens empty / wrong product | `NEXUS_DETAILS` missing key matching `NEXUS_WORLDS.id` |
| Screenshot placeholder shows | Missing file or wrong `shot` path relative to portal root |
| CTA always restricted locally | Access API failure or `project` key mismatch |
| Focus lost after close | Missing `lastFocus` restore or `inert` not cleared |
| Gate shows every time | Deep-link / seen-session logic in `gate.js` |
| Double warp / stuck nav | Click during warp; check `isWarping` |
| Horizontal scroll on mobile | Absolute/fixed layer width; canvas or card min-width |
| Flash of wrong accent | Accent CSS vars set after paint; set on fill/open |
| Tests fail media | New `shot:` without file under `portal/` |

---

## 9. Suggested review templates

### Quick self-review (5 min)

```
[ ] Journey: gate → hero → detail → launcher → close
[ ] Keyboard: Tab, Enter, Esc, arrows where advertised
[ ] No console errors
[ ] tokens.css not bypassed for core colors
[ ] unittest portal green
```

### Full UI/UX review (30 min)

```
[ ] Pass A complete on desktop
[ ] Pass A on mobile width
[ ] Reduced motion pass
[ ] Access states: open / restricted / coming soon
[ ] Detail content vs intake (if product card)
[ ] Pass B architecture
[ ] Checklist 4.1–4.8 for touched areas
[ ] Screenshots or screen recording attached for motion/layout PRs
```

### Agent / teammate brief

```
Goal: <one sentence>
Layer: gate | single | detail | launcher | data
Sources: worlds-data / detail-data / assets / …
Out of scope: …
Acceptance: Pass A steps … + tests.test_portal
```

---

## 10. Commands

```bash
# from repo root
python app.py
# open http://localhost:8000/

python -m unittest tests.test_portal -v
```

Deep-link smoke:

```
/                       → gate (first visit)
/?w=kelly               → Kelly, skip gate
/?w=galileo&d=1         → Galileo detail open
/?w=galileo&d=1&s=2     → detail at step index
/?all=1                 → launcher open
```

---

## 11. File map cheat sheet

```
portal/
├── index.html              shell + layers markup
├── FRONTEND-READTHROUGH.md this guide
├── css/
│   ├── tokens.css          design tokens
│   ├── base.css            shared foundation
│   ├── gate.css
│   ├── single.css
│   ├── detail.css
│   └── launcher.css
├── js/
│   ├── worlds-data.js      product roster
│   ├── detail-data.js      product stories
│   ├── access.js           grants client
│   ├── single.js           hero / navigation
│   ├── detail.js           detail controller
│   ├── launcher.js         grid / search
│   ├── gate.js / gate-bg.js
│   ├── worlds-bg.js        canvas worlds
│   └── kelly-egg.js        product easter egg
└── assets/                 logos + details shots
```

---

## 12. How to use this guide week to week

1. **Before coding:** name the layer and the user step you are improving.  
2. **While coding:** keep data in data files; keep chrome in CSS tokens.  
3. **Before review:** run Pass A + portal unit tests.  
4. **In review:** paste the checklist that matches the change size.  
5. **After merge:** if you learned a new failure mode, add one line to §8.

The goal is not more process — it is **the same read-through every time**, so frontend work stays coherent as products and stories accumulate.
