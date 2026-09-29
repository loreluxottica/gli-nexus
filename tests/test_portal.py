"""Regression tests for the GLI Nexus portal integration."""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

import app


ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "portal"


class PortalContractTests(unittest.TestCase):
    def test_assets_have_one_canonical_copy(self) -> None:
        seen = {}
        duplicates = []
        # Local ignored intake material is not part of the shipped repository.
        files = subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z",
             "--", str(Path("portal") / "assets"), str(Path("portal") / "GLI-Branding"),
             "Project Details", "new-font"],
            cwd=ROOT,
            # Preserve empty Git config values after patch.dict on Windows.
            env=os.environ.copy(),
        ).decode("utf-8").split("\0")
        for name in sorted(set(files) - {""}):
            path = ROOT / name
            if not path.is_file() or path.suffix.lower() not in {
                ".png", ".jpg", ".svg", ".otf", ".woff",
            }:
                continue
            digest = hashlib.sha256(path.read_bytes()).digest()
            if digest in seen:
                duplicates.append((str(seen[digest]), str(path)))
            else:
                seen[digest] = path
        self.assertEqual(duplicates, [])
        self.assertFalse((ROOT / "new font.zip").exists())

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

    def test_portal_uses_gli_type_system(self) -> None:
        """Geist for UI, Sora for display, IBM Plex Mono for data; no Avenir."""
        tokens = (PORTAL / "css" / "tokens.css").read_text(encoding="utf-8")
        for token, family in (
            ("--font-ui", "Geist"),
            ("--font-display", "Sora"),
            ("--font-mono", "IBM Plex Mono"),
        ):
            with self.subTest(token=token):
                self.assertRegex(tokens, rf'{token}:\s*"{family}"')
        html = (PORTAL / "index.html").read_text(encoding="utf-8")
        for family in ("family=Geist:", "family=Sora:", "family=IBM+Plex+Mono:"):
            self.assertIn(family, html)
        self.assertFalse((PORTAL / "css" / "fonts.css").exists())
        sources = [
            PORTAL / "index.html",
            *sorted((PORTAL / "css").glob("*.css")),
            *sorted((PORTAL / "js").glob("*.js")),
        ]
        stale = [p.name for p in sources if "avenir" in p.read_text(encoding="utf-8").lower()]
        self.assertEqual(stale, [])

    def test_gate_markup_and_script_order(self) -> None:
        """The gate keeps the GLI lockup and the endorsement; the corridor
        (gate-bg.js) loads before its controller, the launcher after it."""
        html = (PORTAL / "index.html").read_text(encoding="utf-8")
        for expected in (
            'id="gate"',
            'id="gateCanvas"',
            'id="gateOpen"',
            'class="gate-signature"',
            'src="assets/gli-monolite.png"',
            'src="assets/essilorluxottica-logo-white.png"',
        ):
            self.assertIn(expected, html)
        order = [html.index(f'src="js/{name}"') for name in ("gate-bg.js", "gate.js", "launcher.js")]
        self.assertEqual(order, sorted(order))

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
            'link: "http://10.200.112.48:5058/"',
            'project: "LMS"',
            'link: "http://10.200.112.48:5001/"',
            'project: "DOPPLER"',
            'link: "http://10.200.112.48:5056/"',
            'project: "SYNCHRO"',
            'backgroundType: "shift"',
            'backgroundType: "radar"',
            'backgroundType: "sync"',
        ):
            self.assertIn(expected, data)

    def test_gabri_worlds_have_dedicated_backgrounds(self) -> None:
        """LMS / Doppler / Synchro must not reuse another product's canvas world."""
        worlds = (PORTAL / "js" / "worlds-data.js").read_text(encoding="utf-8")
        bg = (PORTAL / "js" / "worlds-bg.js").read_text(encoding="utf-8")
        for type_name, drawer in (
            ("shift", "drawShift"),
            ("radar", "drawRadar"),
            ("sync", "drawSync"),
        ):
            self.assertIn(f'backgroundType: "{type_name}"', worlds)
            self.assertIn(f"function {drawer}(t)", bg)
            self.assertIn(f'world.type === "{type_name}"', bg)

    def test_world_logos_exist(self) -> None:
        worlds = (PORTAL / "js" / "worlds-data.js").read_text(encoding="utf-8")
        logos = re.findall(r'^\s+logo:\s*"([^"]+)"\s*,?\s*$', worlds, re.MULTILINE)
        self.assertGreaterEqual(len(logos), 9)
        missing = [logo for logo in logos if not (PORTAL / logo).is_file()]
        self.assertEqual(missing, [])


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

    def test_legacy_branding_urls_serve_canonical_bytes(self) -> None:
        aliases = {
            "assets/essilorluxottica-logo-white.png": "essilorluxottica-logo-white.png",
            **{
                f"assets/web/gli-{name}.png": f"gli-{name}.png"
                for name in (
                    "cortana", "data-entry", "doppler", "galileo", "kelly",
                    "laplace", "lms", "monolite", "prism", "synchro",
                )
            },
        }
        for legacy, canonical in aliases.items():
            with self.subTest(legacy=legacy):
                response = self.client.get(f"/GLI-Branding/{legacy}")
                try:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.mimetype, "image/png")
                    self.assertEqual(
                        response.data, (PORTAL / "assets" / canonical).read_bytes()
                    )
                finally:
                    response.close()

    def test_legacy_branding_does_not_alias_other_paths(self) -> None:
        for path in (
            "assets/web/missing.png",
            "assets/web/gli-kelly-back.png",
            "assets/web/../gli-kelly.png",
            "../index.html",
        ):
            with self.subTest(path=path):
                response = self.client.get(f"/GLI-Branding/{path}")
                try:
                    self.assertEqual(response.status_code, 404)
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

    @patch("shared.auth.get_user_projects", return_value=None)
    @patch("shared.auth.get_current_email", return_value="person@example.com")
    def test_access_api_lookup_failure_is_not_empty_grants(self, _email, _projects) -> None:
        response = self.client.get("/api/my-access")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"projects": [], "error": "lookup_failed"},
        )

    @patch("shared.auth.get_user_projects", return_value=frozenset())
    @patch("shared.auth.get_current_email", return_value="person@example.com")
    def test_access_api_empty_grants_has_no_error(self, _email, _projects) -> None:
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

    def test_access_controller_retries_lookup_failure(self) -> None:
        js = (PORTAL / "js" / "access.js").read_text(encoding="utf-8")
        self.assertIn("lookup_failed", js)
        self.assertIn("scheduleRetry", js)
        self.assertIn("Access check failed", js)
        self.assertIn("/api/my-access", js)
        self.assertNotIn("r.ok ? r.json() : { projects: [] }", js)

    def test_cta_uses_closed_label_helper(self) -> None:
        for name in ("single.js", "detail.js"):
            js = (PORTAL / "js" / name).read_text(encoding="utf-8")
            with self.subTest(name=name):
                self.assertIn("closedCtaLabel", js)

    def test_intake_alias_for_deep_link(self) -> None:
        js = (PORTAL / "js" / "single.js").read_text(encoding="utf-8")
        self.assertIn("intake", js)
        self.assertIn("data-entry", js)

    def test_gate_covers_panels_and_degrades(self) -> None:
        """The suite opens under the warp, so the gate must stack above the
        launcher and detail layers; without WebGL it falls back to a static
        background, and it honours reduced motion."""
        def z_index(css_file: str, selector: str) -> int:
            css = (PORTAL / "css" / css_file).read_text(encoding="utf-8")
            block = re.search(rf"^{re.escape(selector)} \{{([^}}]*)\}}", css, re.MULTILINE)
            self.assertIsNotNone(block, selector)
            value = re.search(r"z-index:\s*(\d+)", block.group(1))
            self.assertIsNotNone(value, selector)
            return int(value.group(1))

        gate = z_index("gate.css", ".gate")
        self.assertGreater(gate, z_index("launcher.css", ".launcher"))
        self.assertGreater(gate, z_index("detail.css", ".detail-layer"))

        gate_css = (PORTAL / "css" / "gate.css").read_text(encoding="utf-8")
        gate_js = (PORTAL / "js" / "gate.js").read_text(encoding="utf-8")
        gate_bg = (PORTAL / "js" / "gate-bg.js").read_text(encoding="utf-8")
        self.assertIn('classList.add("is-static")', gate_js)
        self.assertIn(".gate.is-static", gate_css)
        for name, source in (("gate.css", gate_css), ("gate.js", gate_js), ("gate-bg.js", gate_bg)):
            with self.subTest(name=name):
                self.assertIn("prefers-reduced-motion: reduce", source)


class KellyRouteTests(unittest.TestCase):
    def test_dispatcher_serves_kelly_shell_and_assets(self):
        from werkzeug.test import Client
        from werkzeug.wrappers import Response

        client = Client(app.application, Response)
        for path in ("/kelly/", "/kelly/_dash-layout", "/kelly/assets/style.css"):
            with self.subTest(path=path):
                response = client.get(path)
                try:
                    self.assertEqual(response.status_code, 200)
                finally:
                    response.close()

    def test_forecast_and_performance_keep_plant_and_mount_scope(self):
        from kelly_dashboard import app as kelly

        for prefix in ("/", "/kelly/"):
            for name in ("forecast", "performance"):
                with (
                    self.subTest(prefix=prefix, page=name),
                    patch.object(kelly, "_PREFIX", prefix),
                    patch.object(kelly.auth, "is_authorized", return_value=True) as allowed,
                    patch.object(getattr(kelly, name), "layout", return_value="plant-view") as layout,
                ):
                    self.assertEqual(kelly.route(f"{prefix}{name}/atlanta"), "plant-view")
                    allowed.assert_called_once_with("atlanta")
                    layout.assert_called_once_with(warehouse_id="atlanta")

    def test_denied_plant_never_loads_forecast(self):
        from kelly_dashboard import app as kelly

        with (
            patch.object(kelly.auth, "is_authorized", return_value=False),
            patch.object(kelly.denied, "layout", return_value="denied") as denied,
            patch.object(kelly.forecast, "layout") as forecast,
        ):
            self.assertEqual(kelly.route("/kelly/forecast/atlanta"), "denied")
            denied.assert_called_once_with("atlanta")
            forecast.assert_not_called()

    def test_landing_preserves_project_gate(self):
        from kelly_dashboard import app as kelly

        with (
            patch.object(kelly, "_kelly_landing_allowed", return_value=False),
            patch.object(kelly.denied, "layout", return_value="denied"),
            patch.object(kelly.landing, "layout") as landing,
        ):
            self.assertEqual(kelly.route("/kelly/"), "denied")
            landing.assert_not_called()


class AuthLookupTests(unittest.TestCase):
    def test_grant_lookups_use_short_sql_timeout(self) -> None:
        from shared import auth

        self.assertLessEqual(auth._AUTH_SQL_TIMEOUT_S, 15)
        self.assertLessEqual(auth._AUTH_SQL_RETRIES, 3)
        self.assertLessEqual(auth._AUTH_SQL_RETRY_BUDGET_S, 30)


class GalileoAuthTests(unittest.TestCase):
    def test_roadmap_is_disabled_but_implementation_is_retained(self) -> None:
        from projects.galileo_dashboard import server as galileo

        project = ROOT / "projects" / "galileo_dashboard"
        for path in (
            project / "src" / "app" / "roadmap" / "page.tsx",
            project / "src" / "components" / "roadmap" / "RoadmapView.tsx",
            project / "src" / "data" / "roadmap.ts",
        ):
            self.assertTrue(path.is_file(), path)

        client = app.root.test_client()
        with (
            patch.object(galileo.auth, "authorized", return_value=True),
            patch.object(galileo, "_ROADMAP_ENABLED", False),
        ):
            landing = client.get("/galileo/")
            try:
                self.assertEqual(landing.status_code, 200)
                self.assertNotIn(b"Development roadmap", landing.data)
            finally:
                landing.close()

            for path in ("/galileo/roadmap/", "/galileo/roadmap/index.html"):
                with self.subTest(path=path):
                    response = client.get(path)
                    try:
                        self.assertEqual(response.status_code, 404)
                    finally:
                        response.close()

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
