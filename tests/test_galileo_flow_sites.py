import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "projects" / "galileo_dashboard"


class GalileoFlowSitesTest(unittest.TestCase):
    def test_typed_flow_site_helpers(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Install Node and run the documented Galileo setup.")
        compiler = FRONTEND / "node_modules" / "typescript" / "bin" / "tsc"
        self.assertTrue(compiler.is_file(), "Run npm ci in projects/galileo_dashboard.")
        with tempfile.TemporaryDirectory(prefix="galileo-flow-sites-") as temporary:
            directory = Path(temporary)
            output = directory / "out"
            config = directory / "tsconfig.json"
            config.write_text(json.dumps({
                "extends": str(FRONTEND / "tsconfig.json"),
                "compilerOptions": {
                    "noEmit": False,
                    "incremental": False,
                    "module": "commonjs",
                    "moduleResolution": "node",
                    "rootDir": str(FRONTEND / "src"),
                    "outDir": str(output),
                },
                "include": [str(FRONTEND / "src" / "lib" / "flowSites.ts")],
                "exclude": [],
            }), encoding="utf-8")
            compiled = subprocess.run(
                [node, str(compiler), "-p", str(config)],
                cwd=ROOT, capture_output=True, text=True, timeout=120,
            )
            self.assertEqual(compiled.returncode, 0, compiled.stdout + compiled.stderr)
            result = subprocess.run(
                [node, "--test", str(ROOT / "tests" / "galileo_flow_sites.test.cjs")],
                cwd=ROOT, capture_output=True, text=True, timeout=60,
                env={**os.environ, "GALILEO_TEST_OUT": str(output)},
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
