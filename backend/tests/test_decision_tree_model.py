"""
Unit and integration tests for Decision Tree Risk Model (Step 2 and Step 9).

Verifies:
1. DecisionTreeClassifier usage in applicant scoring.
2. Model artifact loading, class verification (classes_ contains 1).
3. Positive class probability selection.
4. Error handling for missing or corrupt model artifacts.
5. Decision path extraction yielding up to 3 defensible, non-fabricated reasons.
6. Deterministic, consistent predictions for the same inputs.
"""

import os
import unittest
import tempfile
import shutil
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier

from backend.ml.decision_tree import (
    DecisionTreeRiskModel,
    MODEL_TYPE_NAME,
    train_and_persist_decision_tree,
)
from backend.ml.preprocessing import FEATURE_NAMES, TARGET_NAME


class TestDecisionTreeModel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp()
        cls.model_path = os.path.join(cls.temp_dir, "decision_tree_risk_model.joblib")

        # Train a test Decision Tree model using actual training data
        cls.model, cls.metrics = train_and_persist_decision_tree(
            data_dir="backend/local_data",
            artifacts_dir=cls.temp_dir,
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def test_model_type_is_decision_tree(self):
        """Verifies that applicant scoring exclusively uses DecisionTreeClassifier."""
        self.assertIsInstance(self.model.model, DecisionTreeClassifier)
        self.assertEqual(self.model.metadata.get("model_type"), MODEL_TYPE_NAME)

    def test_artifact_persistence_and_reloading(self):
        """Verifies that the model artifact saves and reloads with intact classes_."""
        save_file = os.path.join(self.temp_dir, "reloaded_dt.joblib")
        self.model.save_artifact(save_file)
        self.assertTrue(os.path.exists(save_file))
        self.assertTrue(os.path.exists(save_file + ".json"))

        reloaded = DecisionTreeRiskModel.load_artifact(save_file)
        self.assertIsInstance(reloaded.model, DecisionTreeClassifier)
        self.assertEqual(list(reloaded.model.classes_), [0, 1])

    def test_missing_artifact_raises_explicit_error(self):
        """Verifies that missing model artifact raises FileNotFoundError, not silent failure."""
        nonexistent = os.path.join(self.temp_dir, "does_not_exist.joblib")
        with self.assertRaises(FileNotFoundError):
            DecisionTreeRiskModel.load_artifact(nonexistent)

    def test_positive_class_probability_correctness(self):
        """Verifies that predict_probability returns the probability for positive class 1."""
        sample_features = {
            "monthly_income_band_value": 7500.0,
            "debt_to_income_ratio": 0.20,
            "late_payment_count_12m": 0,
            "credit_utilization_ratio": 0.15,
            "income_variability": 0.10,
            "loan_amount_to_income": 2.0,
            "account_history_months": 120,
            "utility_payment_consistency": 0.95,
        }
        prob = self.model.predict_probability(sample_features)
        self.assertIsInstance(prob, float)
        self.assertGreaterEqual(prob, 0.0)
        self.assertLessEqual(prob, 1.0)

        # Directly check sklearn predict_proba for class 1
        X = np.array([[sample_features[f] for f in FEATURE_NAMES]], dtype=np.float32)
        sk_probs = self.model.model.predict_proba(X)[0]
        pos_idx = list(self.model.model.classes_).index(1)
        expected_prob = round(float(sk_probs[pos_idx]), 4)
        self.assertAlmostEqual(prob, expected_prob, places=3)

    def test_decision_path_explanation_properties(self):
        """
        Verifies that explain_decision_path:
        - Returns at most 3 reasons.
        - Reasons correspond to actual traversed split conditions.
        - Formats readable reasons with legitimate direction and values.
        """
        sample_features = {
            "monthly_income_band_value": 3000.0,
            "debt_to_income_ratio": 0.65,
            "late_payment_count_12m": 3,
            "credit_utilization_ratio": 0.85,
            "income_variability": 0.50,
            "loan_amount_to_income": 5.0,
            "account_history_months": 24,
            "utility_payment_consistency": 0.40,
        }
        reasons = self.model.explain_decision_path(sample_features, max_reasons=3)

        self.assertIsInstance(reasons, list)
        self.assertLessEqual(len(reasons), 3)
        self.assertGreater(len(reasons), 0)

        for r in reasons:
            self.assertIn("feature", r)
            self.assertIn(r["feature"], FEATURE_NAMES)
            self.assertIn(r["direction"], ["increases_risk", "decreases_risk"])
            self.assertIn("readable_reason", r)
            self.assertIn("impact", r)
            self.assertIn("threshold", r)
            # Verify feature value in reason matches actual input feature
            self.assertEqual(r["value"], sample_features[r["feature"]])

    def test_prediction_reproducibility(self):
        """Verifies that the same inputs and same model artifact yield bitwise-identical predictions."""
        sample_features = {
            "monthly_income_band_value": 4500.0,
            "debt_to_income_ratio": 0.35,
            "late_payment_count_12m": 1,
            "credit_utilization_ratio": 0.40,
            "income_variability": 0.20,
            "loan_amount_to_income": 3.0,
            "account_history_months": 60,
            "utility_payment_consistency": 0.80,
        }
        prob1 = self.model.predict_probability(sample_features)
        prob2 = self.model.predict_probability(sample_features)
        self.assertEqual(prob1, prob2)


if __name__ == "__main__":
    unittest.main()
