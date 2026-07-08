# Galileo — Frontend (handoff)

Applicazione **Next.js (App Router) in static export**, TypeScript, **senza backend**.
Il frontend è un pacchetto autonomo: a runtime non interroga nessun database.
Tutti i dati sono "cotti" a build time importando dei file **JSON** in `src/data/`.

Il pacchetto include già uno **snapshot dei dati** funzionante: potete avviarlo
subito e vedere l'app completa, poi collegare Databricks quando volete.

---

## 1. Avviare / buildare

Serve Node.js 18+ (consigliato 20).

```bash
npm install       # una tantum
npm run dev        # anteprima locale su http://localhost:3000
npm run build      # genera la cartella out/ = sito statico pubblicabile ovunque
```

`npm run build` produce `out/` con solo **HTML/CSS/JS statici**: si può servire da
qualunque static host (S3, un web server, le static assets di Databricks, ecc.).
Nessun processo Node in produzione, nessuna API.

Config rilevante in `next.config.mjs`: `output: "export"`, `trailingSlash: true`,
`images.unoptimized: true`.

---

## 2. Come entrano i dati (il punto chiave per Databricks)

L'app **non** chiama la sorgente a runtime. Legge, a **build time**, 6 file JSON in
`src/data/`. Per aggiornare i dati: rigenerate quei JSON e rifate `npm run build`.

| File | Origine | Contenuto |
|------|---------|-----------|
| `content.json` (~236 KB) | **derivato dai dati** | Payload principale: tabella Content (volumi per prodotto/area, YoY), pagina Coverage, config della pagina Database, drill Export Labs. |
| `db.json` (~920 KB) | **derivato dai dati** | Record grezzi di spedizione (~9.676 righe), come tuple posizionali a 11 colonne. Caricato in lazy solo sulla pagina `/database`. |
| `content_trends.json` (~14 KB) | **derivato** (da `db.json`) | Serie mensili per gli sparkline di Content V2. |
| `site_analysis.json` (~200 KB) | **derivato** (da `db.json`) | Riepiloghi per singolo impianto (drill dai commenti). |
| `content_comments.json` (~1 KB) | **scritto a mano** | Commenti KPI pubblicati. Non deriva dai dati. |
| `story.json` (~2 KB) | **scritto a mano** | Testo del tour guidato. Non deriva dai dati. |

> Lo **schema autoritativo** di tutti questi JSON è documentato e tipizzato in
> **`src/data/types.ts`**. È il riferimento da rispettare quando li rigenerate.

I due file grossi (`content.json`, `db.json`) derivano oggi dall'Excel
`Galileo Frontend.xlsx` tramite gli script Python in `reference-data-pipeline/`
(vedi sotto). Gli altri due derivati sono costruiti a loro volta da `db.json`.

---

## 3. Contratto sorgente (cosa deve fornire la tabella Databricks)

Oggi la sorgente è il foglio **DB** dell'Excel: una riga per record di spedizione.
La pipeline si aspetta queste colonne (per **nome** di header, non per posizione):

| Colonna | Uso |
|---------|-----|
| `Month/Year` | Periodo (anno/mese); separa anno corrente vs anno precedente. |
| `Site` | Nome impianto. |
| `Market` | `REP` o `LM` (mai mescolati: unità diverse). |
| `Product` | `RX`, `Stock Lenses`, `Finished Frames`, `GV Frames`. |
| `Site Type` | Tipo sito (es. `Export Labs`, `Nearshore Labs`, `Local Labs to ECP`, `Mass Production | DCs`, ...). |
| `Pieces` | Pezzi. |
| `Shipments` | Spedizioni. |
| `Geographical Area` | Area geografica (APAC / EMEA / LATAM / NA). |
| `Accounting Area` | Area contabile. |
| `Customer Country` | Usato per la geo "effettiva": `Export Labs` con `Customer Country = EMEA` viene attribuito a EMEA. |

Per il passaggio a Databricks: **sostituite "leggi l'Excel" con "query sulla
tabella"** mantenendo **le stesse forme JSON in uscita** (definite in
`src/data/types.ts`). Il frontend non va toccato.

---

## 4. Pipeline dati di riferimento

In `reference-data-pipeline/` trovate gli script Python attuali (Excel → JSON),
**solo come riferimento** della logica di trasformazione e delle colonne attese.
Non giranno così come sono nel pacchetto (i percorsi puntano al repo originale):
servono a mostrare esattamente come ogni JSON viene derivato.

Ordine di esecuzione attuale:

```
extract.py                → data/raw.json          (Excel → dump grezzo)
build_content.py          → content.json + db.json
build_content_trends.py   → content_trends.json    (da db.json)
build_site_analysis.py    → site_analysis.json     (da db.json)
```

La strada consigliata su Databricks: un job che interroga la tabella e produce gli
stessi `content.json` / `db.json` (e a cascata gli altri due), poi rifà la build.

---

## 5. Struttura del progetto

```
.
├── src/
│   ├── app/           # route (landing, content, content-v2, coverage, database, styleguide)
│   ├── components/    # componenti UI
│   ├── data/          # i 6 JSON + i loader .ts + types.ts (SCHEMA AUTORITATIVO)
│   └── lib/           # helper (formattazione, metriche, tag)
├── public/            # asset statici
├── next.config.mjs    # static export
├── package.json
└── reference-data-pipeline/   # script Excel→JSON, solo riferimento
```

Note: i commenti KPI si pubblicano modificando `content_comments.json`
(quelli aggiunti dall'interfaccia restano in `localStorage` finché non vengono
copiati lì). Il testo del tour è in `story.json`.
