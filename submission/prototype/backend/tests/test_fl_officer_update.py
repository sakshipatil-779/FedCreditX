import json
import base64
import unittest
import sqlite3
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app, init_db, DB_PATH
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
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM fl_round_submissions")
        cur.execute("DELETE FROM fl_round_state WHERE round_id != 'ROUND-001'")
        cur.execute("UPDATE fl_round_state SET status = 'OPEN', global_version = '1.0.0-fl-dp', created_at = datetime('now') WHERE round_id = 'ROUND-001'")
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
        self.officer_cookie = res_officer.cookies.get("session_token")

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

        agg_w, agg_b = aggregate_weighted_fedavg([u1, u2, u3])
        expected_w0 = 14.0 / 6.0
        expected_bias = 14.0 / 6.0

        self.assertAlmostEqual(agg_w[0], expected_w0, places=5)
        self.assertAlmostEqual(agg_b, expected_bias, places=5)

    def test_officer_allowed_and_auditor_denied_on_update(self):
        """Verifies officer can submit local update while auditor gets 403 and anonymous gets 401."""
        valid_payload = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [0.01, -0.02, 0.03, -0.01, 0.02, -0.01, 0.02, -0.01],
            "bias": -0.05,
            "num_samples": 120,
            "steps": 10,
        }

        # Anonymous caller gets 401 Unauthorized
        res_anon = self.client.post("/api/fl/update", json=valid_payload)
        self.assertEqual(res_anon.status_code, 401)

        # Auditor receives 403 Forbidden
        res_auditor = self.client.post(
            "/api/fl/update",
            json=valid_payload,
            headers={"X-Session-Token": self.auditor_token},
        )
        self.assertEqual(res_auditor.status_code, 403)
        self.assertIn("Access denied", res_auditor.json()["detail"])

        # Officer receives 200 OK
        res_officer = self.client.post(
            "/api/fl/update",
            json=valid_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_officer.status_code, 200)
        data = res_officer.json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["round_status"], "CANDIDATE")
        self.assertIsNotNone(data["candidate_version"])
        self.assertIsNotNone(data["metrics"])

    def test_update_validation_rejections_return_400(self):
        """Verifies that wrong weight length, NaN values, out-of-bound sample counts, and unknown keys return 400."""
        # 1. Unknown extra keys return 400
        extra_key_payload = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [0.01] * 8,
            "bias": 0.0,
            "num_samples": 100,
            "steps": 5,
            "unauthorized_key": "malicious_payload",
        }
        res_extra = self.client.post(
            "/api/fl/update",
            json=extra_key_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_extra.status_code, 400)

        # 2. Wrong weights length (7 instead of 8) returns 400
        bad_len_payload = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [0.01] * 7,
            "bias": 0.0,
            "num_samples": 100,
            "steps": 5,
        }
        res_len = self.client.post(
            "/api/fl/update",
            json=bad_len_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_len.status_code, 400)

        # 3. NaN in weights returns 400 (sent as raw JSON content)
        nan_raw_body = (
            '{"round_id":"ROUND-001","lender_id":"lender_a",'
            '"weights":[0.01, NaN, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07],'
            '"bias":0.0,"num_samples":100,"steps":5}'
        )
        res_nan = self.client.post(
            "/api/fl/update",
            content=nan_raw_body,
            headers={"Content-Type": "application/json", "X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_nan.status_code, 400)

        # 4. num_samples < 50 returns 400
        too_few_samples = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [0.01] * 8,
            "bias": 0.0,
            "num_samples": 10,
            "steps": 5,
        }
        res_few = self.client.post(
            "/api/fl/update",
            json=too_few_samples,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_few.status_code, 400)

        # 5. L2 update norm exceeding MAX_UPDATE_NORM returns 400
        huge_norm_payload = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [20.0] * 8,  # norm = sqrt(8 * 400) = 56.5 > 15.0
            "bias": 0.0,
            "num_samples": 100,
            "steps": 5,
        }
        res_norm = self.client.post(
            "/api/fl/update",
            json=huge_norm_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_norm.status_code, 400)

    def test_duplicate_update_in_same_round_returns_409(self):
        """Verifies duplicate submission by the same officer in the same round triggers 409 Conflict."""
        update_payload = {
            "round_id": "ROUND-001",
            "lender_id": "lender_a",
            "weights": [0.01] * 8,
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

    def test_config_and_rounds_rbac(self):
        """Verifies /api/fl/config and /api/fl/rounds return 200 for officer & auditor, and 401 for anonymous."""
        # /api/fl/config
        self.assertEqual(self.client.get("/api/fl/config").status_code, 401)
        res_cfg_off = self.client.get("/api/fl/config", headers={"X-Session-Token": self.officer_token})
        self.assertEqual(res_cfg_off.status_code, 200)
        self.assertIn("preprocessor", res_cfg_off.json())
        self.assertIn("round_id", res_cfg_off.json())
        res_cfg_aud = self.client.get("/api/fl/config", headers={"X-Session-Token": self.auditor_token})
        self.assertEqual(res_cfg_aud.status_code, 200)

        # /api/fl/rounds
        self.assertEqual(self.client.get("/api/fl/rounds").status_code, 401)
        res_rnd_off = self.client.get("/api/fl/rounds", headers={"X-Session-Token": self.officer_token})
        self.assertEqual(res_rnd_off.status_code, 200)
        self.assertIn("status", res_rnd_off.json())
        self.assertIn("participants", res_rnd_off.json())
        res_rnd_aud = self.client.get("/api/fl/rounds", headers={"X-Session-Token": self.auditor_token})
        self.assertEqual(res_rnd_aud.status_code, 200)

    def test_sample_partner_rbac_and_isolation(self):
        """Verifies /api/fl/sample-partner returns 200 text/csv for officer, 403 for auditor, 401 for anonymous."""
        # Anonymous gets 401
        self.assertEqual(self.client.get("/api/fl/sample-partner").status_code, 401)

        # Auditor gets 403
        res_aud = self.client.get("/api/fl/sample-partner", headers={"X-Session-Token": self.auditor_token})
        self.assertEqual(res_aud.status_code, 403)

        # Officer gets 200 with text/csv
        res_off = self.client.get("/api/fl/sample-partner", headers={"X-Session-Token": self.officer_token})
        self.assertEqual(res_off.status_code, 200)
        self.assertIn("text/csv", res_off.headers.get("content-type", ""))
        content = res_off.text
        self.assertIn("monthly_income_band_value", content)
        self.assertIn("defaulted", content)

    def test_metrics_role_query_param_does_not_change_authorization(self):
        """Verifies that /api/metrics ignores any role query param; access is strictly server-session governed."""
        # Anonymous + ?role=bank_officer must return 401 (not 403 or 200)
        res_anon = self.client.get("/api/metrics?role=bank_officer")
        self.assertEqual(res_anon.status_code, 401)

        # Officer session + ?role=risk_auditor must still return 403
        res_off = self.client.get("/api/metrics?role=risk_auditor", headers={"X-Session-Token": self.officer_token})
        self.assertEqual(res_off.status_code, 403)

        # Auditor session + ?role=bank_officer must still return 200 (query ignored)
        res_aud = self.client.get("/api/metrics?role=bank_officer", headers={"X-Session-Token": self.auditor_token})
        self.assertEqual(res_aud.status_code, 200)

    def test_error_route_retains_cors_headers(self):
        """Verifies an unhandled 500 error returns JSON 500 with access-control-allow-origin header."""
        err_client = TestClient(app, raise_server_exceptions=False)
        response = err_client.get("/api/test-error", headers={"Origin": "https://fedcreditx.onrender.com"})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "https://fedcreditx.onrender.com")
        self.assertEqual(response.json()["status"], "error")

    def test_session_cookie_attributes(self):
        """Verifies session_token cookie has HttpOnly, Secure, SameSite=Lax, Path=/."""
        response = self.client.post(
            "/api/auth/select-role",
            json={
                "id_token": create_mock_jwt("priya.sharma@lender-bank.com"),
                "requested_role": "bank_officer",
            },
        )
        self.assertEqual(response.status_code, 200)
        set_cookie = response.headers.get("set-cookie", "").lower()
        self.assertIn("session_token=", set_cookie)
        self.assertIn("httponly", set_cookie)
        self.assertIn("samesite=lax", set_cookie)
        self.assertIn("secure", set_cookie)

    def test_round_aggregates_only_after_three_updates(self):
        """Verifies that aggregation occurs and status transitions to CANDIDATE once 3 accepted updates exist."""
        # 1. Start fresh round
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM fl_round_submissions WHERE round_id = 'ROUND-TEST-AGG'")
        cur.execute("INSERT OR REPLACE INTO fl_round_state VALUES ('ROUND-TEST-AGG', 'OPEN', '1.0.0-fl-dp', datetime('now'), NULL)")
        conn.commit()

        # Insert 1 update directly into DB without simulated partners
        sub_id = "SUB-TEST-1"
        cur.execute(
            """
            INSERT INTO fl_round_submissions (id, round_id, actor_email, lender_id, weights_json, bias, num_samples, steps, is_simulated, timestamp)
            VALUES (?, 'ROUND-TEST-AGG', 'officer1@bank.com', 'lender_a', ?, 0.0, 100, 5, 0, datetime('now'))
            """,
            (sub_id, json.dumps([0.01] * 8)),
        )
        conn.commit()

        # Query round status via /api/fl/rounds: should be OPEN because total updates < 3
        cur.execute("SELECT status FROM fl_round_state WHERE round_id = 'ROUND-TEST-AGG'")
        status_before = cur.fetchone()[0]
        self.assertEqual(status_before, "OPEN")

        # Insert 2nd update
        cur.execute(
            """
            INSERT INTO fl_round_submissions (id, round_id, actor_email, lender_id, weights_json, bias, num_samples, steps, is_simulated, timestamp)
            VALUES ('SUB-TEST-2', 'ROUND-TEST-AGG', 'sim_b@bank.com', 'lender_b', ?, 0.0, 100, 5, 1, datetime('now'))
            """,
            (json.dumps([0.02] * 8),),
        )
        conn.commit()

        # Still < 3
        cur.execute("SELECT COUNT(*) FROM fl_round_submissions WHERE round_id = 'ROUND-TEST-AGG'")
        self.assertEqual(cur.fetchone()[0], 2)
        cur.execute("SELECT status FROM fl_round_state WHERE round_id = 'ROUND-TEST-AGG'")
        self.assertEqual(cur.fetchone()[0], "OPEN")

        # Now when 3rd update is submitted via submit_fl_client_update
        # Update round_state so ROUND-TEST-AGG is active round
        cur.execute("UPDATE fl_round_state SET created_at = datetime('now', '+1 hour') WHERE round_id = 'ROUND-TEST-AGG'")
        conn.commit()
        conn.close()

        update_payload = {
            "round_id": "ROUND-TEST-AGG",
            "lender_id": "lender_c",
            "weights": [0.01] * 8,
            "bias": 0.0,
            "num_samples": 100,
            "steps": 5,
        }
        res_third = self.client.post(
            "/api/fl/update",
            json=update_payload,
            headers={"X-Session-Token": self.officer_token},
        )
        self.assertEqual(res_third.status_code, 200)
        self.assertEqual(res_third.json()["round_status"], "CANDIDATE")


if __name__ == "__main__":
    unittest.main()
