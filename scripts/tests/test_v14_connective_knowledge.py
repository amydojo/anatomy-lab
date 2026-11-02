"""V14 knowledge inventory tests; works with Python stdlib and existing source suites."""
import json
import pathlib
import unittest
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[2]
KNOWLEDGE = ROOT / "atlas/assets/v14-connective-knowledge.json"
with KNOWLEDGE.open(encoding="utf-8") as file:
    DATA = json.load(file)


class ConnectiveKnowledgeTests(unittest.TestCase):
    def test_unique_canonical_ids(self):
        records = DATA["structures"]
        self.assertEqual(len(records), 26)
        self.assertEqual(len({x["id"] for x in records}), 26)
        self.assertTrue(all(x["id"] == x["canonicalCoverageId"] for x in records))

    def test_six_regions(self):
        regions = {r: sum(x["region"] == r for x in DATA["structures"]) for r in
                   ("knee", "shoulder", "hip", "ankle", "wrist", "spine")}
        self.assertEqual(regions, {"knee": 8, "shoulder": 4, "hip": 3,
                                   "ankle": 4, "wrist": 3, "spine": 4})

    def test_reference_integrity_and_separate_geometry(self):
        sources = DATA["sources"]
        for record in DATA["structures"]:
            self.assertTrue(record["sourceRefs"], record["id"])
            for source_id in record["sourceRefs"]:
                self.assertIn(source_id, sources)
                source = sources[source_id]
                self.assertEqual(urlparse(source["url"]).scheme, "https")
                self.assertTrue(source["section"])
            self.assertFalse(record["geometry"]["geometryVerified"])
            self.assertFalse(record["geometry"]["attachmentCoordinatesValidated"])
            self.assertFalse(record["knowledgeEvidence"]["anatomistReviewed"])

    def test_relationships_resolve_and_are_sourced(self):
        known = {x["id"] for x in DATA["structures"]}
        for edge in DATA["relationships"]:
            self.assertIn(edge["from"], known)
            self.assertIn(edge["to"], known)
            self.assertTrue(edge["sourceRefs"])
            self.assertTrue(all(ref in DATA["sources"] for ref in edge["sourceRefs"]))

    def test_knee_attachments_and_no_lcl_to_meniscus(self):
        records = {r["id"]: r for r in DATA["structures"]}
        self.assertIn("lateral femoral condyle",
                      records["anterior-cruciate-ligament"]["attachments"]["distal"])
        self.assertIn("medial femoral condyle",
                      records["posterior-cruciate-ligament"]["attachments"]["distal"])
        self.assertIn("fibular head",
                      records["lateral-collateral-ligament"]["attachments"]["distal"])
        self.assertFalse(any(x["targetId"] == "lateral-meniscus" and "attach" in x["type"]
                             for x in records["lateral-collateral-ligament"]["anatomicalRelationships"]))


if __name__ == "__main__":
    unittest.main()
