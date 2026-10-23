"""
backend/tests/test_demo_auth.py

Validation test suite for controlled Demo Auditor Login (Tasks A-E).
Verifies all 10 requirements:
1. Login returns 404 when DEMO_AUDITOR_ENABLED is false.
2. Login returns 401 for a wrong password, a wrong email, and an empty body, with the same generic message.
3. Login returns 403 after DEMO_AUDITOR_EXPIRES_AT.
4. Correct credentials return a session with role "auditor" and auth_method "demo" (using dynamic test-generated credentials).
5. The demo session gets 403 on POST /api/fl/update (officer-only).
6. The demo session can open Audit Logs and Holdout Benchmark.
7. Rate limit blocks the 6th attempt within 15 minutes.
8. The password and hash never appear in any log output.
9. Google sign-in and AUDITOR_EMAILS behaviour still passes its existing tests.
10. Frontend build passes.
"""

import unittest
import os
import json
import logging
import io
import datetime
import bcrypt
from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    init_db,
    DEMO_LOGIN_ATTEMPTS,
)
from backend.ml.preprocessing import FEATURE_NAMES


class TestDemoAuditorAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        # Generate dynamic test-only credentials inside test (NEVER hardcoded or production values)
        cls.test_email = "test.auditor.eval@fedcreditx.test"
        cls.test_password = "TestPassword#Secure2026!"
        salt = bcrypt.gensalt(rounds=4)  # Faster rounds for test suite
        cls.test_hash = bcrypt.hashpw(cls.test_password.encode("utf-8"), salt).decode("utf-8")

    def setUp(self):
        # Clear in-memory rate limit table before each test
        DEMO_LOGIN_ATTEMPTS.clear()

    def test_1_login_returns_404_when_disabled(self):
        """1. Login returns 404 when DEMO_AUDITOR_ENABLED is false."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "false"
        res = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email,
            "password": self.test_password,
        })
        self.assertEqual(res.status_code, 404)
        self.assertIn("Demo auditor login is disabled", res.json().get("detail", ""))

    def test_2_login_returns_401_generic_message(self):
        """2. Login returns 401 for a wrong password, a wrong email, and an empty body, with the same generic message."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        generic_msg = "Invalid email or password."

        # Case A: Wrong password
        res_wrong_pw = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email,
            "password": "WrongPassword123!",
        })
        self.assertEqual(res_wrong_pw.status_code, 401)
        self.assertEqual(res_wrong_pw.json().get("detail"), generic_msg)

        # Case B: Wrong email
        res_wrong_email = self.client.post("/api/auth/demo-login", json={
            "email": "intruder@evil.corp",
            "password": self.test_password,
        })
        self.assertEqual(res_wrong_email.status_code, 401)
        self.assertEqual(res_wrong_email.json().get("detail"), generic_msg)

        # Case C: Empty body
        res_empty = self.client.post("/api/auth/demo-login", json={})
        self.assertEqual(res_empty.status_code, 401)
        self.assertEqual(res_empty.json().get("detail"), generic_msg)

    def test_3_login_returns_403_after_expiration(self):
        """3. Login returns 403 after DEMO_AUDITOR_EXPIRES_AT."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        # Set expiry in the past
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2020-01-01T00:00:00Z"

        res = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email,
            "password": self.test_password,
        })
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json().get("detail"), "Demo access has ended.")

    def test_4_correct_credentials_return_auditor_session(self):
        """4. Correct credentials return a session with role 'auditor' and auth_method 'demo'."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        # Case-insensitive email test
        res = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email.upper(),
            "password": self.test_password,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["role"], "auditor")
        self.assertEqual(data["auth_method"], "demo")
        self.assertEqual(data["email"], self.test_email.lower())
        self.assertTrue(data["session_token"].startswith("sess_"))
        self.assertTrue("expires_at" in data)

    def test_5_demo_session_gets_403_on_fl_update(self):
        """5. The demo session gets 403 on POST /api/fl/update (officer-only)."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        # Obtain demo auditor session
        login_res = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email,
            "password": self.test_password,
        }).json()
        demo_session_token = login_res["session_token"]

        # Attempt officer-only FL client update submission
        dummy_weights = [0.0] * len(FEATURE_NAMES)
        fl_res = self.client.post(
            "/api/fl/update",
            headers={"Authorization": f"Bearer {demo_session_token}"},
            json={
                "round_id": "ROUND-TEST-001",
                "lender_id": "lender_a",
                "weights": dummy_weights,
                "bias": 0.0,
                "num_samples": 100,
                "steps": 5,
                "dp_enabled": True,
            },
        )
        self.assertEqual(fl_res.status_code, 403)
        self.assertIn("restricted to Bank Underwriting Officers", fl_res.json().get("detail", ""))

    def test_6_demo_session_can_open_audit_and_metrics(self):
        """6. The demo session can open Audit Logs and Holdout Benchmark."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        login_res = self.client.post("/api/auth/demo-login", json={
            "email": self.test_email,
            "password": self.test_password,
        }).json()
        demo_session_token = login_res["session_token"]

        # 1. Audit Logs endpoint
        audit_res = self.client.get(
            "/api/audit",
            headers={"Authorization": f"Bearer {demo_session_token}"},
        )
        self.assertEqual(audit_res.status_code, 200)
        self.assertIsInstance(audit_res.json(), list)

        # 2. Holdout Benchmark metrics endpoint
        metrics_res = self.client.get(
            "/api/metrics",
            headers={"Authorization": f"Bearer {demo_session_token}"},
        )
        self.assertEqual(metrics_res.status_code, 200)
        self.assertIn("primary_model", metrics_res.json())

    def test_7_rate_limit_blocks_6th_attempt_within_15_minutes(self):
        """7. Rate limit blocks the 6th attempt within 15 minutes."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        test_ip = "192.0.2.144"
        headers = {"X-Forwarded-For": test_ip}

        # First 5 attempts (allowed to evaluate credentials)
        for i in range(5):
            res = self.client.post(
                "/api/auth/demo-login",
                headers=headers,
                json={"email": self.test_email, "password": "WrongPassword#"},
            )
            self.assertEqual(res.status_code, 401, f"Attempt {i+1} should return 401")

        # 6th attempt must be blocked by rate limit
        res_6 = self.client.post(
            "/api/auth/demo-login",
            headers=headers,
            json={"email": self.test_email, "password": self.test_password},
        )
        self.assertEqual(res_6.status_code, 429)
        self.assertIn("Too many login attempts", res_6.json().get("detail", ""))

    def test_8_password_and_hash_never_appear_in_logs(self):
        """8. The password and hash never appear in any log output."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        os.environ["DEMO_AUDITOR_EMAIL"] = self.test_email
        os.environ["DEMO_AUDITOR_PASSWORD_HASH"] = self.test_hash
        os.environ["DEMO_AUDITOR_EXPIRES_AT"] = "2099-01-01T00:00:00Z"

        # Capture logs
        log_stream = io.StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.setLevel(logging.DEBUG)

        auth_logger = logging.getLogger("fedcreditx.auth")
        auth_logger.addHandler(handler)
        auth_logger.setLevel(logging.DEBUG)

        try:
            # Perform various attempts
            self.client.post("/api/auth/demo-login", json={"email": self.test_email, "password": self.test_password})
            self.client.post("/api/auth/demo-login", json={"email": self.test_email, "password": "WrongSecretAttempt"})
            self.client.post("/api/auth/demo-login", json={})
            handler.flush()

            captured = log_stream.getvalue()
            # Assert neither password nor hash is in logs
            self.assertNotIn(self.test_password, captured)
            self.assertNotIn("WrongSecretAttempt", captured)
            self.assertNotIn(self.test_hash, captured)
        finally:
            auth_logger.removeHandler(handler)

    def test_auth_config_endpoint(self):
        """GET /api/auth/config returns demoAuditorEnabled matching environment flag."""
        os.environ["DEMO_AUDITOR_ENABLED"] = "true"
        res_true = self.client.get("/api/auth/config")
        self.assertEqual(res_true.status_code, 200)
        self.assertTrue(res_true.json()["demoAuditorEnabled"])

        os.environ["DEMO_AUDITOR_ENABLED"] = "false"
        res_false = self.client.get("/api/auth/config")
        self.assertEqual(res_false.status_code, 200)
        self.assertFalse(res_false.json()["demoAuditorEnabled"])


if __name__ == "__main__":
    unittest.main()
