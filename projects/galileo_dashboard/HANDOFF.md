# Galileo — Frontend (handoff)

Applicazione **Next.js (App Router) in static export**, TypeScript. L'export
contiene solo il guscio: **i dati arrivano a runtime** da `/galileo/api/*.json`,
serviti dal blueprint Flask che li costruisce dalle tabelle Unity Catalog.

Questo significa che **caricare dati nuovi non richiede una build**: si aggiorna
la tabella e la dashboard segue entro il TTL della cache (10 minuti). Prima i
JSON erano importati a build time, e un caricamento non arrivava mai in
produzione finché qualcuno non rifaceva build e commit.

---

## 1. Avviare / buildare

Serve Node.js 18+ (consigliato 20).

```bash
npm install       # una tantum
npm run dev        # anteprima locale su http://localhost:3000
npm run build      # genera la cartella out/ = sito statico pubblicabile ovunque
```

`npm run build` produce `out/` con solo **HTML/CSS/JS statici**. Nessun processo
Node in produzione — ma serve un backend che risponda su `/galileo/api/*.json`
(il blueprint Flask), perché l'export non contiene più i dati.

In sviluppo locale `next dev` gira su :3000 mentre l'API sta sull'app Flask
(:8000). `output: "export"` esclude le rewrite come proxy, quindi si punta
l'API direttamente:

```bash
NEXT_PUBLIC_GALILEO_API_BASE=http://localhost:8000/galileo/api npm run dev
```

Config rilevante in `next.config.mjs`: `output: "export"`, `trailingSlash: true`,
`images.unoptimized: true` e `basePath: "/galileo"` — l'app è montata a subpath
nel portale GLI Nexus (blueprint Flask in `server.py`). Per una build servita
alla root di un host statico: `GALILEO_BASE_PATH="" npm run build` (il default di
`NEXT_PUBLIC_GALILEO_API_BASE` segue `basePath`, quindi diventa `/api`).

---

## 2. Come entrano i dati

Il percorso completo, dal file al grafico:

```
CSV nel Volume  →  tabelle Unity Catalog  →  Flask costruisce i payload  →  la UI li scarica
   (manuale)        data_pipeline/            data_service.py               src/data/api.ts
                    galileo_datauploading     cache TTL 10 min
```

I quattro payload derivati sono serviti da `/galileo/api/*.json` e **non esistono
più come file nel repo** (`.gitignore` li esclude apposta: una copia vecchia in
git verrebbe scambiata per la fonte). Restano importati staticamente solo i due
scritti a mano.

| Payload | Come arriva | Contenuto |
|---------|-------------|-----------|
| `content.json` (~289 KB) | `GET /galileo/api/content.json` | Payload principale: tabella Content (volumi per prodotto/area, YoY), pagina Coverage, config della pagina Database, drill Export Labs. |
| `db.json` (~1,1 MB) | `GET /galileo/api/db.json` | Record di spedizione (~12.000 righe) come tuple posizionali a 11 colonne. Scaricato solo entrando su `/database`. |
| `content_trends.json` (~16 KB) | `GET /galileo/api/content_trends.json` | Serie mensili per gli sparkline di Content V2. |
| `site_analysis.json` (~279 KB) | `GET /galileo/api/site_analysis.json` | Riepiloghi per impianto. Scaricato solo dalla rotta Content. |
| `content_comments.json` (~1 KB) | `import` da `src/data/` | Commenti KPI pubblicati. **Scritto a mano**, non deriva dai dati. |
| `story.json` (~2 KB) | `import` da `src/data/` | Testo del tour guidato. **Scritto a mano**. |

> Lo **schema autoritativo** di tutti questi payload è documentato e tipizzato in
> **`src/data/types.ts`**. È il riferimento da rispettare se li rigenerate.

### Come li legge il frontend

Fetch e memoizzazione stanno in `src/data/api.ts`. Ogni modulo dati espone due
funzioni: `loadX()` asincrona e `getX()` sincrona.

`src/data/GalileoData.tsx` è il **cancello**: attende i payload e solo dopo
renderizza i figli. Serve a far restare sincrono `getContent()` in decine di
componenti, invece di propagare `data | null` ovunque. Conseguenza voluta: sotto
static export il cancello è sempre "in caricamento" lato server, quindi l'HTML
prerenderizzato contiene lo scheletro e i numeri compaiono all'hydration.

Dove sta il cancello:
- `src/app/(app)/layout.tsx` — copre masthead, tab e tutte le rotte dell'app.
- `src/app/(app)/content/page.tsx` — aggiunge `needsSiteAnalysis` (i ~279 KB
  per impianto servono solo lì).
- `src/components/landing/LandingStats.tsx` — la landing resta un server
  component perché esporta `metadata`, quindi solo le due cifre dell'hero sono
  un figlio client con cancello proprio.

**Un componente che chiama `getContent()` fuori dal cancello lancia un'eccezione
esplicita**, invece di leggere `undefined` e produrre numeri sbagliati.

---

## 3. Contratto sorgente (cosa deve fornire la tabella Databricks)

La sorgente è `sbx-logistics.gli_nexus.galileo`, una riga per record di
spedizione. La pipeline si aspetta queste colonne (per **nome**, non per
posizione):

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

`Customer Country` è la colonna più facile da perdere e la più costosa: senza,
la regola Export Labs → EMEA sparisce e circa il 60% dei pezzi Export Labs resta
attribuito ad APAC. Se un caricamento la elimina dallo schema, la pipeline si
ferma con `KeyError: 'Customer Country'` invece di pubblicare numeri sbagliati.

---

## 4. Pipeline dati

`data_pipeline/` contiene la trasformazione, nell'ordine:

```
extract_databricks.py     → raw.json               (le 3 tabelle UC)
build_content.py          → content.json + db.json
build_content_trends.py   → content_trends.json    (da db.json)
build_site_analysis.py    → site_analysis.json     (da db.json)
```

Gli stessi script girano in due modi, e **l'implementazione è una sola**:

- **A runtime**, richiamati da `data_service.py` con `GALILEO_RAW_JSON` e
  `GALILEO_DATA_DIR` che li dirottano in una cartella temporanea. È così che la
  UI ottiene i dati.
- **Offline**, con `python data_pipeline/run.py`, che scrive in `src/data/` per
  ispezionare l'output senza passare dall'app. Quei file sono gitignorati.

Gli script devono restare **deterministici**: l'ETag dei payload è l'hash dei
byte, quindi un output che cambia a parità di dati farebbe riscaricare tutto a
ogni ricostruzione. Per questo `build_content.py` ordina le unioni di `set` prima
di serializzarle — senza, le chiavi di `drills` uscivano mescolate a ogni run.

In `reference-data-pipeline/` restano gli script originali Excel → JSON, **solo
come storia** della logica di trasformazione.

---

## 5. Struttura del progetto

```
.
├── src/
│   ├── app/           # route (landing, content, coverage, database, roadmap,
│   │                  #        content-v2 → redirect a content, styleguide)
│   ├── components/    # componenti UI
│   ├── data/          # api.ts (fetch), GalileoData.tsx (cancello), i loader .ts,
│   │                  #   types.ts (SCHEMA AUTORITATIVO), i 2 JSON scritti a mano
│   └── lib/           # helper (formattazione, metriche, tag)
├── public/            # asset statici
├── out/               # export statico, committato (Databricks Apps non builda)
├── server.py          # blueprint Flask: serve out/ + le rotte /api
├── data_service.py    # costruisce i payload dalle tabelle, cache TTL
├── data_pipeline/     # estrazione + trasformazione + notebook di ingestion
├── next.config.mjs    # static export
├── package.json
└── reference-data-pipeline/   # script Excel→JSON, solo storia
```

Note: i commenti KPI si pubblicano modificando `content_comments.json`
(quelli aggiunti dall'interfaccia restano in `localStorage` finché non vengono
copiati lì). Il testo del tour è in `story.json`. Entrambi sono importati a build
time, quindi cambiarli **richiede** una nuova build — a differenza dei dati.
