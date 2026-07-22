# GLI Nexus

Databricks App unica che espone il **portale GLI Nexus** come front-end e ospita
più sotto-progetti sotto un singolo server (un solo deploy).

Il portale (`portal/gli_nexus_portal.html`) è servito a `/`; ogni progetto è
montato a un subpath (es. Project Kelly a `/kelly/`).

---

## Struttura

```
gli-nexus/
├── app.py                 ← entry point unificato: portale a / + mount subapp
├── app.yaml               ← command Databricks (gunicorn app:application)
├── requirements.txt       ← deps root + include quelle dei progetti
├── portal/
│   └── gli_nexus_portal.html   ← front-end (coverflow launcher)
├── projects/
│   ├── kelly_dashboard/   ← Project Kelly — forecast assenteismo (Dash)
│   │   ├── app.py         ← app Dash (standalone o montata a subpath)
│   │   ├── requirements.txt
│   │   ├── pages/ components/ assets/ ...
│   ├── cortana_dashboard/ ← Cortana Usage Monitor (HTML + render server-side)
│   │   ├── server.py      ← blueprint Flask: /cortana/ (gated, project CORTANA)
│   │   └── cortana.html   ← template str.format (Chart.js, tema neon)
│   ├── galileo_dashboard/ ← Galileo Observatory (Next.js static export)
│   │   ├── server.py      ← blueprint Flask: /galileo/ (gated, project GALILEO)
│   │   ├── out/           ← build statico committato (servito così com'è)
│   │   ├── src/data/*.json← dati "baked" a build-time (rigenerati dal pipeline)
│   │   └── data_pipeline/ ← offline: Databricks → JSON (dev, non a runtime)
│   └── laplace_dashboard/ ← Laplace Pipeline Monitor (report HTML da tabella UC)
│       ├── server.py      ← blueprint Flask: /laplace/ (gated, project LAPLACE)
│       └── data_pipeline/ ← publish_to_nexus.py: cella notebook di publish
└── reference/             ← materiale frontend di riferimento (gitignored)
```

---

## Prerequisiti

- **Python 3.11** (consigliato) o 3.10+
- Connessione internet al primo avvio (dati meteo di Project Kelly)

---

## Avvio locale — app unificata

Dalla root `gli-nexus/`:

```bash
pip install -r requirements.txt

# server production-style
gunicorn app:application -b 0.0.0.0:8000

# oppure dev server rapido
python app.py
```

Poi apri:
- **http://localhost:8000/** → portale GLI Nexus
- **http://localhost:8000/kelly/** → Project Kelly

> Consiglio: usa un virtualenv.
> ```bash
> python -m venv .venv
> .venv\Scripts\activate      # Windows
> source .venv/bin/activate   # Mac/Linux
> pip install -r requirements.txt
> ```

---

## Avvio locale — un solo progetto (standalone)

Ogni progetto resta eseguibile da solo, senza il portale:

```bash
cd projects/kelly_dashboard
pip install -r requirements.txt
python app.py
# → http://localhost:8050
```

In standalone Project Kelly usa il prefix di default `/` (comportamento
identico a prima della ristrutturazione).

---

## Deploy Databricks Apps

Il file `app.yaml` definisce il comando di avvio (gunicorn sul WSGI
`app:application`, porta 8000). Databricks Apps avvia il processo e instrada il
traffico verso di esso.

### Passi per collegare l'app

1. **GitHub → Databricks**: in *User Settings → Linked accounts* collega
   GitHub, poi crea una *Git folder* nel workspace puntando a questo repo
   (branch `main`).
2. **Crea l'app**: *Compute → Apps → Create app* (custom), source = la Git
   folder. Per i redeploy dopo un push: UI (pull Git folder + Deploy) oppure
   CLI `databricks apps deploy gli-nexus --profile luxottica` (risolve
   l'ultimo commit di `main`).
3. **Risorse app** (opzionali finché si usa il mock):
   - SQL warehouse con resource key `sql-warehouse` (permesso *Can use*);
   - secret con resource key `secret` → `kelly/mapbox_token` (token Mapbox).
   Poi decommenta le voci `valueFrom` corrispondenti in `app.yaml`.
4. **Dati reali**: concedi al service principal dell'app `USE CATALOG` su
   `sbx-logistics` e `USE SCHEMA` + `SELECT` sullo schema `kelly`. Le tabelle
   per-plant (`kelly_col_forecast`, `kelly_atl_forecast`, …) sono mappate in
   `projects/kelly_dashboard/warehouses.py`.

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `KELLY_DATA_SOURCE` | `excel` in locale, `delta` su Databricks (auto) | Sorgente dati: `excel` (xlsx locale, fallback mock) o `delta` (tabelle UC) |
| `KELLY_UC_SCHEMA` | `sbx-logistics.kelly` | Catalog.schema delle tabelle per-plant (nomi tabella in `warehouses.py`) |
| `DATABRICKS_WAREHOUSE_ID` | — | ID SQL warehouse (via resource `valueFrom`) |
| `KELLY_SQL_HTTP_PATH` | — | Alternativa esplicita all'ID warehouse (http path completo) |
| `DATABRICKS_CONFIG_PROFILE` | — | Solo sviluppo locale: profilo CLI per auth OAuth/PAT |
| `MAPBOX_TOKEN`, `MAPBOX_STYLE` | `""` | Token pubblico Mapbox per il globo (vedi `.env.example`) |
| `KELLY_URL_PREFIX` | `/kelly/` | Prefix di mount di Project Kelly (impostato da `app.py`) |
| `WEATHER_CACHE_DIR` | `projects/kelly_dashboard/weather_data` | Dir cache meteo; se non scrivibile si usa la temp dir |

Schema atteso delle tabelle: `ds` (timestamp), `ID` (area/turno), `Actual`,
`Forecast`, `Forecast_Vintage` (`ds` viene alias-ata a `Date` nella query).
Se il warehouse SQL non è configurato o la query fallisce, l'app degrada a
dati mock generati (nessun crash).

### Autorizzazioni utente (user scopes)

Tabella centrale per tutti i progetti GLI Nexus:
`sbx-logistics.gli_nexus.user_access (user_email, project, scope)` — una riga
per grant, più righe per utente. `project` = `kelly`, `vde`, … o `*`;
`scope` = `*` oppure valore specifico del progetto (per Kelly: `COLUMBUS`,
`ATLANTA`, `DALLAS`, `SEDICO`, `TIJUANA`). Utente senza righe ⇒ **negato**
(modal "Access restricted" al click sul plant). Identità dall'header
`X-Forwarded-Email` iniettato dal proxy Databricks Apps.

```sql
-- dare a un utente il plant Atlanta su Kelly
INSERT INTO `sbx-logistics`.gli_nexus.user_access VALUES
  ('user1@luxottica.com', 'kelly', 'ATLANTA');
-- admin di Kelly (tutti i plant)
INSERT INTO `sbx-logistics`.gli_nexus.user_access VALUES
  ('user2@luxottica.com', 'kelly', '*');
-- revoca
DELETE FROM `sbx-logistics`.gli_nexus.user_access
  WHERE user_email = 'user1@luxottica.com' AND project = 'kelly';
```

Le modifiche si propagano senza redeploy (cache TTL ~3 min, env
`KELLY_AUTH_TTL_S`). Env: `GLI_ACCESS_TABLE` (default
`sbx-logistics.gli_nexus.user_access`), `KELLY_PROJECT_KEY` (default `KELLY`),
`KELLY_DEV_USER_EMAIL` (solo sviluppo locale, ignorata quando deployata).

Chiavi progetto canoniche (colonna `project`): `KELLY`,
`VOLUMESDATAENTRY`, `CORTANA`, `GALILEO`, `LAPLACE`, `*`.

**Card del portale**: l'endpoint `/api/my-access` restituisce i progetti
dell'utente; le card senza grant mostrano "Access restricted" (bottone
disabilitato). ⚠ È solo UX: per le app esterne (es. Volume Data Entry)
l'enforcement reale è il permesso *Can use* sull'app Databricks di
destinazione — rimuoverlo agli utenti non autorizzati.

**Cortana Usage Monitor** (`/cortana/`): legge
`sbx-logistics.gli_nexus.cortana_usage` (env `CORTANA_USAGE_TABLE`), cache
5 min (`CORTANA_CACHE_TTL_S`). Pagina gated dal progetto `CORTANA` nella
tabella accessi (403 con box "Access restricted" altrimenti).

**Galileo Observatory** (`/galileo/`): dashboard Next.js esportata come sito
statico. Il blueprint (`projects/galileo_dashboard/server.py`) serve la cartella
`out/` committata — Databricks Apps non esegue build Node — gated dal progetto
`GALILEO`. **Nessuna query a runtime**: i dati sono "baked" in `src/data/*.json`
a build-time. Per aggiornarli (offline, con Node ≥18 e un profilo Databricks):

```bash
cd projects/galileo_dashboard
DATABRICKS_CONFIG_PROFILE=luxottica DATABRICKS_WAREHOUSE_ID=<wh> \
  python data_pipeline/run.py     # legge galileo / coverage_galileo / mapping_galileo → JSON
npm install && npm run build      # rigenera out/ (basePath /galileo)
# committa src/data/*.json + out/
```

Dettagli e assunzioni (finestra YTD, coverage %) in
`projects/galileo_dashboard/data_pipeline/README.md`. Il pipeline usa
`databricks-sql-connector` **solo offline**: non è nelle deps di runtime.

**Laplace Pipeline Monitor** (`/laplace/`): report doganale (pipeline
LAPLACE → THAI → REGIONS → PENDING → GARAGE) generato dal notebook Databricks
"Laplace Pipeline Monitor". Il notebook, nell'ultima cella (vedi
`projects/laplace_dashboard/data_pipeline/publish_to_nexus.py`), appende l'HTML
completo a `sbx-logistics.gli_nexus.laplace_report` (env
`LAPLACE_REPORT_TABLE`); il blueprint serve l'ultima riga con cache 5 min
(`LAPLACE_CACHE_TTL_S`). Ogni run del notebook (manuale o job schedulato)
aggiorna la dashboard **senza redeploy**. Pagina gated dal progetto `LAPLACE`.

---

## Aggiungere un nuovo progetto

Due pattern possibili:

- **Sub-app WSGI completa** (es. Kelly, Dash): esponi un WSGI `server`,
  rendi il progetto prefix-aware via env var (come `KELLY_URL_PREFIX`) e in
  `app.py` aggiungilo a `MOUNTS`.
- **Blueprint Flask** (es. Cortana, Galileo — pagine server-rendered o siti
  statici): esponi un `bp` in `projects/<nome>/server.py`, gate con
  `shared.auth` (`auth.authorized("<CHIAVE>")`) e in `app.py` fai
  `root.register_blueprint(bp, url_prefix="/<nome>")`.

Poi aggiungi la card nel portale (`DATA[]` in `portal/gli_nexus_portal.html`)
con `link` e `project` (chiave della tabella accessi) e inserisci i grant in
`user_access`.

---

## Note

- **Asset dei progetti Dash** (CSS/JS/font) sono serviti con il prefix corretto
  automaticamente (`requests_pathname_prefix`).
- **Navigazione deep-link interna** dei progetti (es. link `/forecast/...` in
  Project Kelly) usa ancora path assoluti: sotto mount va cablata in una fase
  successiva. La landing e gli asset funzionano; i link interni sono il prossimo
  passo di wiring.
- `reference/` contiene build frontend di riferimento con token Mapbox
  hardcoded: è gitignored e non fa parte del deploy.