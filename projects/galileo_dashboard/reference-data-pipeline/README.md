# Pipeline dati — solo riferimento

Questi script mostrano come, **oggi**, i JSON consumati dal frontend vengono
derivati dall'Excel `Galileo Frontend.xlsx`. Sono qui come **specifica della
trasformazione**, non per essere eseguiti dentro questo pacchetto (i percorsi
puntano al repository originale).

Obiettivo su Databricks: replicare queste stesse trasformazioni leggendo dalla
tabella invece che dall'Excel, producendo JSON con le stesse forme (schema in
`../src/data/types.ts`).

| Script | Output | Note |
|--------|--------|------|
| `extract.py` | `raw.json` | Dump grezzo dei fogli Excel. Su Databricks non serve: si parte dalla tabella. |
| `build_content.py` | `content.json`, `db.json` | Cuore della pipeline: aggrega i record in tabella Content, Coverage, config Database. Definisce anche la geo "effettiva" (Export Labs + Customer Country EMEA → EMEA) e il mapping Product·Site Type → riga Content. |
| `build_content_trends.py` | `content_trends.json` | Serie mensili per gli sparkline, da `db.json`. |
| `build_site_analysis.py` | `site_analysis.json` | Riepiloghi per impianto, da `db.json`. |

Le colonne sorgente attese sono elencate in `../HANDOFF.md` (sezione 3).
