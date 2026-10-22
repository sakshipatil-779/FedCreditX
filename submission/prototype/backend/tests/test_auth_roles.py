"""
Authentication & Role-Based Access Control Tests (Task 5).

Verifies the 5 server-side checkpoints:
1. Google ID token verification (or mock in test environment)
2. Role allowlist matching against AUDITOR_EMAILS / OFFICER_EMAILS
3. Unapproved role returns HTTP 403
4. Server-side session storage and role enforcement (Audit Logs, Holdout Benchmark)
5. Audit event logging on every sign-in / role selection (GRANTED / DENIED)
"""

import unittest
import json
import base64
import os
import sqlite3
from fastapi.testclient import TestClient

from backend.app.main import app, DB_PATH, init_db


def create_mock_jwt(email: str, name: str = "Test User") -> str:
    """Creates an unsigned mock Google/Firebase ID token with payload for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "email": email,
        "name": name,
        "sub": f"google_{email}",
        "email_verified": True,
    }).encode()).decode().rstrip("=")
    return f"{header}.{payload}.signature"


class TestAuthRoles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_officer_allowed_as_officer(self):
        """Standard authenticated Google user can select Bank Underwriting Officer role."""
        token = create_mock_jwt("officer_jane@example.com", "Jane Doe")
        response = self.client.post("/api/auth/select-role", json={
            "id_token": token,
            "requested_role": "bank_officer",
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["email"], "officer_jane@example.com")
        self.assertEqual(data["role"], "bank_officer")
        self.assertTrue(data["session_token"].startswith("sess_"))

        # Verify audit trail recorded GRANTED
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT event_type, status, safe_metadata_json FROM audit_events WHERE event_type='AUTH_ROLE_GRANTED' ORDER BY timestamp DESC LIMIT 1")
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[1], "GRANTED")
        meta = json.loads(row[2])
        self.assertEqual(meta["email"], "officer_jane@example.com")
        self.assertEqual(meta["granted_role"], "bank_officer")

    def test_unapproved_officer_denied_as_auditor(self):
        """Non-allowlisted Google user requesting Auditor receives HTTP 403 and denial audit event."""
        token = create_mock_jwt("regular_user@example.com", "Regular User")
        response = self.client.post("/api/auth/select-role", json={
            "id_token": token,
            "requested_role": "risk_auditor",
        })
        self.assertEqual(response.status_code, 403)
        data = response.json()
        self.assertIn("Your account is not approved as Auditor. Contact the administrator.", data["detail"])

        # Verify audit trail recorded DENIED
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT event_type, status, safe_metadata_json FROM audit_events WHERE event_type='AUTH_ROLE_DENIED' ORDER BY timestamp DESC LIMIT 1")
        row = cur.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row[1], "DENIED")
        meta = json.loads(row[2])
        self.assertEqual(meta["email"], "regular_user@example.com")
        self.assertEqual(meta["status"], "DENIED")

    def test_approved_auditor_allowed_as_auditor(self):
        """Approved auditor email is successfully granted Auditor role and session token."""
        # Use default approved auditor email
        auditor_email = "auditor@fedcreditx.org"
        token = create_mock_jwt(auditor_email, "Audit Lead")
        response = self.client.post("/api/auth/select-role", json={
            "id_token": token,
            "requested_role": "risk_auditor",
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["email"], auditor_email)
        self.assertEqual(data["role"], "risk_auditor")
        self.assertTrue(data["session_token"].startswith("sess_"))

    def test_missing_or_invalid_role_rejected(self):
        """Missing or invalid role string returns HTTP 400."""
        token = create_mock_jwt("user@example.com")
        # Missing role
        res1 = self.client.post("/api/auth/select-role", json={
            "id_token": token,
            "requested_role": "",
        })
        self.assertEqual(res1.status_code, 400)

        # Invalid role
        res2 = self.client.post("/api/auth/select-role", json={
            "id_token": token,
            "requested_role": "super_admin_hacker",
        })
        self.assertEqual(res2.status_code, 400)

    def test_server_side_role_enforcement_on_protected_endpoints(self):
        """
        Server checks session token stored in SQLite:
        - Auditor session can access /api/audit and /api/metrics
        - Officer session receives 403 on /api/audit and /api/metrics
        """
        # 1. Obtain Officer session
        officer_token = create_mock_jwt("officer_steve@example.com")
        officer_res = self.client.post("/api/auth/select-role", json={
            "id_token": officer_token,
            "requested_role": "bank_officer",
        }).json()
        officer_session = officer_res["session_token"]

        # 2. Obtain Auditor session
        auditor_token = create_mock_jwt("auditor@fedcreditx.org")
        auditor_res = self.client.post("/api/auth/select-role", json={
            "id_token": auditor_token,
            "requested_role": "risk_auditor",
        }).json()
        auditor_session = auditor_res["session_token"]

        # 3. Officer attempts to access Audit Logs -> 403 Forbidden
        bad_audit = self.client.get("/api/audit", headers={"Authorization": f"Bearer {officer_session}"})
        self.assertEqual(bad_audit.status_code, 403)

        # 4. Officer attempts to access Holdout Benchmark -> 403 Forbidden
        bad_metrics = self.client.get("/api/metrics", headers={"Authorization": f"Bearer {officer_session}"})
        self.assertEqual(bad_metrics.status_code, 403)

        # 5. Auditor accesses Audit Logs -> 200 OK
        good_audit = self.client.get("/api/audit", headers={"Authorization": f"Bearer {auditor_session}"})
        self.assertEqual(good_audit.status_code, 200)

        # 6. Auditor accesses Holdout Benchmark -> 200 OK
        good_metrics = self.client.get("/api/metrics", headers={"Authorization": f"Bearer {auditor_session}"})
        self.assertEqual(good_metrics.status_code, 200)


if __name__ == "__main__":
    unittest.main()
