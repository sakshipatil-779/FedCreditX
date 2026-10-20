"""
FL + DP Logistic Regression Scoring and SHAP Explainer Module for FedCreditX.

Activates the Federated Learning + Differential Privacy Logistic Regression model
as the primary credit-risk scoring engine with exact LinearSHAP explanations,
while preserving the Decision Tree as an interpretable baseline for comparison.
"""

import os
import json
from typing import Dict, List, Any, Tuple
import numpy as np
import torch

from backend.ml.model import LogisticRegressionCreditModel, compute_demo_risk_band
from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES
from backend.ml.decision_tree import DecisionTreeRiskModel

ARTIFACTS_DIR = "backend/artifacts"
LOCAL_DATA_DIR = "backend/local_data"
FL_DP_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "models", "federated_global_dp.pt")
PREPROCESSOR_PATH = os.path.join(LOCAL_DATA_DIR, "preprocessor.json")
DT_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "models", "decision_tree_risk_model.joblib")

FEATURE_LABELS = {
    "monthly_income_band_value": "Monthly Income",
    "debt_to_income_ratio": "Debt-to-Income (DTI) Ratio",
    "late_payment_count_12m": "12-Month Late Payment Count",
    "credit_utilization_ratio": "Revolving Credit Utilization",
    "income_variability": "Income Variability Index",
    "loan_amount_to_income": "Loan Amount to Income Ratio",
    "account_history_months": "Credit History Length (Months)",
    "utility_payment_consistency": "Utility Payment Consistency",
}


class FLDPScoringEngine:
    """
    Primary scoring engine using Federated Learning + Differential Privacy Logistic Regression,
    with exact LinearSHAP feature attributions and Decision Tree baseline comparison.
    """

    def __init__(self):
        self.model: LogisticRegressionCreditModel = None
        self.preprocessor: FeaturePreprocessor = None
        self.dt_baseline: DecisionTreeRiskModel = None
        self.weights: np.ndarray = None
        self.bias: float = 0.0
        self.metadata: Dict[str, Any] = {}
        self._load()

    def _load(self):
        if not os.path.exists(PREPROCESSOR_PATH):
            raise FileNotFoundError(f"Preprocessor not found at {PREPROCESSOR_PATH}")
        self.preprocessor = FeaturePreprocessor.load(PREPROCESSOR_PATH)

        if not os.path.exists(FL_DP_MODEL_PATH):
            raise FileNotFoundError(f"FL+DP model not found at {FL_DP_MODEL_PATH}")
        self.model, self.metadata = LogisticRegressionCreditModel.load_artifact(FL_DP_MODEL_PATH)
        self.weights, self.bias = self.model.get_weights_and_bias()

        if os.path.exists(DT_MODEL_PATH):
            try:
                self.dt_baseline = DecisionTreeRiskModel.load_artifact(DT_MODEL_PATH)
            except Exception:
                self.dt_baseline = None

    def score_applicant(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Scores applicant features using FL+DP Logistic Regression, computes exact SHAP
        feature contributions, and retrieves Decision Tree baseline comparison.
        """
        # 1. Feature normalization
        x_raw = np.array([float(features.get(f, 0.0)) for f in FEATURE_NAMES])
        means = np.array([self.preprocessor.means[f] for f in FEATURE_NAMES])
        stds = np.array([self.preprocessor.stds[f] for f in FEATURE_NAMES])
        z = (x_raw - means) / stds

        # 2. FL+DP Prediction
        logit = float(self.bias + np.sum(self.weights * z))
        prob = float(1.0 / (1.0 + np.exp(-logit)))
        risk_band, risk_desc = compute_demo_risk_band(prob)

        # 3. Exact LinearSHAP attributions: phi_i = w_i * z_i
        phi = self.weights * z
        shap_reasons = []

        for i, f_name in enumerate(FEATURE_NAMES):
            val = float(x_raw[i])
            val_z = float(z[i])
            contrib = float(phi[i])
            label = FEATURE_LABELS.get(f_name, f_name)
            is_risk_increasing = contrib > 0
            direction = "increases_risk" if is_risk_increasing else "decreases_risk"

            # Formulate clear, factual SHAP explanation based on actual prediction
            mean_val = float(means[i])
            if f_name == "monthly_income_band_value":
                readable = (
                    f"Monthly income of ${val:,.0f} ({'below' if val < mean_val else 'above'} portfolio mean ${mean_val:,.0f}) "
                    f"{'elevates' if is_risk_increasing else 'reduces'} default risk (SHAP: {contrib:+.3f})."
                )
            elif f_name in ["debt_to_income_ratio", "credit_utilization_ratio", "utility_payment_consistency"]:
                readable = (
                    f"{label} of {val*100:.1f}% ({'above' if val > mean_val else 'below'} portfolio average {mean_val*100:.1f}%) "
                    f"{'adds' if is_risk_increasing else 'lowers'} default probability (SHAP: {contrib:+.3f})."
                )
            elif f_name == "late_payment_count_12m":
                readable = (
                    f"{int(val)} late payments in past 12 months "
                    f"{'increases' if is_risk_increasing else 'mitigates'} default risk (SHAP: {contrib:+.3f})."
                )
            elif f_name == "account_history_months":
                readable = (
                    f"Credit history length of {int(val)} months ({'shorter' if val < mean_val else 'longer'} than average {mean_val:.0f} mos) "
                    f"{'elevates' if is_risk_increasing else 'reduces'} risk (SHAP: {contrib:+.3f})."
                )
            else:
                readable = (
                    f"{label} value of {val:.2f} ({'higher' if val > mean_val else 'lower'} than benchmark {mean_val:.2f}) "
                    f"{'increases' if is_risk_increasing else 'decreases'} risk (SHAP: {contrib:+.3f})."
                )

            shap_reasons.append({
                "feature": f_name,
                "feature_label": label,
                "direction": direction,
                "value": val,
                "shap_value": round(contrib, 4),
                "impact": f"SHAP {contrib:+.3f}",
                "condition": f"z-score = {val_z:+.2f}",
                "readable_reason": readable,
                "abs_impact": abs(contrib),
            })

        # Sort reasons by risk-increasing impact first, then absolute impact
        shap_reasons.sort(key=lambda r: (1 if r["direction"] == "increases_risk" else 0, r["abs_impact"]), reverse=True)
        top_3_reasons = shap_reasons[:3]

        # 4. Recommendation based on exact boundary rules
        if prob < 0.30:
            system_rec = "Auto-approve recommendation"
            badge_color = "green"
            risk_level = "Low"
            required_handling = "Standard processing: automated low-risk profile."
        elif prob <= 0.70:
            system_rec = "Send to human review"
            badge_color = "amber"
            risk_level = "Medium"
            required_handling = "Secondary underwriting: officer review of key risk drivers."
        else:
            system_rec = "Flag high risk"
            badge_color = "red"
            risk_level = "High"
            required_handling = "Elevated risk flag: senior officer review or additional collateral required."

        # 5. Baseline Decision Tree comparison (Interpretable Baseline)
        dt_prob = None
        dt_risk_band = None
        dt_path = []
        if self.dt_baseline is not None:
            try:
                dt_prob = float(self.dt_baseline.predict_probability(features))
                dt_risk_band, _ = compute_demo_risk_band(dt_prob)
                dt_path = self.dt_baseline.explain_decision_path(features, max_reasons=3)
            except Exception:
                pass

        return {
            "model_type": "FL + DP Logistic Regression (Primary)",
            "model_version": self.metadata.get("version", "fl-global-dp-v3"),
            "default_probability_estimate": round(prob, 4),
            "percentage_display": f"{prob*100:.1f}%",
            "risk_level": risk_level,
            "demo_risk_band": risk_band,
            "risk_band_description": risk_desc,
            "badge_color": badge_color,
            "system_recommendation": system_rec,
            "required_handling": required_handling,
            "top_reasons": top_3_reasons,
            "all_shap_attributions": shap_reasons,
            "baseline_comparison": {
                "model_name": "Decision Tree (Interpretable Baseline)",
                "default_probability": round(dt_prob, 4) if dt_prob is not None else None,
                "percentage_display": f"{dt_prob*100:.1f}%" if dt_prob is not None else None,
                "risk_band": dt_risk_band,
                "tree_path": dt_path,
            },
            "features": features,
        }
