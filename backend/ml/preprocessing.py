"""
Feature preprocessing module for FedCreditX.

Provides deterministic scaling, feature ordering, and strict schema validation
shared across all simulated clients and inference workflows.
"""

import json
from typing import Dict, List, Tuple, Any
import numpy as np
import pandas as pd

FEATURE_NAMES = [
    "monthly_income_band_value",
    "debt_to_income_ratio",
    "late_payment_count_12m",
    "credit_utilization_ratio",
    "income_variability",
    "loan_amount_to_income",
    "account_history_months",
    "utility_payment_consistency",
]

TARGET_NAME = "defaulted"


class FeaturePreprocessor:
    """
    StandardScaler with strict feature ordering, persistence, and input validation.
    """

    def __init__(self, feature_names: List[str] = None):
        self.feature_names = feature_names or FEATURE_NAMES
        self.means: Dict[str, float] = {}
        self.stds: Dict[str, float] = {}
        self.fitted: bool = False

    def fit(self, df: pd.DataFrame) -> "FeaturePreprocessor":
        self.means = {}
        self.stds = {}
        for col in self.feature_names:
            if col not in df.columns:
                raise ValueError(f"Feature column '{col}' missing from training dataframe")
            col_vals = df[col].astype(float).values
            mean = float(np.mean(col_vals))
            std = float(np.std(col_vals))
            if std < 1e-7:
                std = 1.0  # avoid division by zero
            self.means[col] = mean
            self.stds[col] = std
        self.fitted = True
        return self

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError("Preprocessor must be fitted before transforming data")
        self.validate_dataframe(df)

        scaled_cols = []
        for col in self.feature_names:
            col_vals = df[col].astype(float).values
            scaled = (col_vals - self.means[col]) / self.stds[col]
            scaled_cols.append(scaled)

        return np.column_stack(scaled_cols).astype(np.float32)

    def transform_single(self, feature_dict: Dict[str, Any]) -> np.ndarray:
        """Transforms a single feature dictionary for inference."""
        if not self.fitted:
            raise RuntimeError("Preprocessor must be fitted before transforming data")
        self.validate_feature_dict(feature_dict)

        scaled_vals = []
        for col in self.feature_names:
            raw_val = float(feature_dict[col])
            scaled = (raw_val - self.means[col]) / self.stds[col]
            scaled_vals.append(scaled)

        return np.array([scaled_vals], dtype=np.float32)

    def validate_dataframe(self, df: pd.DataFrame) -> None:
        for col in self.feature_names:
            if col not in df.columns:
                raise ValueError(f"Missing required feature: {col}")
            vals = df[col].values
            if pd.isnull(vals).any():
                raise ValueError(f"Feature '{col}' contains NaN/null values")
            if np.isinf(vals.astype(float)).any():
                raise ValueError(f"Feature '{col}' contains infinite values")

    def validate_feature_dict(self, feature_dict: Dict[str, Any]) -> None:
        missing = [f for f in self.feature_names if f not in feature_dict]
        if missing:
            raise ValueError(f"Missing required features: {missing}")
        for col in self.feature_names:
            val = feature_dict[col]
            if val is None or not isinstance(val, (int, float, np.number)):
                raise ValueError(f"Invalid numeric value for '{col}': {val}")
            if np.isnan(float(val)) or np.isinf(float(val)):
                raise ValueError(f"Feature '{col}' contains NaN or Inf: {val}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature_names": self.feature_names,
            "means": self.means,
            "stds": self.stds,
            "fitted": self.fitted,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FeaturePreprocessor":
        instance = cls(feature_names=data["feature_names"])
        instance.means = data["means"]
        instance.stds = data["stds"]
        instance.fitted = data.get("fitted", True)
        return instance

    def save(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, filepath: str) -> "FeaturePreprocessor":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
