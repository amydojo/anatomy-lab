"""Static provenance and geometry checks; cannot substitute for specialist review."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
GEO=ROOT / "knee/spatial/assets/bp3d-right-knee-4.0.json"
PROOF=ROOT / "knee/spatial/assets/provenance.json"
EXPECTED={"femur":"FMA24474","tibia":"FMA24477","fibula":"FMA24480","patella":"FMA24486"}

class ImportedKneeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads(GEO.read_text(encoding="utf-8"))
        cls.proof=json.loads(PROOF.read_text(encoding="utf-8"))
    def test_source_and_license_are_pinned(self):
        self.assertEqual(self.data["source_release"],"4.0 99%-reduced IS-A tree")
        self.assertEqual(self.data["license"],"CC BY 4.0")
        self.assertEqual(self.data["upstream_commit"],self.proof["upstream_commit"])
        self.assertEqual(len(self.proof["packed_chunk"]["sha256"]),64)
        self.assertFalse(self.proof["anatomist_reviewed"])
        self.assertFalse(self.proof["kinematically_validated"])
    def test_four_knee_bones_have_checked_topology(self):
        self.assertEqual(set(self.data["bone_meshes"]),set(EXPECTED))
        for bone,fma in EXPECTED.items():
            mesh=self.data["bone_meshes"][bone]
            self.assertEqual(mesh["fma"],fma)
            self.assertGreater(len(mesh["vertices"]),100)
            self.assertGreater(len(mesh["faces"]),200)
            for face in mesh["faces"]:
                self.assertEqual(len(face),3)
                self.assertTrue(all(0<=i<len(mesh["vertices"]) for i in face))
    def test_shared_alignment_and_anterior_patella(self):
        # The source frame has been uniformly transformed. These are only broad
        # spatial sanity checks; no anatomical landmark validation is implied.
        bounds={}
        for name,mesh in self.data["bone_meshes"].items():
            pts=mesh["vertices"]
            bounds[name]=([min(p[j] for p in pts) for j in range(3)],
                          [max(p[j] for p in pts) for j in range(3)])
        femur=bounds["femur"]
        tibia=bounds["tibia"]
        fibula=bounds["fibula"]
        patella=bounds["patella"]
        self.assertLess(abs(femur[0][1]-tibia[1][1]),.5)
        self.assertGreater(patella[0][2],femur[0][2])
        self.assertLess(fibula[1][0],tibia[1][0]+.3)
        self.assertEqual(self.data["aligned_shared_transform"]["scale_to_scene"],7.5)
if __name__=="__main__":
    unittest.main()
