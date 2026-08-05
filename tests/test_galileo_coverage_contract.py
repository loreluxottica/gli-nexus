import ast
import re
import unittest
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "projects" / "galileo_dashboard" / "data_pipeline" / "build_content.py"
REFERENCE_BUILDER = (
    ROOT / "projects" / "galileo_dashboard" / "reference-data-pipeline"
    / "build_content.py"
)


def load_pipeline_helpers(path=BUILDER):
    """Load only pure Coverage helpers without running pipeline I/O."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    wanted = {
        "to_float", "parse_coverage_volume", "norm_area", "norm_tier", "parse_pct",
        "build_coverage_efficiency", "build_mappings_under_review",
    }
    functions = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in wanted
    ]
    namespace = {
        "defaultdict": defaultdict,
        "re": re,
        "PRODUCTS_ORDER": ["Finished Frames", "GV Frames", "RX", "Stock Lenses"],
        "AREAS": {"EMEA", "LATAM", "APAC", "NA"},
        "GEOS": ["EMEA", "NA", "APAC", "LATAM"],
        "TIERS": ["Low", "Mid", "High"],
        "PRODUCT_FAMILY": {
            "RX": "RX",
            "Stock Lenses": "Stock Lenses",
            "Finished Frames": "Frames",
            "GV Frames": "Frames",
        },
        "FAMILY_ORDER": ["Frames", "RX", "Stock Lenses"],
    }
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(path), "exec"), namespace)
    return namespace


def load_coverage_builder(path=BUILDER):
    return load_pipeline_helpers(path)["build_coverage_efficiency"]


def load_unmapped_builder(path=BUILDER):
    return load_pipeline_helpers(path)["build_mappings_under_review"]


def load_coverage_volume_parser(path=BUILDER):
    return load_pipeline_helpers(path)["parse_coverage_volume"]


class GalileoCoverageContractTest(unittest.TestCase):
    def test_estimated_volume_parser_accepts_excel_number_formats(self):
        parse_volume = load_coverage_volume_parser()
        expected = 1_234_567.5
        for raw in (
            "1234567.5",
            "1.234.567,5",
            "1,234,567.5",
            "1\u00a0234\u00a0567,5",
        ):
            with self.subTest(raw=raw):
                self.assertAlmostEqual(parse_volume(raw), expected)

        self.assertEqual(parse_volume("1.234.567"), 1_234_567)
        self.assertEqual(parse_volume("1,234,567"), 1_234_567)
        with self.assertRaisesRegex(ValueError, "invalid Estimated Volume"):
            parse_volume("volume pending")

    def test_source_product_area_coverage_is_authoritative(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["Site A", "REP", "RX", "Export Labs", "10", "90%", "100", "", "APAC", "Low", "Mapped"],
            ["Site A", "REP", "RX", "Export Labs", "0", "90%", "50", "", "APAC", "High", "Mapped"],
            ["Site B", "REP", "RX", "Export Labs", "0", "90%", "200", "", "APAC", "Mid", "Unmapped"],
            [
                "Site C", "REP", "Stock Lenses", "Mass Production | DCs",
                "0", "", "0", "", "NA", "High", "Unmapped",
            ],
        ]

        blocks = {
            block["product"]: block["rows"]
            for block in build_coverage_efficiency(rows)
        }
        rx = blocks["RX"][0]

        # Estimated volume counts all CSV rows, while site/tier counts are distinct.
        self.assertEqual(rx["tot_sites"], 2)
        self.assertEqual(rx["estimated_volume"], 350)
        self.assertAlmostEqual(rx["coverage_pct"], 0.9)
        self.assertEqual(rx["low"], 0.5)
        self.assertEqual(rx["mid"], 0.5)
        self.assertEqual(rx["high"], 0.0)

        # A positive Galileo Volume no longer promotes the row's entire
        # Estimated Volume to 100% covered.
        self.assertNotAlmostEqual(rx["coverage_pct"], 100 / 350)

        stock = blocks["Stock Lenses"][0]
        self.assertIsNone(stock["estimated_volume"])
        self.assertIsNone(stock["coverage_pct"])

    def test_missing_frontend_volume_columns_are_rejected(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [["Site", "Product", "Site Type", "Area", "Automation"]]

        with self.assertRaisesRegex(
            ValueError, "Coverage, Estimated Volume, Galileo Volume, Mapping"
        ):
            build_coverage_efficiency(rows)

    def test_inconsistent_source_coverage_is_rejected(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["Site A", "REP", "RX", "Export Labs", "10", "90%", "100", "", "APAC", "Low", "Mapped"],
            ["Site B", "REP", "RX", "Export Labs", "5", "91%", "100", "", "APAC", "Mid", "Mapped"],
        ]

        with self.assertRaisesRegex(
            ValueError, "inconsistent Coverage values for RX / APAC"
        ):
            build_coverage_efficiency(rows)

    def test_only_explicitly_unmapped_sites_are_published(self):
        build_unmapped = load_unmapped_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["NOVACEL", "REP", "RX", "Export Labs", "0", "90%", "200", "", "EMEA", "Low", "unmapped"],
            ["Closed in 2025", "REP", "RX", "Export Labs", "0", "90%", "100", "", "EMEA", "Low", "mapped"],
            ["Active site", "REP", "RX", "Export Labs", "50", "90%", "100", "", "EMEA", "High", "mapped"],
        ]

        blocks = {block["product"]: block for block in build_unmapped(rows)}
        self.assertEqual([site["site"] for site in blocks["RX"]["sites"]], ["NOVACEL"])
        novacel = blocks["RX"]["sites"][0]
        self.assertEqual(novacel["estimated_volume"], 200)
        self.assertAlmostEqual(novacel["weight_pct"], 0.5)

    def test_localized_rx_estimated_volume_produces_weight(self):
        build_unmapped = load_unmapped_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["NOVACEL", "REP", "RX", "Export Labs", "0", "90%", "1.234.567", "", "EMEA", "Low", "unmapped"],
            ["Mapped RX", "REP", "RX", "Export Labs", "50", "90%", "765.433", "", "EMEA", "High", "mapped"],
        ]

        rx = next(block for block in build_unmapped(rows) if block["product"] == "RX")
        self.assertEqual(len(rx["sites"]), 1)
        novacel = rx["sites"][0]
        self.assertEqual(novacel["estimated_volume"], 1_234_567)
        self.assertAlmostEqual(novacel["weight_pct"], 1_234_567 / 2_000_000)

    def test_unmapped_weights_stay_scoped_to_area(self):
        build_unmapped = load_unmapped_builder()
        header = [
            "Site", "Market", "Product", "Site Type", "Galileo Volume",
            "Coverage", "Estimated Volume", "Covered 2025", "Area",
            "Automation", "Mapping",
        ]
        source_rows = [
            ["Same Site", "REP", "RX", "Export Labs", "0", "90%", "100", "", "APAC", "Low", "unmapped"],
            ["Same Site", "REP", "RX", "Export Labs", "0", "90%", "50", "", "EMEA", "Low", "unmapped"],
        ]

        forward = build_unmapped([header, *source_rows])
        reverse = build_unmapped([header, *reversed(source_rows)])
        self.assertEqual(forward, reverse)
        rx_sites = next(block["sites"] for block in forward if block["product"] == "RX")
        self.assertEqual({site["area"] for site in rx_sites}, {"APAC", "EMEA"})
        self.assertTrue(all(site["weight_pct"] == 1.0 for site in rx_sites))

    def test_inconsistent_mapping_status_is_rejected(self):
        build_unmapped = load_unmapped_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["Site A", "REP", "RX", "Export Labs", "0", "90%", "100", "", "APAC", "Low", "mapped"],
            ["Site A", "REP", "RX", "Export Labs", "0", "90%", "50", "", "APAC", "Low", "unmapped"],
        ]

        with self.assertRaisesRegex(
            ValueError, "inconsistent Mapping values for Site A / RX / APAC"
        ):
            build_unmapped(rows)

    def test_reference_pipeline_keeps_the_same_coverage_rule(self):
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation", "Mapping",
            ],
            ["Site A", "REP", "RX", "Export Labs", "90", "90%", "100", "", "APAC", "Low", "Mapped"],
            ["Site B", "REP", "RX", "Export Labs", "5", "90%", "50", "", "APAC", "High", "Mapped"],
        ]

        active = load_coverage_builder()(rows)
        reference = load_coverage_builder(REFERENCE_BUILDER)(rows)
        self.assertEqual(active, reference)

        active_unmapped = load_unmapped_builder()(rows)
        reference_unmapped = load_unmapped_builder(REFERENCE_BUILDER)(rows)
        self.assertEqual(active_unmapped, reference_unmapped)


if __name__ == "__main__":
    unittest.main()
