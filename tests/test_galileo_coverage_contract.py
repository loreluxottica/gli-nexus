import ast
import unittest
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "projects" / "galileo_dashboard" / "data_pipeline" / "build_content.py"


def load_coverage_builder():
    """Load only the pure Coverage helpers without running pipeline I/O."""
    tree = ast.parse(BUILDER.read_text(encoding="utf-8"), filename=str(BUILDER))
    wanted = {"to_float", "norm_area", "norm_tier", "build_coverage_efficiency"}
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
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(BUILDER), "exec"), namespace)
    return namespace["build_coverage_efficiency"]


class GalileoCoverageContractTest(unittest.TestCase):
    def test_frontend_excel_volume_formula_is_preserved(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [
            [
                "Site", "Market", "Product", "Site Type", "Galileo Volume",
                "Coverage", "Estimated Volume", "Covered 2025", "Area",
                "Automation",
            ],
            ["Site A", "REP", "RX", "Export Labs", "10", "999%", "100", "", "EMEA", "Low"],
            ["Site A", "REP", "RX", "Export Labs", "0", "999%", "50", "", "EMEA", "High"],
            ["Site B", "REP", "RX", "Export Labs", "0", "999%", "200", "", "EMEA", "Mid"],
            [
                "Site C", "REP", "Stock Lenses", "Mass Production | DCs",
                "0", "999%", "0", "", "NA", "High",
            ],
        ]

        blocks = {
            block["product"]: block["rows"]
            for block in build_coverage_efficiency(rows)
        }
        rx = blocks["RX"][0]

        # Volume math counts all CSV rows, while site/tier counts are distinct.
        self.assertEqual(rx["tot_sites"], 2)
        self.assertEqual(rx["estimated_volume"], 350)
        self.assertAlmostEqual(rx["coverage_pct"], 100 / 350)
        self.assertEqual(rx["low"], 0.5)
        self.assertEqual(rx["mid"], 0.5)
        self.assertEqual(rx["high"], 0.0)

        # The precomputed Coverage column is ignored; Galileo Volume drives
        # whether each row's full Estimated Volume is covered.
        self.assertNotEqual(rx["coverage_pct"], 9.99)

        stock = blocks["Stock Lenses"][0]
        self.assertIsNone(stock["estimated_volume"])
        self.assertIsNone(stock["coverage_pct"])

    def test_missing_frontend_volume_columns_are_rejected(self):
        build_coverage_efficiency = load_coverage_builder()
        rows = [["Site", "Product", "Site Type", "Area", "Automation"]]

        with self.assertRaisesRegex(
            ValueError, "Estimated Volume, Galileo Volume"
        ):
            build_coverage_efficiency(rows)


if __name__ == "__main__":
    unittest.main()
