import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/"validate_spatial_assets.py"
spec=importlib.util.spec_from_file_location("spatial_assets",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AssetPreflightTests(unittest.TestCase):
    def test_obj_bounds_and_sha(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"femur.obj"
            path.write_text("v 0 1 2\nv 3 4 5\nv -2 0 6\nf 1 2 3\n")
            x=module.describe("femur",path)
            self.assertEqual(x["fma_id"],24474)
            self.assertEqual(x["span"],[5.0,4.0,4.0])
            self.assertEqual(len(x["sha256"]),64)
    def test_binary_stl_vertices(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"tibia.stl"
            h=b" " * 80+struct.pack("<I",1)
            face=struct.pack("<12fH",0,0,1,0,0,0,1,0,0,0,1,0,0)
            path.write_bytes(h+face)
            x=module.describe("tibia",path)
            self.assertEqual(x["triangles"],1)
            self.assertEqual(x["vertex_occurrences"],3)
    def test_missing_bone_cannot_be_verified(self):
        with self.assertRaisesRegex(ValueError,"Missing required anatomy"):
            module.report({},"test","https://example.com/licence")
    def test_all_bones_still_require_anatomical_review(self):
        entry={key:{"min":[-1,-1,-1],"max":[1,1,1],"span":[2,2,2]} for key in module.REQUIRED}
        result=module.report(entry,"test","https://example.com")
        self.assertFalse(result["reviewed"])
        self.assertFalse(result["usable_as_verified_medical_geometry"])
        self.assertEqual(len(result["geometry"]),4)

if __name__=="__main__":
    unittest.main()
