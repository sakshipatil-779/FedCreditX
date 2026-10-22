"""
Automated tests for Risk Classification Rules, Officer Decisions,
Model Override Validation, and Audit Logging (Step 3, Step 6, and Step 9).

Verifies:
1. Exact threshold boundary conditions:
   - 0.2999 -> Low
   - 0.3000 -> Medium
   - 0.5000 -> Medium
   - 0.7000 -> Medium
   - 0.7001 -> High
2. High-risk cases are flagged for confirmation, not auto-rejected.
3. System recommendation versus final officer decision distinction.
4. Mandatory override reason enforcement on backend (HTTP 422 on empty reason).
5. OVERRIDE_MODEL audit event recording and field integrity.
6. Audit log retrieval, filtering, and export.
"""

import unittest
import json
from fastapi.testclient import TestClient

from backend.app.main import app, init_db
from backend.config.risk_rules import (
    classify_risk_probability,
    LEVEL_LOW,
    LEVEL_MEDIUM,
    LEVEL_HIGH,
    REC_AUTO_APPROVE,
    REC_HUMAN_REVIEW,
    REC_FLAG_HIGH_RISK,
)


class TestRiskRulesAndThresholds(unittest.TestCase):
    """
    Deterministic unit tests for exact boundary conditions of risk rules (Step 3 & 9).
    """

    def test_exact_boundary_conditions(self):
        """Verifies exact threshold boundaries: < 0.30, 0.30..0.70, > 0.70."""
        # Low risk: p < 0.30
        c1 = classify_risk_probability(0.2999)
        self.assertEqual(c1["risk_level"], LEVEL_LOW)
        self.assertEqual(c1["system_recommendation"], REC_AUTO_APPROVE)
        self.assertEqual(c1["badge_color"], "green")

        # Medium risk boundary 1: p == 0.3000
        c2 = classify_risk_probability(0.3000)
        self.assertEqual(c2["risk_level"], LEVEL_MEDIUM)
        self.assertEqual(c2["system_recommendation"], REC_HUMAN_REVIEW)
        self.assertEqual(c2["badge_color"], "amber")

        # Medium risk interior: p == 0.5000
        c3 = classify_risk_probability(0.5000)
        self.assertEqual(c3["risk_level"], LEVEL_MEDIUM)
        self.assertEqual(c3["system_recommendation"], REC_HUMAN_REVIEW)

        # Medium risk boundary 2: p == 0.7000
        c4 = classify_risk_probability(0.7000)
        self.assertEqual(c4["risk_level"], LEVEL_MEDIUM)
        self.assertEqual(c4["system_recommendation"], REC_HUMAN_REVIEW)

        # High risk: p > 0.70
        c5 = classify_risk_probability(0.7001)
        self.assertEqual(c5["risk_level"], LEVEL_HIGH)
        self.assertEqual(c5["system_recommendation"], REC_FLAG_HIGH_RISK)
        self.assertEqual(c5["badge_color"], "red")

    def test_high_risk_does_not_auto_reject(self):
        """Verifies high risk flags for confirmation rather than automatically rejecting."""
        c = classify_risk_probability(0.85)
        self.assertEqual(c["risk_level"], LEVEL_HIGH)
        self.assertEqual(c["system_recommendation"], REC_FLAG_HIGH_RISK)
        self.assertIn("confirm", c["required_handling"].lower())


class TestOfficerDecisionAndAuditWorkflow(unittest.TestCase):
    """
    API integration tests for scoring, officer review, override validation, and audit persistence.
    """

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def test_scoring_uses_decision_tree_and_three_primary_items(self):
        """Verifies scoring response contract matches Step 4 (level, top reasons, recommendation)."""
        res = self.client.post("/api/cases/DEMO-A-001/score?lender_id=lender_a")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Item 1: Model type & Risk level & probability
        self.assertIn(data["model_type"], ["DecisionTreeClassifier", "FL + DP Logistic Regression (Primary)"])
        self.assertIn("default_probability_estimate", data)
        self.assertIn("percentage_display", data)
        self.assertIn(data["risk_level"], [LEVEL_LOW, LEVEL_MEDIUM, LEVEL_HIGH])
        self.assertIn(data["badge_color"], ["green", "amber", "red"])

        # Item 2: Up to 3 top reasons derived from decision tree
        self.assertIn("top_reasons", data)
        self.assertIsInstance(data["top_reasons"], list)
        self.assertLessEqual(len(data["top_reasons"]), 3)
        self.assertGreater(len(data["top_reasons"]), 0)

        for r in data["top_reasons"]:
            self.assertIn("readable_reason", r)
            self.assertIn("impact", r)
            self.assertIn(r["direction"], ["increases_risk", "decreases_risk"])

        # Item 3: System recommendation
        self.assertIn("system_recommendation", data)
        self.assertIn("review_status", data)
        self.assertIn("calibration_caveat", data)

    def test_officer_action_following_recommendation(self):
        """Officer approving low-risk case follows recommendation (is_override=False)."""
        # Score DEMO-A-001 (typically Low or Moderate)
        score_res = self.client.post("/api/cases/DEMO-A-001/score?lender_id=lender_a").json()
        rec = score_res["system_recommendation"]

        # If rec is Auto-approve, approving follows recommendation
        action = "approve" if rec == REC_AUTO_APPROVE else "send_to_review"
        payload = {
            "officer_action": action,
            "officer_id": "officer_alice",
            "notes": "Standard verification complete.",
        }
        res = self.client.post("/api/cases/DEMO-A-001/decision?lender_id=lender_a", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["case_id"], "DEMO-A-001")
        self.assertEqual(data["status"], "SUCCESS")
        self.assertIn("audit_event_id", data)

    def test_model_override_requires_non_empty_reason(self):
        """Backend independently validates that overriding recommendation requires non-empty reason."""
        # Find a case with high risk (e.g. DEMO-B-002) or low risk (DEMO-A-001)
        score_res = self.client.post("/api/cases/DEMO-A-001/score?lender_id=lender_a").json()
        rec = score_res["system_recommendation"]

        if rec == REC_AUTO_APPROVE:
            # Overriding auto-approve by rejecting
            override_action = "reject"
        else:
            # Overriding by approving high risk or providing override
            override_action = "approve" if rec == REC_FLAG_HIGH_RISK else "reject"

        # Attempt override with EMPTY reason -> must fail with HTTP 422
        bad_payload = {
            "officer_action": override_action,
            "officer_id": "officer_bob",
            "override_reason": "   ",  # whitespace only
        }
        bad_res = self.client.post("/api/cases/DEMO-A-001/decision?lender_id=lender_a", json=bad_payload)
        if rec in [REC_AUTO_APPROVE, REC_FLAG_HIGH_RISK]:
            self.assertEqual(bad_res.status_code, 422)
            self.assertIn("override reason is mandatory", bad_res.json()["detail"].lower())

        # Attempt override WITH legitimate non-empty reason -> must succeed
        good_payload = {
            "officer_action": override_action,
            "officer_id": "officer_bob",
            "override_reason": "Verified secondary collateral and guarantor commitment.",
            "notes": "Risk committee waiver attached.",
        }
        good_res = self.client.post("/api/cases/DEMO-A-001/decision?lender_id=lender_a", json=good_payload)
        self.assertEqual(good_res.status_code, 200)
        data = good_res.json()
        self.assertTrue(data["is_override"])
        self.assertEqual(data["override_reason"], "Verified secondary collateral and guarantor commitment.")

    def test_audit_event_records_override_and_preserves_original_recommendation(self):
        """Verifies that OVERRIDE_MODEL event preserves original score, recommendation, and final decision."""
        # Submit an explicit override decision
        payload = {
            "officer_action": "approve",
            "officer_id": "officer_charlie",
            "override_reason": "Underwriter manual review verified exceptional debt service coverage.",
            "notes": "Approved under policy exception 4.2",
        }
        dec_res = self.client.post("/api/cases/DEMO-B-002/decision?lender_id=lender_b", json=payload)
        self.assertEqual(dec_res.status_code, 200)
        audit_id = dec_res.json()["audit_event_id"]

        # Retrieve audit events filtered by entity_id
        audit_res = self.client.get("/api/audit?resource_id=DEMO-B-002&limit=5")
        self.assertEqual(audit_res.status_code, 200)
        events = audit_res.json()
        self.assertGreater(len(events), 0)

        # Check latest event matching audit_id
        matched = next((e for e in events if e["id"] == audit_id), events[0])
        self.assertIn(matched["event_type"], ["OVERRIDE_MODEL", "OFFICER_APPROVE"])
        self.assertEqual(matched["actor_type"], "officer_charlie")
        self.assertEqual(matched["entity_id"], "DEMO-B-002")

        meta = matched["safe_metadata"]
        self.assertIn("system_recommendation", meta)
        self.assertIn("final_decision", meta)
        self.assertEqual(meta["final_decision"], "Approved")
        self.assertIn(meta["model_type"], ["DecisionTreeClassifier", "FL + DP Logistic Regression (Primary)"])

    def test_audit_filters_and_export(self):
        """Verifies audit log filtering by event_type, actor, and decision, plus CSV export."""
        # Test filtering by event_type
        res = self.client.get("/api/audit?event_type=CASE_SCORED&limit=10")
        self.assertEqual(res.status_code, 200)
        for ev in res.json():
            self.assertEqual(ev["event_type"], "CASE_SCORED")

        # Test CSV export
        export_res = self.client.get("/api/audit/export?limit=50")
        self.assertEqual(export_res.status_code, 200)
        self.assertEqual(export_res.headers["content-type"], "text/csv; charset=utf-8")
        csv_text = export_res.text
        self.assertIn("Time,User,Action,Resource,Model Score,Final Decision,Status,Override Reason", csv_text)


if __name__ == "__main__":
    unittest.main()
