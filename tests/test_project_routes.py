import json
import re
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flask import Flask

from projects.cortana_dashboard import server as cortana
from projects.laplace_dashboard import server as laplace


class ProjectRouteTests(unittest.TestCase):
    def setUp(self):
        server = Flask(__name__)
        server.register_blueprint(cortana.bp, url_prefix="/cortana")
        server.register_blueprint(laplace.bp, url_prefix="/laplace")
        self.client = server.test_client()

    def test_destinations_keep_separate_grants_and_deny_before_loading(self):
        for path, key in (
            ("/cortana/", "CORTANA"),
            ("/laplace/", "LAPLACEPIPELINE"),
            ("/laplace/flags-download", "FLAGS"),
        ):
            with (
                self.subTest(path=path),
                patch.object(cortana.auth, "authorized", return_value=False) as gate,
                patch.object(cortana, "_get_data") as usage,
                patch.object(laplace, "_get_report") as report,
                patch.object(laplace, "_read_volume_file") as download,
            ):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 403)
                self.assertIn(b"ACCESS RESTRICTED", response.data)
                gate.assert_called_once_with(key)
                usage.assert_not_called()
                report.assert_not_called()
                download.assert_not_called()

    def test_cortana_keeps_metrics_chart_and_placeholder_rendering(self):
        data = {
            "rows": [
                {"date": "2026-09-01", "space": "Alpha & Beta", "user": "one@example.com",
                 "messages": 4, "queries": 2, "conversations": 1},
                {"date": "2026-09-02", "space": "Gamma", "user": "two@example.com",
                 "messages": 6, "queries": 3, "conversations": 2},
            ],
            "loaded_at": datetime(2026, 9, 28, 10),
        }
        with (
            patch.object(cortana.auth, "authorized", return_value=True),
            patch.object(cortana, "_get_data", return_value=data),
        ):
            response = self.client.get("/cortana/")
        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)
        self.assertEqual(re.findall(r'class="kpi-val">(\d+)</div>', html), ["10", "2", "5", "2"])
        self.assertNotRegex(html, r"__[A-Z_]+__")
        self.assertIn("Alpha &amp; Beta", html)
        chart = json.loads(re.search(r"var DATA = (.+);", html).group(1))
        self.assertEqual(chart["labels"], ["2026-09-01", "2026-09-02"])
        self.assertEqual(
            [(item["label"], item["data"]) for item in chart["datasets"]],
            [("Alpha & Beta", [4, 0]), ("Gamma", [0, 6]), ("Total", [4, 6])],
        )

    def test_unavailable_sources_remain_explicit_503(self):
        for path, module, loader in (
            ("/cortana/", cortana, "_get_data"),
            ("/laplace/", laplace, "_get_report"),
            ("/laplace/flags-download", laplace, "_read_volume_file"),
        ):
            with (
                self.subTest(path=path),
                patch.object(module.auth, "authorized", return_value=True),
                patch.object(module, loader, return_value=None),
            ):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 503)
                self.assertIn(b"DATA UNAVAILABLE", response.data)

    def test_laplace_serves_complete_reports_and_fragments(self):
        for html in (
            "<!DOCTYPE html><html><body><main>Report</main></body></html>",
            "<main>Report</main>",
        ):
            with (
                self.subTest(html=html),
                patch.object(laplace.auth, "authorized", return_value=True),
                patch.object(laplace, "_get_report", return_value={"html": html}),
            ):
                response = self.client.get("/laplace/")
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"<main>Report</main>", response.data)
                self.assertEqual(response.data.count(b"All Projects"), 1)
                self.assertEqual(response.data.lower().count(b"<html"), 1)

    def test_flags_download_preserves_bytes_mime_and_filename(self):
        payload = b"PK\x03\x04synthetic-workbook"
        with (
            patch.object(laplace.auth, "authorized", return_value=True) as gate,
            patch.object(laplace, "_read_volume_file", return_value=payload) as read,
        ):
            response = self.client.get("/laplace/flags-download")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, payload)
        self.assertEqual(
            response.mimetype, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        self.assertEqual(
            response.headers["Content-Disposition"], 'attachment; filename="package_flags_2026.xlsx"'
        )
        gate.assert_called_once_with("FLAGS")
        read.assert_called_once_with(laplace._RUBY_VOLUME_PATH)

    def test_laplace_selects_latest_matching_volume_report(self):
        client = Mock()
        prefix = laplace._HTML_PREFIX
        client.files.list_directory_contents.return_value = [
            SimpleNamespace(name=f"{prefix}20260901.html",
                            path=f"/volume/{prefix}20260901.html", is_directory=False),
            SimpleNamespace(name=f"{prefix}20260928.html",
                            path=f"/volume/{prefix}20260928.html", is_directory=False),
            SimpleNamespace(name="unrelated.html", path="/volume/unrelated", is_directory=False),
            SimpleNamespace(name=f"{prefix}99999999.html", path="/volume/dir", is_directory=True),
        ]
        with patch.object(laplace, "_ws_client", return_value=client):
            self.assertEqual(laplace._latest_html_path(), f"/volume/{prefix}20260928.html")
        client.files.list_directory_contents.assert_called_once_with(laplace._HTML_DIR)


if __name__ == "__main__":
    unittest.main()
