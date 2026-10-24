"""
Tests for backend cold-start behavior, health check, and unauthenticated cases access.
Part C & Part D verification:
1. /api/health returns 200 JSON without touching DB or loading models into memory.
2. /api/cases without session returns JSON 401 (never HTML).
3. /api/cases with valid session returns JSON 200 list of cases.
4. An unhandled exception returns JSON 500 with CORS headers.
"""

import json
import base64
import unittest
from fastapi.testclient import TestClient
from backend.app.main import app, init_db


def create_mock_jwt(email: str, name: str = "Test User") -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "email": email,
        "name": name,
        "sub": f"google_{email}",
        "email_verified": True,
    }).encode()).decode().rstrip("=")
    return f"{header}.{payload}.sig"


class TestCasesAndHealthColdStart(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

        # Create active officer session
        res_officer = cls.client.post(
            "/api/auth/select-role",
            json={
                "id_token": create_mock_jwt("priya.sharma@lender-bank.com"),
                "requested_role": "bank_officer",
            },
        )
        assert res_officer.status_code == 200
        cls.officer_token = res_officer.json()["session_token"]
        cls.officer_headers = {"Authorization": f"Bearer {cls.officer_token}"}

    def test_health_returns_200_json(self):
        """GET /api/health must be public, fast, and return JSON 200."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response.headers.get("content-type", ""))
        data = response.json()
        self.assertTrue(data.get("ok"))
        self.assertEqual(data.get("service"), "fedcreditx-api")
        self.assertIn("fl_routes_loaded", data)
        self.assertIsInstance(data["fl_routes_loaded"], list)
        self.assertIn("/api/fl/config", data["fl_routes_loaded"])

    def test_cases_without_session_returns_401_json(self):
        """GET /api/cases without session must return JSON 401, never HTML."""
        response = self.client.get("/api/cases?lender_id=lender_a")
        self.assertEqual(response.status_code, 401)
        self.assertIn("application/json", response.headers.get("content-type", ""))
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("Authentication required", data["detail"])

    def test_cases_with_session_returns_200_json(self):
        """GET /api/cases with officer session returns JSON 200 list."""
        response = self.client.get("/api/cases?lender_id=lender_a", headers=self.officer_headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/json", response.headers.get("content-type", ""))
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        self.assertIn("case_id", data[0])
        self.assertIn("features", data[0])

    def test_unhandled_exception_returns_json_500_with_cors(self):
        """An unhandled error returns JSON 500 retaining CORS headers."""
        err_client = TestClient(app, raise_server_exceptions=False)
        response = err_client.get(
            "/api/test-error",
            headers={"Origin": "https://fedcreditx.onrender.com"},
        )
        self.assertEqual(response.status_code, 500)
        self.assertIn("application/json", response.headers.get("content-type", ""))
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "https://fedcreditx.onrender.com",
        )
        data = response.json()
        self.assertEqual(data.get("status"), "error")
        self.assertIn("Internal server error", data.get("detail", ""))


if __name__ == "__main__":
    unittest.main()
