"""
End-to-End API Integration and Smoke Tests (FR-05, FR-06, FR-08, FR-09, FR-11, FR-12).

Tests:
1. Health check (/api/health)
2. Lender overview (/api/overview)
3. Demo cases retrieval (/api/cases)
4. Case scoring with model-estimated probability and exact feature attributions (/api/cases/{case_id}/score)
5. Human review recording (/api/cases/{case_id}/review)
6. Metrics endpoint (/api/metrics)
7. Audit log retrieval (/api/audit)
8. Input validation and error cases (invalid lender, missing case)
"""

import base64
import unittest
import json
import sqlite3
from fastapi.testclient import TestClient

from backend.app.main import app, DB_PATH, init_db


def create_mock_jwt(email: str, name: str = "Test User") -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "email": email,
        "name": name,
        "sub": f"google_{email}",
        "email_verified": True,
    }).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"


class TestFedCreditXAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        auditor_token = create_mock_jwt("auditor@fedcreditx.org")
        auditor_res = cls.client.post("/api/auth/select-role", json={
            "id_token": auditor_token,
            "requested_role": "risk_auditor",
        }).json()
        cls.auditor_headers = {"Authorization": f"Bearer {auditor_res['session_token']}"}

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertEqual(data["service"], "fedcreditx-api")
        self.assertIn("partitions_found", data)
        self.assertTrue(data["partitions_found"]["lender_a"])
        self.assertTrue(data["partitions_found"]["lender_b"])
        self.assertTrue(data["partitions_found"]["lender_c"])
        self.assertTrue(data["partitions_found"]["holdout_test"])

    def test_overview_endpoint(self):
        response = self.client.get("/api/overview")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("disclaimer", data)
        self.assertIn("lenders", data)
        self.assertEqual(len(data["lenders"]), 3)
        self.assertEqual(data["lenders"][0]["lender_id"], "lender_a")

    def test_demo_cases_retrieval(self):
        for lender in ["lender_a", "lender_b", "lender_c"]:
            response = self.client.get(f"/api/cases?lender_id={lender}", headers=self.auditor_headers)
            self.assertEqual(response.status_code, 200)
            cases = response.json()
            self.assertIsInstance(cases, list)
            self.assertGreater(len(cases), 0)
            self.assertIn("case_id", cases[0])
            self.assertIn("features", cases[0])

    def test_invalid_lender_rejected(self):
        response = self.client.get("/api/cases?lender_id=invalid_bank", headers=self.auditor_headers)
        self.assertEqual(response.status_code, 422)

    def test_scoring_case_and_attributions(self):
        response = self.client.post("/api/cases/DEMO-A-001/score?lender_id=lender_a")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["case_id"], "DEMO-A-001")
        self.assertEqual(data["lender_id"], "lender_a")
        self.assertIn("default_probability_estimate", data)
        self.assertGreaterEqual(data["default_probability_estimate"], 0.0)
        self.assertLessEqual(data["default_probability_estimate"], 1.0)
        self.assertIn("demo_risk_band", data)
        self.assertIn("attributions", data)
        self.assertGreater(len(data["attributions"]), 0)

        # Verify calibration caveat
        self.assertIn("calibration_caveat", data)
        self.assertIn("Demonstration estimate on synthetic data", data["calibration_caveat"])

    def test_nonexistent_case_scoring_returns_404(self):
        response = self.client.post("/api/cases/NONEXISTENT_CASE_999/score?lender_id=lender_a")
        self.assertEqual(response.status_code, 404)

    def test_human_review_workflow(self):
        payload = {
            "review_status": "reviewed",
            "reviewer_label": "senior_underwriter_01",
            "note_code": "CODE-VERIFIED",
        }
        response = self.client.post("/api/cases/DEMO-A-001/review", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["case_id"], "DEMO-A-001")
        self.assertEqual(data["review_status"], "reviewed")
        self.assertIn("audit_event_id", data)

    def test_metrics_endpoint(self):
        response = self.client.get("/api/metrics", headers=self.auditor_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("centralized_baseline", data)
        self.assertIn("federated_learning", data)
        self.assertIn("evaluation_partition", data)
        if data["centralized_baseline"]:
            self.assertIn("roc_auc", data["centralized_baseline"])
        if data["federated_learning"]:
            self.assertIn("roc_auc", data["federated_learning"])

    def test_audit_log_endpoint(self):
        response = self.client.get("/api/audit?limit=10", headers=self.auditor_headers)
        self.assertEqual(response.status_code, 200)
        events = response.json()
        self.assertIsInstance(events, list)
        if len(events) > 0:
            self.assertIn("id", events[0])
            self.assertIn("event_type", events[0])
            self.assertIn("actor_type", events[0])


if __name__ == "__main__":
    unittest.main()
