# CELL 7 - PUBLISH HTML TO GLI NEXUS (/laplace)
#
# Reference copy of the last cell of the "Laplace Cockpit numbers" notebook
# (already appended to v13). It appends the full report page (report_html_tut,
# assembled by CELL 3) to the table the Nexus /laplace blueprint reads; the
# blueprint serves the latest row with a 5-min cache, so every notebook run
# (manual or scheduled job) refreshes the dashboard - no commit, no redeploy.
#
# This file is not imported by the app.

from pyspark.sql import Row as _Row, types as _T

NEXUS_REPORT_TABLE = "`sbx-logistics`.`gli_nexus`.laplace_report"

_report_schema = _T.StructType([
    _T.StructField("generated_at", _T.TimestampType()),
    _T.StructField("html", _T.StringType()),
])

spark.createDataFrame(  # noqa: F821 - `spark` exists in the notebook runtime
    [_Row(generated_at=datetime.now(), html=report_html_tut)],  # noqa: F821
    _report_schema,
).write.mode("append").saveAsTable(NEXUS_REPORT_TABLE)

# keep only the last 30 runs
spark.sql(f"""
    DELETE FROM {NEXUS_REPORT_TABLE} WHERE generated_at < (
        SELECT MIN(generated_at) FROM (
            SELECT generated_at FROM {NEXUS_REPORT_TABLE}
            ORDER BY generated_at DESC LIMIT 30))
""")  # noqa: F821

print(f"GLI Nexus aggiornato: {NEXUS_REPORT_TABLE} - {len(report_html_tut):,} chars")  # noqa: F821
