# Databricks notebook source
# DBTITLE 1,Overview
# MAGIC %md
# MAGIC ## Galileo Data Upload Pipeline
# MAGIC
# MAGIC Reads the files in `/Volumes/sbx-logistics/gli_nexus/galileo_volume/` and routes
# MAGIC each one to its table by file name:
# MAGIC
# MAGIC | File name pattern | Target table | Mode |
# MAGIC | --- | --- | --- |
# MAGIC | `SQL Source <Month>` | `sbx-logistics.gli_nexus.galileo` | Overwrite (only the newest file — it already contains every earlier month) |
# MAGIC | `Coverage Galileo` | `sbx-logistics.gli_nexus.coverage_galileo` | Overwrite |
# MAGIC | `Mapping Galileo` | `sbx-logistics.gli_nexus.mapping_galileo` | Overwrite |
# MAGIC
# MAGIC **Usage**: drop the CSV file(s) into the Volume, then run the notebook.
# MAGIC
# MAGIC Once this finishes the dashboard follows on its own — the Flask app reads these
# MAGIC tables at runtime and refreshes within its cache TTL. No rebuild, no commit.
# MAGIC
# MAGIC ### Three things that are easy to get wrong here
# MAGIC
# MAGIC 1. **Encoding is detected, not assumed.** These exports are not consistent: the
# MAGIC    July 31 `SQL Source June.csv` was latin-1 with no BOM, the one uploaded hours
# MAGIC    later the same day was UTF-8 *with* a BOM. Hard-coding either one corrupts
# MAGIC    accented plant names on the other, and those names are join keys in
# MAGIC    `site_analysis.json` and the Export Labs drill.
# MAGIC 2. **`INSERT OVERWRITE`, not `saveAsTable`.** Every column name here contains
# MAGIC    spaces (`Site Type`, `Geographical Area`), which only works because the tables
# MAGIC    carry `delta.columnMapping.mode = name`. Writing with `saveAsTable` +
# MAGIC    `overwriteSchema` risks recreating them without it, which fails with
# MAGIC    `DELTA_INVALID_CHARACTERS_IN_COLUMN_NAMES`.
# MAGIC 3. **Newest file = newest modification time, not the month in its name.** Ranking
# MAGIC    by month name has no year: in January 2027 `SQL Source January` would rank
# MAGIC    below `SQL Source December` and you would silently reload last year's export.

# COMMAND ----------

# DBTITLE 1,Configuration
import codecs

from pyspark.sql import functions as F

VOLUME_PATH = "/Volumes/sbx-logistics/gli_nexus/galileo_volume"

TABLE_GALILEO  = "`sbx-logistics`.gli_nexus.galileo"
TABLE_COVERAGE = "`sbx-logistics`.gli_nexus.coverage_galileo"
TABLE_MAPPING  = "`sbx-logistics`.gli_nexus.mapping_galileo"

# Flip to True to validate a file without writing anything.
DRY_RUN = False

# A month counts as loaded when it reaches this share of the year's busiest month.
# Same rule build_content.py uses to decide the YTD window, so what is reported
# here is what the dashboard will actually show.
MATERIAL_SHARE = 0.1

# COMMAND ----------

# DBTITLE 1,Helpers


def detect_encoding(path):
    """"UTF-8" if the file decodes as UTF-8, else "ISO-8859-1".

    Reads the whole file — these are under a megabyte, and sniffing only a prefix
    can split a multi-byte character at the cut and mis-detect.
    """
    with open(path, "rb") as fh:
        data = fh.read()
    if data.startswith(codecs.BOM_UTF8):
        return "UTF-8"
    try:
        data.decode("utf-8")
        return "UTF-8"
    except UnicodeDecodeError:
        return "ISO-8859-1"


def read_csv(path):
    """Read one source CSV. Everything stays a string; casting is explicit later."""
    encoding = detect_encoding(path)
    print(f"    encoding: {encoding}")
    df = (
        spark.read.format("csv")
        .option("header", True)
        .option("sep", ";")
        .option("inferSchema", False)
        .option("encoding", encoding)
        .load(path)
    )
    # A UTF-8 BOM lands inside the first header, giving a column literally named
    # "﻿Site" that then fails to match the table's "Site".
    return df.toDF(*[c.lstrip("﻿").strip() for c in df.columns])


def overwrite_table(df, table):
    """Replace the table's rows, keeping its schema and properties.

    Position-based (`insertInto`), so the columns are selected in the target's own
    order first. Any column the source lacks is a hard error — silently inserting
    a misaligned frame would corrupt the table without failing.
    """
    target_cols = spark.table(table).columns
    missing = [c for c in target_cols if c not in df.columns]
    if missing:
        raise ValueError(f"{table}: source is missing column(s) {missing}")

    extra = [c for c in df.columns if c not in target_cols]
    if extra:
        print(f"    dropping source-only column(s): {extra}")

    aligned = df.select([F.col(f"`{c}`") for c in target_cols])
    aligned.write.mode("overwrite").insertInto(table)


def material_months(df, date_col="Month/Year", value_col="Pieces"):
    """{year: [months reaching MATERIAL_SHARE of that year's peak]}."""
    agg = (
        df.groupBy(F.year(F.col(f"`{date_col}`")).alias("y"),
                   F.month(F.col(f"`{date_col}`")).alias("mo"))
          .agg(F.sum(F.col(f"`{value_col}`")).alias("pieces"))
    )
    peak = agg.groupBy("y").agg(F.max("pieces").alias("top"))
    kept = (
        agg.join(peak, "y")
           .filter((F.col("pieces") >= MATERIAL_SHARE * F.col("top")) & (F.col("pieces") > 0))
           .orderBy("y", "mo")
           .collect()
    )
    out = {}
    for r in kept:
        out.setdefault(r["y"], []).append(r["mo"])
    return out


# COMMAND ----------

# DBTITLE 1,Find the files
files = [f for f in dbutils.fs.ls(VOLUME_PATH) if not f.name.endswith("/")]
print(f"Files found in volume: {[f.name for f in files]}")

sql_source_files = [f for f in files if f.name.startswith("SQL Source")]

latest_sql_file = None
if sql_source_files:
    latest_sql_file = max(sql_source_files, key=lambda f: f.modificationTime)
    skipped = [f.name for f in sql_source_files if f.name != latest_sql_file.name]
    if skipped:
        print(f"Skipping older SQL Source files (the newest already contains all months): {skipped}")
    print(f"\nUsing: {latest_sql_file.name}")

# COMMAND ----------

# DBTITLE 1,SQL Source -> galileo
if latest_sql_file is None:
    print("No 'SQL Source*' file in the volume — skipping the galileo table.")
else:
    src = read_csv(f"{VOLUME_PATH}/{latest_sql_file.name}")

    galileo_df = (
        src.withColumn("Month/Year", F.to_date(F.col("`Month/Year`"), "d/M/yyyy"))
           .withColumn("Pieces", F.col("Pieces").cast("double").cast("bigint"))
           .withColumn("Shipments", F.col("Shipments").cast("double").cast("bigint"))
    )

    total = galileo_df.count()
    undated = galileo_df.filter(F.col("`Month/Year`").isNull()).count()
    galileo_df = galileo_df.filter(F.col("`Month/Year`").isNotNull())

    print(f"rows: {total:,}   unparseable dates dropped: {undated:,}")
    if total == 0:
        raise ValueError(f"{latest_sql_file.name} produced no rows")
    if undated:
        # A format drift (mm/dd, ISO) shows up exactly like this and would silently
        # delete whole months from the dashboard.
        raise ValueError(
            f"{undated:,} rows have an unparseable `Month/Year` — check the source "
            f"still uses d/M/yyyy"
        )

    incoming = material_months(galileo_df)
    current = material_months(spark.table(TABLE_GALILEO))
    year = max(incoming)
    print(f"\nincoming {year}: months {incoming.get(year, [])}")
    print(f"current  {year}: months {current.get(year, [])}")

    inc, cur = incoming.get(year, []), current.get(year, [])
    if inc and cur and max(inc) < max(cur):
        raise ValueError(
            f"the incoming file only reaches month {max(inc)} but the table already has "
            f"{max(cur)}. This would roll the dashboard backwards. If that is really "
            f"what you want, load it manually."
        )

    if DRY_RUN:
        print(f"\nDRY RUN — would overwrite {TABLE_GALILEO} with {galileo_df.count():,} rows")
    else:
        overwrite_table(galileo_df, TABLE_GALILEO)
        print(f"\nOverwrote {TABLE_GALILEO} with {spark.table(TABLE_GALILEO).count():,} rows")

# COMMAND ----------

# DBTITLE 1,Coverage / Mapping -> their tables
for name, table in (("Coverage Galileo", TABLE_COVERAGE), ("Mapping Galileo", TABLE_MAPPING)):
    match = [f for f in files if f.name.startswith(name)]
    if not match:
        print(f"No '{name}*' file in the volume — leaving {table} untouched.")
        continue

    chosen = max(match, key=lambda f: f.modificationTime)
    print(f"\n>>> {chosen.name} -> {table}")
    df = read_csv(f"{VOLUME_PATH}/{chosen.name}")
    n = df.count()
    if n == 0:
        raise ValueError(f"{chosen.name} produced no rows")

    print(f"    {n:,} rows")
    if DRY_RUN:
        print("    DRY RUN — not written")
    else:
        overwrite_table(df, table)
        print(f"    Overwrote with {spark.table(table).count():,} rows")

# COMMAND ----------

# DBTITLE 1,Result
display(spark.sql(f"""
    SELECT date_format(`Month/Year`, 'yyyy-MM') AS ym,
           count(*) AS rows_n,
           sum(`Pieces`) AS pieces
    FROM {TABLE_GALILEO}
    WHERE `Month/Year` >= add_months(current_date(), -8)
    GROUP BY 1 ORDER BY 1
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC The dashboard picks this up by itself. `projects/galileo_dashboard/data_service.py`
# MAGIC queries these tables and rebuilds its payloads when its cache expires
# MAGIC (`GALILEO_CACHE_TTL`, 10 minutes by default), so the site shows the new month
# MAGIC without a build or a commit.
