"""
FedCreditX Decision Tree Risk Model Module.

Implements DecisionTreeClassifier for applicant default-risk scoring,
inference, decision-path explanations, and artifact persistence.
Adheres to STEP 2 and STEP 4.B requirements.
Strictly Decision Tree only (no logistic regression, ensembles, or deep learning).
"""

import os
import json
import hashlib
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd
import joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    brier_score_loss,
)

from backend.ml.preprocessing import FEATURE_NAMES, TARGET_NAME, FeaturePreprocessor

MODEL_TYPE_NAME = "DecisionTreeClassifier"
DEFAULT_MODEL_VERSION = "DT-v1.0.0"

# Human readable friendly feature labels
FEATURE_LABELS = {
    "monthly_income_band_value": "Monthly Income",
    "debt_to_income_ratio": "Debt-to-Income Ratio",
    "late_payment_count_12m": "12-Month Late Payment Count",
    "credit_utilization_ratio": "Credit Utilization Ratio",
    "income_variability": "Income Variability Index",
    "loan_amount_to_income": "Loan-to-Income Ratio",
    "account_history_months": "Credit Account History (Months)",
    "utility_payment_consistency": "Utility Payment Consistency",
}


class DecisionTreeRiskModel:
    """
    Applicant risk scoring engine powered exclusively by a single DecisionTreeClassifier.
    Supports prediction, class verification, and exact decision path rule explanations.
    """

    def __init__(
        self,
        model: Optional[DecisionTreeClassifier] = None,
        preprocessor: Optional[FeaturePreprocessor] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.model = model
        self.preprocessor = preprocessor
        self.metadata = metadata or {}
        self.feature_names = FEATURE_NAMES

    @property
    def is_fitted(self) -> bool:
        return self.model is not None and hasattr(self.model, "classes_")

    def fit(
        self,
        train_df: pd.DataFrame,
        val_df: Optional[pd.DataFrame] = None,
        max_depth: int = 5,
        min_samples_leaf: int = 20,
        random_state: int = 42,
    ) -> Dict[str, Any]:
        """
        Fits DecisionTreeClassifier exclusively on training data.
        Keeps holdout test sets strictly isolated.
        """
        # Validate training columns
        for col in self.feature_names + [TARGET_NAME]:
            if col not in train_df.columns:
                raise ValueError(f"Missing required training column: {col}")

        # Fit preprocessor on training data only
        self.preprocessor = FeaturePreprocessor(self.feature_names)
        self.preprocessor.fit(train_df)

        X_train = train_df[self.feature_names].values.astype(np.float32)
        y_train = train_df[TARGET_NAME].values.astype(int)

        self.model = DecisionTreeClassifier(
            max_depth=max_depth,
            min_samples_leaf=min_samples_leaf,
            random_state=random_state,
        )
        self.model.fit(X_train, y_train)

        # Verify positive class (label 1) exists in classes_
        classes = list(self.model.classes_)
        if 1 not in classes:
            raise ValueError(f"Trained DecisionTree does not contain positive class 1. Classes: {classes}")

        # Metrics on training data
        pos_idx = classes.index(1)
        train_probs = self.model.predict_proba(X_train)[:, pos_idx]
        train_preds = self.model.predict(X_train)

        metrics = {
            "train_samples": len(train_df),
            "train_auroc": float(roc_auc_score(y_train, train_probs)),
            "train_pr_auc": float(average_precision_score(y_train, train_probs)),
            "train_f1": float(f1_score(y_train, train_preds, zero_division=0)),
            "max_depth": max_depth,
            "min_samples_leaf": min_samples_leaf,
            "node_count": int(self.model.tree_.node_count),
        }

        if val_df is not None:
            X_val = val_df[self.feature_names].values.astype(np.float32)
            y_val = val_df[TARGET_NAME].values.astype(int)
            val_probs = self.model.predict_proba(X_val)[:, pos_idx]
            val_preds = self.model.predict(X_val)
            metrics.update({
                "val_samples": len(val_df),
                "val_auroc": float(roc_auc_score(y_val, val_probs)),
                "val_f1": float(f1_score(y_val, val_preds, zero_division=0)),
                "val_brier": float(brier_score_loss(y_val, val_probs)),
            })

        self.metadata = {
            "model_type": MODEL_TYPE_NAME,
            "version": DEFAULT_MODEL_VERSION,
            "feature_names": self.feature_names,
            "classes": [int(c) for c in classes],
            "metrics": metrics,
        }
        return metrics

    def predict_probability(self, features: Dict[str, float]) -> float:
        """
        Computes default-risk probability for a single applicant dictionary.
        Verifies positive class index from model.classes_.
        """
        if not self.is_fitted:
            raise RuntimeError("Decision Tree model is not trained or loaded.")

        classes = list(self.model.classes_)
        if 1 not in classes:
            raise ValueError(f"Decision Tree classes_ does not contain positive class 1: {classes}")
        pos_idx = classes.index(1)

        # Validate feature vector
        missing = [f for f in self.feature_names if f not in features]
        if missing:
            raise ValueError(f"Missing required features for Decision Tree scoring: {missing}")

        X_sample = np.array([[float(features[f]) for f in self.feature_names]], dtype=np.float32)

        probs = self.model.predict_proba(X_sample)[0]
        prob = float(probs[pos_idx])
        return round(max(0.001, min(0.999, prob)), 4)

    def explain_decision_path(
        self, features: Dict[str, float], max_reasons: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Generates up to 3 meaningful, mathematically defensible explanations
        derived directly from the Decision Tree decision path (split conditions traversed).
        """
        if not self.is_fitted:
            raise RuntimeError("Decision Tree model is not loaded for explanation.")

        classes = list(self.model.classes_)
        pos_idx = classes.index(1) if 1 in classes else 1

        X_sample = np.array([[float(features[f]) for f in self.feature_names]], dtype=np.float32)

        node_indicator = self.model.decision_path(X_sample)
        node_indices = node_indicator.indices[node_indicator.indptr[0] : node_indicator.indptr[1]]
        tree = self.model.tree_

        reasons = []

        # Walk through each split node along the applicant's traversal path
        for i in range(len(node_indices) - 1):
            curr_node = node_indices[i]
            next_node = node_indices[i + 1]

            feat_idx = tree.feature[curr_node]
            if feat_idx < 0:
                continue  # leaf node, no split

            feat_name = self.feature_names[feat_idx]
            threshold = float(tree.threshold[curr_node])
            raw_val = float(features[feat_name])
            label = FEATURE_LABELS.get(feat_name, feat_name.replace("_", " ").title())

            # Parent node default probability vs. child node default probability
            parent_vals = tree.value[curr_node][0]
            parent_prob = float(parent_vals[pos_idx] / np.sum(parent_vals))

            child_vals = tree.value[next_node][0]
            child_prob = float(child_vals[pos_idx] / np.sum(child_vals))

            delta = child_prob - parent_prob
            direction = "increases_risk" if delta > 0 else "decreases_risk"

            # Check split condition met
            took_left = (next_node == tree.children_left[curr_node])
            comp_sym = "<=" if took_left else ">"

            # Format readable explanation text
            if feat_name in ["monthly_income_band_value"]:
                val_disp = f"${raw_val:,.0f}"
                th_disp = f"${threshold:,.0f}"
            elif feat_name in ["credit_utilization_ratio", "debt_to_income_ratio", "income_variability", "utility_payment_consistency"]:
                val_disp = f"{raw_val*100:.1f}%"
                th_disp = f"{threshold*100:.1f}%"
            elif feat_name in ["account_history_months"]:
                val_disp = f"{int(raw_val)} months"
                th_disp = f"{threshold:.0f} months"
            else:
                val_disp = f"{raw_val:.2f}"
                th_disp = f"{threshold:.2f}"

            if direction == "increases_risk":
                readable_reason = f"{label} is {val_disp} ({comp_sym} {th_disp} threshold) — increases estimated risk."
            else:
                readable_reason = f"{label} is {val_disp} ({comp_sym} {th_disp} threshold) — decreases estimated risk."

            impact_str = f"{'+' if delta > 0 else ''}{delta*100:.1f}%"

            reasons.append({
                "feature": feat_name,
                "feature_label": label,
                "direction": direction,
                "value": raw_val,
                "threshold": threshold,
                "impact_delta": delta,
                "impact": impact_str,
                "condition": f"{feat_name} {comp_sym} {threshold:.2f}",
                "readable_reason": readable_reason,
            })

        # Rank reasons by absolute magnitude of delta change (highest impact on probability first)
        reasons.sort(key=lambda r: abs(r["impact_delta"]), reverse=True)

        # Return top N reasons (returns fewer than 3 if fewer splits available)
        return reasons[:max_reasons]

    def save_artifact(self, filepath: str) -> Dict[str, Any]:
        """
        Saves DecisionTree model and metadata manifest.
        """
        if not self.is_fitted:
            raise RuntimeError("Cannot save an unfitted Decision Tree model.")

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self.model, filepath)

        with open(filepath, "rb") as f:
            artifact_hash = hashlib.sha256(f.read()).hexdigest()

        manifest = {
            "model_type": MODEL_TYPE_NAME,
            "version": self.metadata.get("version", DEFAULT_MODEL_VERSION),
            "filepath": filepath,
            "artifact_hash": artifact_hash,
            "feature_names": self.feature_names,
            "classes": [int(c) for c in self.model.classes_],
            "metrics": self.metadata.get("metrics", {}),
        }

        manifest_path = filepath + ".json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        return manifest

    @classmethod
    def load_artifact(cls, filepath: str) -> "DecisionTreeRiskModel":
        """
        Loads persisted DecisionTree model and metadata.
        Raises FileNotFoundError if file is missing.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Decision Tree artifact missing: {filepath}")

        model = joblib.load(filepath)
        if not hasattr(model, "classes_"):
            raise ValueError(f"Corrupt or invalid Decision Tree model: {filepath}")

        # Check positive class
        if 1 not in list(model.classes_):
            raise ValueError(f"Model classes_ missing positive class 1: {model.classes_}")

        manifest_path = filepath + ".json"
        metadata = {}
        if os.path.exists(manifest_path):
            with open(manifest_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)

        return cls(model=model, metadata=metadata)


def train_and_persist_decision_tree(
    data_dir: str = "backend/local_data",
    artifacts_dir: str = "backend/artifacts",
) -> Tuple[DecisionTreeRiskModel, Dict[str, Any]]:
    """
    Trains Decision Tree on 80% train split of all 3 lenders (2,880 rows total).
    Evaluates on holdout test set (900 rows) and persists artifact.
    """
    train_dfs = []
    val_dfs = []

    for lender in ["lender_a", "lender_b", "lender_c"]:
        csv_path = os.path.join(data_dir, lender, "train.csv")
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Lender partition missing: {csv_path}")
        df = pd.read_csv(csv_path)
        split_idx = int(0.8 * len(df))
        train_dfs.append(df.iloc[:split_idx])
        val_dfs.append(df.iloc[split_idx:])

    train_data = pd.concat(train_dfs, ignore_index=True)
    val_data = pd.concat(val_dfs, ignore_index=True)

    dt_model = DecisionTreeRiskModel()
    metrics = dt_model.fit(
        train_df=train_data,
        val_df=val_data,
        max_depth=5,
        min_samples_leaf=20,
        random_state=42,
    )

    # Evaluate on holdout test set
    holdout_path = os.path.join(data_dir, "holdout_test", "test.csv")
    if os.path.exists(holdout_path):
        test_df = pd.read_csv(holdout_path)
        X_test = test_df[FEATURE_NAMES].values.astype(np.float32)
        y_test = test_df[TARGET_NAME].values.astype(int)
        pos_idx = list(dt_model.model.classes_).index(1)
        test_probs = dt_model.model.predict_proba(X_test)[:, pos_idx]
        test_preds = (test_probs >= 0.50).astype(int)

        metrics.update({
            "holdout_test_samples": len(test_df),
            "holdout_auroc": float(roc_auc_score(y_test, test_probs)),
            "holdout_pr_auc": float(average_precision_score(y_test, test_probs)),
            "holdout_f1": float(f1_score(y_test, test_preds, zero_division=0)),
            "holdout_precision": float(precision_score(y_test, test_preds, zero_division=0)),
            "holdout_recall": float(recall_score(y_test, test_preds, zero_division=0)),
            "holdout_brier": float(brier_score_loss(y_test, test_probs)),
        })

    model_dir = os.path.join(artifacts_dir, "models")
    os.makedirs(model_dir, exist_ok=True)
    artifact_path = os.path.join(model_dir, "decision_tree_risk_model.joblib")
    dt_model.save_artifact(artifact_path)

    # Save metrics JSON
    metrics_dir = os.path.join(artifacts_dir, "metrics")
    os.makedirs(metrics_dir, exist_ok=True)
    metrics_path = os.path.join(metrics_dir, "decision_tree_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return dt_model, metrics


if __name__ == "__main__":
    print("Training Decision Tree Risk Model on synthetic lender partitions...")
    model, res = train_and_persist_decision_tree()
    print("Decision Tree training complete!")
    print(json.dumps(res, indent=2))
