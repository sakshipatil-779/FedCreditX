import json
import base64
import unittest
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app, init_db
from backend.federation.server_app import aggregate_weighted_fedavg


def create_mock_jwt(email: str, name: str = "Test User") -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "email": email,
        "name": name,
        "sub": f"google_{email}",
        "email_verified": True,
    }).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"


class TestFLOfficerUpdateAndRBAC(unittest.TestCase):
    def setUp(self):
        init_db()
        from backend.app.main import DB_PATH
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM fl_round_submissions WHERE round_id LIKE 'ROUND-TEST-%'")
        conn.commit()
        conn.close()

        self.client = TestClient(app)

        # Create active sessions
        res_officer = self.client.post(
            "/api/auth/select-role",
            json={
                "id_token": create_mock_jwt("priya.sharma@lender-bank.com"),
                "requested_role": "bank_officer",
            },
        )
        self.assertEqual(res_officer.status_code, 200)
        self.officer_token = res_officer.json()["session_token"]

        res_auditor = self.client.post(
            "/api/auth/select-role",
            json={
                "id_token": create_mock_jwt("auditor.lead@risk-auditor.google.com"),
                "requested_role": "risk_auditor",
            },
        )
        self.assertEqual(res_auditor.status_code, 200)
        self.auditor_token = res_auditor.json()["session_token"]


    def test_fedavg_weighted_average_three_known_vectors(self):
        """Validates that weighted FedAvg mathematically weights parameter vectors according to client sample counts."""
        u1 = {
            "lender_id": "lender_a",
            "weights": np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0], dtype=np.float32),
            "bias": 1.0,
            "num_samples": 100,
        }
        u2 = {
            "lender_id": "lender_b",
            "weights": np.array([2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0], dtype=np.float32),
            "bias": 2.0,
            "num_samples": 200,
        }
        u3 = {
            "lender_id": "lender_c",
            "weights": np.array([3.0, 6.0, 9.0, 12.0, 15.0, 18.0, 21.0, 24.0], dtype=np.float32),
            "bias": 3.0,
            "num_samples": 300,
        }

        # Total samples = 600.
        # Weights: (100/600)*[1,2,...] + (200/600)*[2,4,...] + (300/600)*[3,6,...]
        # index 0: (1/6)*1 + (2/6)*2 + (3/6)*3 = 1/6 + 4/6 + 9/6 = 14/6 = 2.3333333...
        # Bias: (1/6)*1 + (2/6)*2 + (3/6)*3 = 14/6 = 2.3333333...
        agg_w, agg_b = aggregate_weighted_fedavg([u1, u2, u3])
        expected_w0 = 14.0 / 6.0
        expected_bias = 14.0 / 6.0

        self.assertAlmostEqual(agg_w[0], expected_w0, places=5)
        self.assertAlmostEqual(agg_b, expected_bias, places=5)

    def test_officer_allowed_and_auditor_denied_on_update(self):
        """Verifies officer can submit local update while auditor gets 403 Forbidden."""
        update_payload = {
            "round_id": "ROUND-TEST-001",
            "lender_id": "lender_a",
            "weights": [0.1, -0.2, 0.3, -0.1, 0.05, -0.15, 0.2, -0.05],
            "bias": -0.5,
            "num_samples": 120,
            "steps": 10,
            "dp_enabled": True,
        }

        # Auditor must receive 403 Forbidden
        res_auditor = self.client.post(
            "/api/fl/update",
            json=update_payload,
            headers={"X-Session-Token": self.auditor_token},
        )
        self.assertEqual(res_auditor.status_code, 403)
        self.assertIn("Access denied", res_auditor.json()["detail"])

        # Officer must receive 200 OK
        res_officer = self.client.post(
            "/api/fl/update",
            json=update_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_officer.status_code, 200)
        data = res_officer.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["round_status"], "CANDIDATE")
        self.assertIsNotNone(data["candidate_version"])
        self.assertIsNotNone(data["metrics"])

    def test_update_with_nan_or_wrong_length_rejected(self):
        """Verifies that weights with NaN, infinite values, or wrong lengths are strictly rejected with 400/422."""
        # Wrong length (7 features instead of 8)
        bad_len_payload = {
            "round_id": "ROUND-TEST-LEN",
            "lender_id": "lender_a",
            "weights": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
            "bias": 0.0,
            "num_samples": 50,
            "steps": 5,
        }
        res_len = self.client.post(
            "/api/fl/update",
            json=bad_len_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_len.status_code, 400)

        # Exceeds max allowable norm bound
        bad_norm_payload = {
            "round_id": "ROUND-TEST-NORM",
            "lender_id": "lender_a",
            "weights": [40.0] * 8,  # norm = sqrt(8 * 1600) = 113.1 > 50.0
            "bias": 0.0,
            "num_samples": 50,
            "steps": 5,
        }
        res_norm = self.client.post(
            "/api/fl/update",
            json=bad_norm_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_norm.status_code, 400)
        self.assertIn("exceeds allowable bound", res_norm.json()["detail"])

        # String value in numeric array rejected with 422 Unprocessable Entity
        bad_str_payload = {
            "round_id": "ROUND-TEST-STR",
            "lender_id": "lender_a",
            "weights": [0.1, 0.2, "invalid_nan", 0.4, 0.5, 0.6, 0.7, 0.8],
            "bias": 0.0,
            "num_samples": 50,
            "steps": 5,
        }
        res_str = self.client.post(
            "/api/fl/update",
            json=bad_str_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_str.status_code, 422)

    def test_duplicate_update_in_same_round_returns_409(self):
        """Verifies duplicate submission by the same officer in the same round triggers 409 Conflict."""
        update_payload = {
            "round_id": "ROUND-TEST-DUP",
            "lender_id": "lender_a",
            "weights": [0.05] * 8,
            "bias": 0.01,
            "num_samples": 100,
            "steps": 8,
        }

        # First submission succeeds
        res1 = self.client.post(
            "/api/fl/update",
            json=update_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res1.status_code, 200)

        # Second submission in identical round must return 409 Conflict
        res2 = self.client.post(
            "/api/fl/update",
            json=update_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res2.status_code, 409)
        self.assertIn("Duplicate", res2.json()["detail"])

    def test_payload_contains_no_raw_csv_rows(self):
        """Ensures that the client update schema strictly accepts only weights/metadata and cannot accept raw data."""
        # Check allowed keys on schema
        from backend.app.schemas.credit import FLClientUpdateRequest
        allowed_fields = set(FLClientUpdateRequest.model_fields.keys())
        expected_fields = {"round_id", "lender_id", "weights", "bias", "num_samples", "steps", "dp_enabled", "epsilon", "delta"}
        self.assertEqual(allowed_fields, expected_fields)
        self.assertNotIn("raw_data", allowed_fields)
        self.assertNotIn("csv_rows", allowed_fields)
        self.assertNotIn("records", allowed_fields)


if __name__ == "__main__":
    unittest.main()
