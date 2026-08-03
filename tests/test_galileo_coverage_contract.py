import ast
import unittest
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "projects" / "galileo_dashboard" / "data_pipeline" / "build_content.py"
REFERENCE_BUILDER = (
    ROOT / "projects" / "galileo_dashboard" / "reference-data-pipeline"
    / "build_content.py"
)


def load_coverage_builder(path=BUILDER):
    """Load only the pure Coverage helpers without running pipeline I/O."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    wanted = {
        "to_float", "norm_area", "norm_tier", "parse_pct",
        "build_coverage_efficiency",
    }
    functions = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in wanted
    ]
    namespace = {
        "defaultdict": defaultdict,
        "PRODUCTS_ORDER": ["Finished Frames", "GV Frames", "RX", "Stock Lenses"],
        "AREAS": {"EMEA", "LATAM", "APAC", "NA"},
        "GEOS": ["EMEA", "NA", "APAC", "LATAM"],
        "TIERS": ["Low", "Mid", "High"],
    }
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(path), "exec"), namespace)
    return namespace["build_coverage_efficiency"]


class GalileoCoverageContractTest(unittest.TestCase):
    def test_source_product_area_coverage_is_authoritative(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation",
            ],
            ["Site A", "REP", "RX", "Export Labs", "10", "90%", "100", "", "APAC", "Low"],
            ["Site A", "REP", "RX", "Export Labs", "0", "90%", "50", "", "APAC", "High"],
            ["Site B", "REP", "RX", "Export Labs", "0", "90%", "200", "", "APAC", "Mid"],
            [
                "Site C", "REP", "Stock Lenses", "Mass Production | DCs",
                "0", "", "0", "", "NA", "High",
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
            ValueError, "Coverage, Estimated Volume, Galileo Volume"
        ):
            build_coverage_efficiency(rows)

    def test_inconsistent_source_coverage_is_rejected(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation",
            ],
            ["Site A", "REP", "RX", "Export Labs", "10", "90%", "100", "", "APAC", "Low"],
            ["Site B", "REP", "RX", "Export Labs", "5", "91%", "100", "", "APAC", "Mid"],
        ]

        with self.assertRaisesRegex(
            ValueError, "inconsistent Coverage values for RX / APAC"
        ):
            build_coverage_efficiency(rows)

    def test_reference_pipeline_keeps_the_same_coverage_rule(self):
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation",
            ],
            ["Site A", "REP", "RX", "Export Labs", "90", "90%", "100", "", "APAC", "Low"],
            ["Site B", "REP", "RX", "Export Labs", "5", "90%", "50", "", "APAC", "High"],
        ]

        active = load_coverage_builder()(rows)
        reference = load_coverage_builder(REFERENCE_BUILDER)(rows)
        self.assertEqual(active, reference)


if __name__ == "__main__":
    unittest.main()
