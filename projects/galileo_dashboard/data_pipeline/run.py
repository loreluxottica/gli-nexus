"""Regenerate the Galileo Next-app data from Databricks.

Runs the full pipeline in order:
    extract_databricks  ->  data_pipeline/data/raw.json
    build_content       ->  src/data/content.json + db.json
    build_content_trends->  src/data/content_trends.json
    build_site_analysis ->  src/data/site_analysis.json

After this, rebuild the static site (`npm run build`) and commit src/data/* + out/.

Usage (local, with a Databricks CLI profile):
    DATABRICKS_CONFIG_PROFILE=luxottica \
    DATABRICKS_WAREHOUSE_ID=2663c9a13af5c078 \
    python data_pipeline/run.py
"""
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _run(name: str) -> None:
    print(f"\n=== {name} ===")
    runpy.run_path(str(HERE / name), run_name="__main__")


def main() -> None:
    _run("extract_databricks.py")
    _run("build_content.py")
    _run("build_content_trends.py")
    _run("build_site_analysis.py")
    print("\nDone. Next: `npm run build`, then commit src/data/* and out/.")


if __name__ == "__main__":
    sys.exit(main())
