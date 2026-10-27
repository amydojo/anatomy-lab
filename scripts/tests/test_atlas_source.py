import hashlib,json,math,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DIR=ROOT/'atlas/assets'
class AtlasGeometryTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.asset=json.loads((DIR/'body-skeleton.json').read_text())
  cls.proof=json.loads((DIR/'provenance.json').read_text())
 def test_source_license_and_integrity(self):
  a,p=self.asset,self.proof
  self.assertEqual(a['schema'],'body-live/atlas-skeleton-v1')
  self.assertEqual(a['source_commit'],p['pinned_commit'])
  self.assertEqual(a['license'],'CC BY 4.0')
  self.assertFalse(p['anatomist_reviewed'])
  self.assertFalse(p['patient_specific'])
  self.assertTrue(p['not_complete_body'])
  self.assertEqual(p['lod_json_sha256'],hashlib.sha256((DIR/'body-skeleton.json').read_bytes()).hexdigest())
  self.assertEqual(set(p['source_files']),{'atlas.json','body-11.bin','body-12.bin','body-13.bin'})
  self.assertTrue(all(len(q['sha256'])==64 for q in p['source_files'].values()))
 def test_skeletal_coverage_and_shared_frame(self):
  a,p=self.asset,self.proof
  self.assertEqual(len(a['parts']),78);self.assertEqual(p['part_count'],78)
  self.assertEqual(a['source_frame'],p['source_frame'])
  self.assertEqual(a['source_frame']['scale'],5)
  names={v['name'] for v in a['parts']}
  for n in ['Right hip bone','Left hip bone','Right femur','Left femur','Right tibia','Left tibia','Sacrum','Right humerus','Left humerus','Mandible']:
   self.assertIn(n,names)
  self.assertEqual(sum(n.lower().endswith(' rib') for n in names),24)
  self.assertGreater(p['lod_triangle_count'],20000)
 def test_individual_faces_and_provenance(self):
  a,p=self.asset,self.proof
  self.assertEqual(len({v['id'] for v in a['parts']}),len(a['parts']))
  for part in a['parts']:
   self.assertIn(part['id'],p['models'])
   self.assertEqual(part['fma'],p['models'][part['id']]['fma'])
   self.assertGreater(len(part['vertices']),30)
   self.assertGreater(len(part['faces']),69)
   self.assertEqual(len(part['faces']),p['models'][part['id']]['lod_triangles'])
   self.assertTrue(all(len(v)==3 and all(math.isfinite(x) for x in v) for v in part['vertices']))
   self.assertTrue(all(len(f)==3 and all(isinstance(i,int) and 0<=i<len(part['vertices']) for i in f) for f in part['faces']))
 def test_surface_is_not_nerve_claim(self):
  p=self.proof;self.assertIn('ligaments',p['absent_structures'])
  self.assertFalse(p['anatomist_reviewed'])
  self.assertTrue(any('sciatic' in s.lower() for s in p['limitations']))
if __name__=='__main__':unittest.main()
