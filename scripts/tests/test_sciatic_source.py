import json,math,unittest
from pathlib import Path
BASE=Path(__file__).resolve().parents[2]/'hip/spatial/assets'
class SciaticSourceTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=json.loads((BASE/'sciatic-source.json').read_text())
  cls.proof=json.loads((BASE/'sciatic-provenance.json').read_text())
 def test_geometry_and_licenses(self):
  self.assertEqual(self.data['schema'],'body-live/nerve-truth-atlas-v1')
  self.assertEqual(self.data['geometry_license'],'CC BY-SA 4.0')
  self.assertFalse(self.data['clinical_reviewed'])
  self.assertTrue(self.data['not_patient_specific'])
  self.assertFalse(self.proof['status']['imaging_derived'])
  self.assertFalse(self.proof['status']['anatomist_reviewed'])
  self.assertFalse(self.proof['status']['same_donor'])
  self.assertFalse(self.proof['micro_ct_2026']['imported'])
  self.assertEqual(set(self.data['segments']),{'sciatic','tibial','commonFibular'})
  self.assertEqual(set(self.data['graph']['sciatic']),{'tibial','commonFibular'})
 def test_meshes_and_derived_visual_centerline(self):
  for key,mesh in self.data['segments'].items():
   self.assertGreater(len(mesh['vertices']),100)
   self.assertGreater(len(mesh['faces']),40)
   self.assertTrue(all(len(v)==3 and all(math.isfinite(x) for x in v) for v in mesh['vertices']))
   self.assertTrue(all(len(f)==3 and all(isinstance(i,int) and 0<=i<len(mesh['vertices']) for i in f) for f in mesh['faces']))
   self.assertGreater(len(mesh['tracePoints_derived_not_measured']),10)
   self.assertEqual(mesh['geometry_source'],'Z-Anatomy / nerve surface derived from curves')
 def test_registration_and_provenance(self):
  r=self.data['registration']
  self.assertFalse(r['fit']['clinical_landmarks_verified'])
  self.assertEqual(len(r['rotation']),3)
  self.assertEqual(len(r['translation']),3)
  self.assertGreater(r['fit']['median_scene_units'],0)
  self.assertLess(r['fit']['median_scene_units'],1)
  self.assertLess(r['fit']['p95_scene_units'],1)
  self.assertEqual(r['fit']['rotation_determinant'],1)
  self.assertEqual(set(self.proof['source_files']),{'nervous.glb','skeletal.glb'})
  self.assertTrue(all(len(v['sha256'])==64 for v in self.proof['source_files'].values()))
  self.assertIn('same donor',self.proof['narrative'].lower())
 def test_licenses_are_discrete(self):
  license=(BASE/'NERVE-ASSET-LICENSE.txt').read_text()
  self.assertIn('CC BY-SA 4.0',license)
  self.assertIn('Z-Anatomy',license)
  self.assertIn('noncommercial',license.lower())
if __name__=='__main__':unittest.main()
