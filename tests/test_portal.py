"""Regression tests for the GLI Nexus portal integration."""

from __future__ import annotations

import re
import unittest
from pathlib import Path
from unittest.mock import patch

import app


ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "portal"


class PortalContractTests(unittest.TestCase):
    def test_html_local_assets_exist(self) -> None:
        html = (PORTAL / "index.html").read_text(encoding="utf-8")
        refs = re.findall(r'(?:src|href)="([^"]+)"', html)
        local_refs = [
            ref for ref in refs
            if not ref.startswith(("http://", "https://", "data:", "#"))
        ]
        missing = [ref for ref in local_refs if not (PORTAL / ref).is_file()]
        self.assertEqual(missing, [])

    def test_new_views_and_access_controller_are_loaded(self) -> None:
        html = (PORTAL / "index.html").read_text(encoding="utf-8")
        for expected in (
            'id="launcher"',
            'id="detailLayer"',
            'src="js/access.js"',
            'src="js/detail.js"',
            'src="js/launcher.js"',
        ):
            self.assertIn(expected, html)
        self.assertFalse((PORTAL / "index-single.html").exists())

    def test_detail_mode_switch_markup(self) -> None:
        """La scheda dettaglio mostra un racconto per volta: storia, poi demo.

        detail.js pilota il cambio modo scrivendo data-mode sul corpo della
        card; se uno di questi ganci sparisce, il controller resta muto
        senza che nulla vada in errore.
        """
        html = (PORTAL / "index.html").read_text(encoding="utf-8")
        for expected in (
            'id="detailBody" data-mode="story"',
            'id="modeToggle"',
            'id="stepPrev"',
            'id="stepNext"',
            'id="paneStory"',
            'id="paneDemo"',
            'id="storyRail"',
            'id="demoRail"',
            'id="demoTitle"',
        ):
            self.assertIn(expected, html)

    def test_detail_media_exist(self) -> None:
        data = (PORTAL / "js" / "detail-data.js").read_text(encoding="utf-8")
        shots = re.findall(r'^\s+shot:\s*"([^"]+)"\s*,?\s*$', data, re.MULTILINE)
        self.assertGreaterEqual(len(shots), 8)
        missing = [shot for shot in shots if not (PORTAL / shot).is_file()]
        self.assertEqual(missing, [])

    def test_production_destinations_and_grants_are_present(self) -> None:
        data = (PORTAL / "js" / "worlds-data.js").read_text(encoding="utf-8")
        for expected in (
            'link: "/cortana/"',
            'project: "CORTANA"',
            'link: "/galileo/"',
            'project: "GALILEO"',
            'link: "/kelly/"',
            'project: "KELLY"',
            'project: "LAPLACEPIPELINE"',
            'project: "LAPLACEMULTIDOC"',
            'project: "FLAGS"',
            'project: "VOLUMESDATAENTRY"',
        ):
            self.assertIn(expected, data)


class PortalRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = app.root.test_client()

    def test_portal_and_static_routes(self) -> None:
        checks = {
            "/": b'id="launcher"',
            "/css/launcher.css": b".launcher",
            "/js/access.js": b"NexusAccess",
            "/assets/gli-kelly-back.png": b"\x89PNG",
            "/GLI-Branding/assets/web/gli-monolite.png": b"\x89PNG",
            "/healthz": b"ok",
        }
        for path, marker in checks.items():
            with self.subTest(path=path):
                response = self.client.get(path)
                try:
                    self.assertEqual(response.status_code, 200)
                    self.assertIn(marker, response.data)
                finally:
                    response.close()

    @patch("shared.auth.get_user_projects", return_value={"KELLY", "FLAGS"})
    @patch("shared.auth.get_current_email", return_value="person@example.com")
    def test_access_api_preserves_project_contract(self, _email, _projects) -> None:
        response = self.client.get("/api/my-access")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"projects": ["FLAGS", "KELLY"]})

    @patch("shared.auth._in_databricks_app", return_value=False)
    @patch("shared.auth.get_current_email", return_value=None)
    def test_local_anonymous_access_remains_full(self, _email, _deployed) -> None:
        response = self.client.get("/api/my-access")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"projects": ["*"]})

    @patch("shared.auth._in_databricks_app", return_value=True)
    @patch("shared.auth.get_current_email", return_value=None)
    def test_deployed_anonymous_access_is_empty(self, _email, _deployed) -> None:
        response = self.client.get("/api/my-access")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"projects": []})


class PortalFrontendGuardTests(unittest.TestCase):
    def test_closed_layers_block_pointer_events(self) -> None:
        detail = (PORTAL / "css" / "detail.css").read_text(encoding="utf-8")
        launcher = (PORTAL / "css" / "launcher.css").read_text(encoding="utf-8")
        self.assertIn(".detail-layer:not(.is-open)", detail)
        self.assertIn("pointer-events: none !important", detail)
        self.assertIn(".launcher:not(.is-open)", launcher)
        self.assertIn("pointer-events: none !important", launcher)

    def test_deep_link_step_requires_detail_flag(self) -> None:
        """?s= alone must not latch demo mode; only with ?d=1."""
        js = (PORTAL / "js" / "detail.js").read_text(encoding="utf-8")
        self.assertIn('params.get("d") === "1"', js)
        # askedStep only applied inside the d=1 branch
        d_block = js.split("Deep-link:")[-1]
        self.assertIn("askedStep", d_block)
        self.assertIn('params.get("d") === "1"', d_block)

    def test_can_open_requires_project_key(self) -> None:
        js = (PORTAL / "js" / "single.js").read_text(encoding="utf-8")
        self.assertIn("if (!project) return false", js)

    def test_intake_alias_for_deep_link(self) -> None:
        js = (PORTAL / "js" / "single.js").read_text(encoding="utf-8")
        self.assertIn("intake", js)
        self.assertIn("data-entry", js)


class GalileoAuthTests(unittest.TestCase):
    def test_static_assets_require_grant(self) -> None:
        from projects.galileo_dashboard import server as galileo

        client = app.root.test_client()
        with patch.object(galileo.auth, "authorized", return_value=False):
            # Prefer a real static path if the export exists; otherwise any
            # extension path must still be 403, not an unauthenticated 404 leak
            # that skips auth before path resolution.
            for path in (
                "/galileo/_next/static/missing.js",
                "/galileo/content/index.txt",
                "/galileo/favicon.ico",
            ):
                with self.subTest(path=path):
                    response = client.get(path)
                    try:
                        self.assertEqual(response.status_code, 403)
                    finally:
                        response.close()

    def test_static_assets_allowed_with_grant(self) -> None:
        from projects.galileo_dashboard import server as galileo

        client = app.root.test_client()
        out = Path(galileo._OUT)
        if not out.is_dir():
            self.skipTest("Galileo out/ not built")
        # Find any real file under out for a 200 path
        sample = next(out.rglob("*.*"), None)
        if sample is None:
            self.skipTest("No static files in Galileo out/")
        rel = sample.relative_to(out).as_posix()
        with patch.object(galileo.auth, "authorized", return_value=True):
            response = client.get(f"/galileo/{rel}")
            try:
                self.assertIn(response.status_code, (200, 304))
            finally:
                response.close()


if __name__ == "__main__":
    unittest.main()