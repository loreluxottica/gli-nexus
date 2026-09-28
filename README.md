# GLI Nexus

Databricks App unica che espone il **portale GLI Nexus** come front-end e ospita
più sotto-progetti sotto un singolo server (un solo deploy).

Il portale (`portal/index.html`) è servito a `/`; ogni progetto è
montato a un subpath (es. Project Kelly a `/kelly/`).

---

## Struttura

```
gli-nexus/
├── app.py                 ← entry point unificato: portale a / + mount subapp
├── app.yaml               ← command Databricks (gunicorn app:application)
├── requirements.txt       ← server + dipendenze condivise e dei progetti
├── shared/requirements.txt← Flask/Werkzeug e Databricks, anche per Kelly standalone
├── portal/
│   ├── index.html           ← launcher, vista prodotto e schede dettaglio
│   ├── assets/             ← monoliti e immagini del portale
│   ├── css/                ← stile responsive delle tre viste
│   └── js/                 ← roster, accessi e controller UI
├── projects/
│   ├── kelly_dashboard/   ← Project Kelly — forecast assenteismo (Dash)
│   │   ├── app.py         ← app Dash (standalone o montata a subpath)
│   │   ├── requirements.txt
│   │   ├── pages/ components/ assets/ ...
│   ├── cortana_dashboard/ ← Cortana Usage Monitor (HTML + render server-side)
│   │   ├── server.py      ← blueprint Flask: /cortana/ (gated, project CORTANA)
│   │   └── cortana.html   ← placeholder __TOKEN__ (Chart.js, tema neon)
│   ├── galileo_dashboard/ ← Galileo Observatory (Next.js static export)
│   │   ├── server.py      ← blueprint Flask: /galileo/ (gated, project GALILEO)
│   │   ├── out/           ← build statico committato (servito così com'è)
│   │   ├── src/data/      ← loader API e contratti dati tipizzati
│   │   └── data_pipeline/ ← Databricks → JSON, a runtime o per ispezione offline
│   └── laplace_dashboard/ ← Laplace Pipeline Monitor (report HTML da volume UC)
│       ├── server.py      ← blueprint Flask: /laplace/ (gated, project LAPLACEPIPELINE)
│       └── data_pipeline/ ← publish_to_nexus.py: cella notebook di publish
└── reference/             ← materiale frontend di riferimento (gitignored)
```

---

## Prerequisiti

- **Python 3.11** (consigliato) o 3.10+
- **Node.js 20** per sviluppare Galileo ed eseguire i controlli; non serve nel
  runtime Databricks, che usa l'export committato.
- Connessione internet (dati meteo di Project Kelly: una chiamata Open-Meteo
  per plant al giorno, tenuta in memoria; festività da Nager per paese/anno).

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

Project Kelly resta eseguibile da solo, senza il portale:

```bash
cd projects/kelly_dashboard
pip install -r requirements.txt
python app.py
# → http://localhost:8050
```

In standalone Project Kelly usa il prefix di default `/` (comportamento
identico a prima della ristrutturazione).

### Verificare una modifica

Dopo il setup Python, installare il frontend dal lockfile:

```bash
npm --prefix projects/galileo_dashboard ci
npm --prefix projects/galileo_dashboard run typecheck
python -m unittest discover -s tests
node scripts/check-structure.mjs --module-root . --module-root projects --module-root projects/galileo_dashboard/src
```

Servono anche Git e Node per i controlli sugli asset e sugli helper TypeScript.
`make check` esegue gli stessi controlli; su Windows usare i comandi diretti.
Il typecheck rileva anche simboli e parametri inutilizzati. `npm run lint` è un
alias di questo controllo, non un linter Python.
I controlli restano locali; l'automazione GitHub Actions è rinviata.
Non rigenerano `out/` né eseguono deploy. Le regressioni usano
sorgenti simulate per cache, report e autorizzazioni; non sostituiscono una
verifica dei servizi reali in staging.

### Dati reali in locale

Project Kelly legge sempre le tabelle Unity Catalog. Per vederle da locale
servono un profilo CLI autenticato e l'ID del SQL warehouse:

```bash
export DATABRICKS_CONFIG_PROFILE=luxottica
export DATABRICKS_WAREHOUSE_ID=2663c9a13af5c078
python app.py
```

Senza queste variabili le pagine dei plant mostrano `⚠ DATA UNAVAILABLE`.

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
3. **Risorse app**:
   - SQL warehouse con resource key `sql-warehouse` (permesso *Can use*) —
     **obbligatorio**: senza, Project Kelly non ha dati;
   - secret con resource key `secret` → `kelly/mapbox_token` (token Mapbox).
   Le voci `valueFrom` in `app.yaml` fanno già riferimento a queste due chiavi.
4. **Dati reali**: concedi al service principal dell'app `USE CATALOG` su
   `sbx-logistics` e `USE SCHEMA` + `SELECT` sullo schema `kelly`. Le tabelle
   per-plant (`kelly_col_forecast`, `kelly_atl_forecast`, …) sono mappate in
   `projects/kelly_dashboard/warehouses.py`.

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `KELLY_UC_SCHEMA` | `sbx-logistics.kelly` | Catalog.schema delle tabelle per-plant (nomi tabella in `warehouses.py`) |
| `DATABRICKS_WAREHOUSE_ID` | — | ID SQL warehouse (via resource `valueFrom`) |
| `KELLY_SQL_HTTP_PATH` | — | Alternativa esplicita all'ID warehouse (http path completo) |
| `DATABRICKS_CONFIG_PROFILE` | — | Solo sviluppo locale: profilo CLI per auth OAuth/PAT |
| `MAPBOX_TOKEN`, `MAPBOX_STYLE` | `""` | Token pubblico Mapbox per il globo (vedi `.env.example`) |
| `KELLY_URL_PREFIX` | `/kelly/` | Prefix di mount di Project Kelly (impostato da `app.py`) |

Schema atteso delle tabelle: `ds` (timestamp), `ID` (area/turno), `Actual`,
`Forecast`, `Forecast_Vintage` (`ds` viene alias-ata a `Date` nella query).
Le tabelle UC sono l'**unica** sorgente dati: se il warehouse SQL non è
configurato o la query fallisce, la pagina del plant resta vuota e l'header
mostra `⚠ DATA UNAVAILABLE` (nessun crash, nessun dato inventato).

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

Chiavi progetto canoniche (colonna `project`): `KELLY`, `VOLUMESDATAENTRY`,
`CORTANA`, `GALILEO`, `LAPLACEPIPELINE`, `LAPLACEMULTIDOC`, `FLAGS`, `LMS`,
`DOPPLER`, `SYNCHRO`, `*`.

**Portale**: `/api/my-access` restituisce i grant dell'utente. Il launcher e le
schede prodotto restano consultabili, ma ogni destinazione parte chiusa finché
l'API non risponde. Le CTA senza grant mostrano "Access restricted"; Prism, che
non ha ancora una route, mostra "Coming soon". Laplace espone Pipeline Monitor,
Multidocument CT e Flags Download come destinazioni autorizzate separatamente.
Per le app esterne resta necessario anche il permesso Databricks *Can use*.
LMS, Doppler e Synchro puntano a un host interno (`10.200.112.48`, non
Databricks Apps): raggiungibili solo da chi è sulla rete/VPN aziendale: hanno
già `link`/`project`, ma nessuna demo (`preview` assente in
`detail-data.js`) — la scheda dettaglio mostra solo la storyline.
I deep link supportati sono `?w=<id>`, `?w=<id>&d=1&s=<step>` e `?all=1`.
Le schede Galileo, Kelly, Cortana e Intake incorporano gli intake ricevuti in
`Project Details/` e gli screenshot canonici in `portal/assets/details/`
(checklist di approvazione ancora
aperte dove non firmate). Laplace e Prism restano contenuti dimostrativi:
tutte le schede devono essere approvate dai product owner prima del rilascio.
`Project Details/` conserva gli intake originali e le catture distinte; le copie
identiche agli screenshot pubblicati sono state rimosse. Loghi e font hanno
una sola copia nel portale; i vecchi URL `/GLI-Branding/...` restano disponibili
come alias, senza duplicare i file.

**Cortana Usage Monitor** (`/cortana/`): legge
`sbx-logistics.gli_nexus.cortana_usage` (env `CORTANA_USAGE_TABLE`), cache
5 min (`CORTANA_CACHE_TTL_S`). Pagina gated dal progetto `CORTANA` nella
tabella accessi (403 con box "Access restricted" altrimenti).

**Galileo Observatory** (`/galileo/`): dashboard Next.js esportata come sito
statico. Il blueprint (`projects/galileo_dashboard/server.py`) serve la cartella
`out/` committata — Databricks Apps non esegue build Node — gated dal progetto
`GALILEO`, inclusi gli asset statici. **I dati arrivano a runtime** dalle API
`/galileo/api/*.json`: `data_service.py` legge Unity Catalog tramite la pipeline
esistente e conserva i payload in memoria (`GALILEO_CACHE_TTL`, default 600 s).
Il caricamento di nuovi dati nelle tabelle non richiede build o commit.

I JSON derivati sono gitignorati: non reinserirli nel repository. La pipeline
offline resta disponibile per ispezioni autorizzate; vincoli e contratti sono in
`projects/galileo_dashboard/CONSTRAINTS.md` e `DATA_PIPELINE_READTHROUGH.md`.

Solo per una modifica frontend esplicitamente autorizzata alla pubblicazione:

```bash
cd projects/galileo_dashboard
npm ci
npm run build                    # rigenera out/ (basePath /galileo)
# committa sorgenti e out/, non i payload derivati
```

Il server dell'export è Flask (`python app.py` dalla root), non `next start`.
Il connettore SQL Databricks è una dipendenza di runtime condivisa.

**Laplace Pipeline Monitor** (`/laplace/`): report doganale (pipeline
LAPLACE → THAI → REGIONS → PENDING → GARAGE) generato dal notebook Databricks
"Laplace Pipeline Monitor". Il server cerca il file HTML più recente con
prefisso `LAPLACE_HTML_PREFIX` (default `laplace_pipeline_tutorial_`) nel volume
`LAPLACE_HTML_DIR` (default `/Volumes/sbx-logistics/gli_nexus/nexus_volume`).
Legge tramite Databricks Files API, con cache 5 min (`LAPLACE_CACHE_TTL_S`);
un nuovo report nel volume diventa disponibile senza redeploy.
La pagina richiede il grant `LAPLACEPIPELINE`; `/laplace/flags-download`
richiede separatamente `FLAGS` e scarica il file indicato da `RUBY_XLSX_PATH`.

**Publisher da confermare:** `data_pipeline/publish_to_nexus.py` è una copia
storica che scrive ancora nella tabella `laplace_report`, non il percorso letto
dal server. Non usarla come procedura di pubblicazione corrente e non modificarla
senza conferma del notebook owner.

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

Poi aggiungi il prodotto a `NEXUS_WORLDS` in `portal/js/worlds-data.js`, con
`link` e `project` (chiave della tabella accessi); aggiungi la scheda opzionale a
`NEXUS_DETAILS` in `portal/js/detail-data.js` e inserisci i grant in `user_access`.

---

## Note

- **Asset dei progetti Dash** (CSS/JS/font) sono serviti con il prefix corretto
  automaticamente (`requests_pathname_prefix`).
- **Navigazione Kelly**: i link interni usano `dash.get_relative_path` e
  funzionano sia sotto `/kelly/` sia in standalone.
- `reference/` contiene build frontend di riferimento con token Mapbox
  hardcoded: è gitignored e non fa parte del deploy.
