import os

# "excel" | "delta". Explicit env wins; otherwise auto-detect the Databricks
# Apps runtime (DATABRICKS_APP_PORT is injected by the platform).
DATA_SOURCE = os.environ.get(
    "KELLY_DATA_SOURCE",
    "delta" if os.environ.get("DATABRICKS_APP_PORT") else "excel",
)
