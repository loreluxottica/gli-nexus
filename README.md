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
│   └── kelly_dashboard/   ← Project Kelly — forecast assenteismo (Dash)
│       ├── app.py         ← app Dash (standalone o montata a subpath)
│       ├── requirements.txt
│       ├── pages/ components/ assets/ ...
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
   folder. Per i redeploy: pull della Git folder + Deploy.
3. **Risorse app** (opzionali finché si usa il mock):
   - SQL warehouse con resource key `sql-warehouse` (permesso *Can use*);
   - secret con resource key `mapbox-token` (token Mapbox).
   Poi decommenta le voci `valueFrom` corrispondenti in `app.yaml`.
4. **Dati reali**: quando la tabella esiste, concedi al service principal
   dell'app `USE CATALOG` / `USE SCHEMA` / `SELECT`, imposta `KELLY_TABLE` in
   `app.yaml`, commit + redeploy.

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `KELLY_DATA_SOURCE` | `excel` in locale, `delta` su Databricks (auto) | Sorgente dati: `excel` (xlsx locale, fallback mock) o `delta` (tabella UC) |
| `KELLY_TABLE` | — | Tabella Unity Catalog `catalog.schema.table`. Vuota ⇒ mock |
| `KELLY_WAREHOUSE_COLUMN` | `Warehouse` | Colonna che filtra il plant (`columbus`, `atlanta`, …) |
| `DATABRICKS_WAREHOUSE_ID` | — | ID SQL warehouse (via resource `valueFrom`) |
| `KELLY_SQL_HTTP_PATH` | — | Alternativa esplicita all'ID warehouse (http path completo) |
| `MAPBOX_TOKEN`, `MAPBOX_STYLE` | `""` | Token pubblico Mapbox per il globo (vedi `.env.example`) |
| `KELLY_URL_PREFIX` | `/kelly/` | Prefix di mount di Project Kelly (impostato da `app.py`) |
| `WEATHER_CACHE_DIR` | `projects/kelly_dashboard/weather_data` | Dir cache meteo; se non scrivibile si usa la temp dir |

Schema atteso della tabella dati: `Date`, `ID` (area/turno), `Actual`,
`Forecast`, `Forecast_Vintage`, più la colonna plant (`KELLY_WAREHOUSE_COLUMN`).
Se `KELLY_TABLE` è vuota o la query fallisce, l'app degrada a dati mock
generati (nessun crash).

---

## Aggiungere un nuovo progetto

1. Crea `projects/<nome>/` con la sua app che espone un WSGI `server`.
2. Rendi il progetto prefix-aware via env var (come `KELLY_URL_PREFIX`).
3. In `app.py`: imposta l'env var, importa il `server`, aggiungilo a `MOUNTS`.
4. (Opzionale) aggiungi/aggiorna la card nel portale (`DATA[]` in
   `portal/gli_nexus_portal.html`).

---

## Note

- **Asset dei progetti Dash** (CSS/JS/font) sono serviti con il prefix corretto
  automaticamente (`requests_pathname_prefix`).
- **Navigazione deep-link interna** dei progetti (es. link `/forecast/...` in
  Project Kelly) usa ancora path assoluti: sotto mount va cablata in una fase
  successiva. La landing e gli asset funzionano; i link interni sono il prossimo
  passo di wiring.
- Le card del portale non navigano ancora ai progetti (nessun `url`): wiring
  click → subpath previsto in un intervento successivo.
- `reference/` contiene build frontend di riferimento con token Mapbox
  hardcoded: è gitignored e non fa parte del deploy.
```