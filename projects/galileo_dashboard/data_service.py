"""Galileo payloads, built from Databricks at request time.

The dashboard used to bake its four JSON files into the static export at build
time, which meant new data in Unity Catalog could not reach the site without
someone re-running the pipeline, rebuilding and committing. This module removes
that: the tables are the source, and the payloads are rebuilt here on demand and
cached in-process.

The transformation is *not* reimplemented. `data_pipeline/` holds the scripts
that have always produced these payloads, and they still run byte-for-byte the
same way — they just write into a scratch directory instead of `src/data/`,
via the `GALILEO_RAW_JSON` / `GALILEO_DATA_DIR` overrides. `run.py` keeps working
unchanged for offline use, so there is one aggregation implementation, not two.

Payloads are held as encoded JSON bytes rather than Python objects: they are
served verbatim and never inspected, so re-serialising ~1.4 MB per request would
be pure waste.

Cache: `GALILEO_CACHE_TTL` seconds (default 600). gunicorn runs one worker with
eight threads (see app.yaml), so a module-level cache is shared by every request
and a lock is enough to keep concurrent misses from each launching their own
extraction.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import logging
import os
import runpy
import tempfile
import threading
import time
from pathlib import Path

_log = logging.getLogger(__name__)

_DIR = Path(__file__).resolve().parent
_PIPELINE = _DIR / "data_pipeline"

# Public payload name -> the file the pipeline writes it to.
FILES = {
    "content": "content.json",
    "db": "db.json",
    "content_trends": "content_trends.json",
    "site_analysis": "site_analysis.json",
}

_DEFAULT_TTL = 600

_lock = threading.Lock()
_cache: dict = {"payloads": None, "etags": None, "built_at": 0.0}


def cache_ttl() -> int:
    try:
        return int(os.environ.get("GALILEO_CACHE_TTL", _DEFAULT_TTL))
    except ValueError:
        return _DEFAULT_TTL


def _extract() -> dict:
    """Read the three Unity Catalog tables via data_pipeline/extract_databricks.py.

    Loaded by path rather than imported: data_pipeline/ is a plain directory of
    scripts, not a package, and adding an __init__.py would change how run.py
    resolves them.
    """
    path = _PIPELINE / "extract_databricks.py"
    spec = importlib.util.spec_from_file_location("galileo_extract", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.extract()


def _build() -> tuple[dict[str, bytes], dict[str, str]]:
    """Run the full pipeline into a scratch directory; return payload bytes + ETags."""
    started = time.monotonic()
    raw = _extract()

    with tempfile.TemporaryDirectory(prefix="galileo-") as tmp:
        tmpdir = Path(tmp)
        raw_path = tmpdir / "raw.json"
        raw_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")

        # The build scripts read these at import time, so they must be set before
        # each run_path call. Restored afterwards: this process also serves other
        # projects, and run.py relies on the unset defaults.
        previous = {k: os.environ.get(k) for k in ("GALILEO_RAW_JSON", "GALILEO_DATA_DIR")}
        os.environ["GALILEO_RAW_JSON"] = str(raw_path)
        os.environ["GALILEO_DATA_DIR"] = str(tmpdir)
        try:
            for script in ("build_content.py", "build_content_trends.py", "build_site_analysis.py"):
                runpy.run_path(str(_PIPELINE / script), run_name="__main__")
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

        payloads = {name: (tmpdir / filename).read_bytes() for name, filename in FILES.items()}

    etags = {name: hashlib.sha256(blob).hexdigest()[:32] for name, blob in payloads.items()}
    total = sum(len(b) for b in payloads.values())
    _log.info(
        "galileo: rebuilt %d payloads (%.1f KB) in %.1fs",
        len(payloads), total / 1024, time.monotonic() - started,
    )
    return payloads, etags


def _ensure_fresh() -> None:
    """Rebuild if the cache is empty or past its TTL. Caller must hold no lock."""
    with _lock:
        fresh = (
            _cache["payloads"] is not None
            and (time.monotonic() - _cache["built_at"]) < cache_ttl()
        )
        if fresh:
            return
        try:
            payloads, etags = _build()
        except Exception:
            if _cache["payloads"] is None:
                raise
            # Serving data a few minutes stale beats serving an error page, and
            # the next request will try again.
            _log.exception("galileo: rebuild failed, continuing to serve the cached payloads")
            return
        _cache.update(payloads=payloads, etags=etags, built_at=time.monotonic())


def get_payload(name: str) -> tuple[bytes, str]:
    """(json_bytes, etag) for one payload. Raises KeyError for an unknown name."""
    if name not in FILES:
        raise KeyError(name)
    _ensure_fresh()
    return _cache["payloads"][name], _cache["etags"][name]


def invalidate() -> None:
    """Drop the cache so the next request rebuilds. Used by the refresh route."""
    with _lock:
        _cache.update(payloads=None, etags=None, built_at=0.0)


def status() -> dict:
    """Diagnostics for the refresh endpoint — no data, just cache state."""
    with _lock:
        built = _cache["built_at"]
        return {
            "cached": _cache["payloads"] is not None,
            "age_seconds": round(time.monotonic() - built, 1) if built else None,
            "ttl_seconds": cache_ttl(),
            "etags": dict(_cache["etags"] or {}),
        }
