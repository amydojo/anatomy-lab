import json,math,unittest
from pathlib import Path
DIR=Path(__file__).resolve().parents[2]/'hip/spatial/assets'
EXPECTED={'hipBone':'FMA16586','femur':'FMA24474','sacrum':'FMA16202','maximus':'FMA22328','medius':'FMA22330','minimus':'FMA22332','piriformis':'FMA22340','obturator':'FMA22324','gemellusSuperior':'FMA22334','gemellusInferior':'FMA22336','quadratus':'FMA22338'}
class HipGeometryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=json.loads((DIR/'hip-source.json').read_text())
  cls.proof=json.loads((DIR/'provenance.json').read_text())
 def test_license_review_and_source_pinning(self):
  self.assertEqual(self.data['schema'],'body-live/hip-sourced-v1')
  self.assertEqual(self.data['license'],'CC BY 4.0')
  self.assertEqual(self.data['source_commit'],self.proof['pinned_commit'])
  self.assertFalse(self.proof['anatomist_reviewed'])
  self.assertFalse(self.proof['biomechanics_validated'])
  self.assertEqual(len(self.proof['inputs']),4)
  self.assertTrue(all(len(p['sha256'])==64 for p in self.proof['inputs'].values()))
 def test_eleven_bone_and_muscle_surfaces(self):
  self.assertEqual(set(self.data['parts']),set(EXPECTED))
  for name,fma in EXPECTED.items():
   mesh=self.data['parts'][name]
   self.assertEqual(mesh['fma'],fma)
   self.assertGreater(len(mesh['vertices']),250)
   self.assertGreater(len(mesh['faces']),200)
   self.assertTrue(all(len(v)==3 and all(math.isfinite(x) for x in v) for v in mesh['vertices']))
   self.assertTrue(all(len(f)==3 and all(type(i)==int and 0<=i<len(mesh['vertices']) for i in f) for f in mesh['faces']))
 def test_shared_coordinates_and_unsourced_nerve(self):
  self.assertEqual(self.data['shared_transform']['scale'],10)
  self.assertNotIn('sciatic',self.data['parts'])
  self.assertIn('schematic',self.proof['nerve_path'].lower())
  self.assertIn('Estimated',self.proof['joint_pivot'])
  def bounds(key,axis):
   return min(v[axis] for v in self.data['parts'][key]['vertices']),max(v[axis] for v in self.data['parts'][key]['vertices'])
  pelvis=bounds('hipBone',1); femur=bounds('femur',1);med=bounds('medius',1)
  self.assertLess(abs(pelvis[0]-femur[1]),3)
  self.assertLess(abs(pelvis[1]-med[1]),2)
if __name__=='__main__':unittest.main()
