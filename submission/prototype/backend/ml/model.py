"""
PyTorch Logistic Regression Credit Risk Model for FedCreditX.

Single linear layer with binary cross-entropy loss with logits.
Strictly non-neural / non-deep-learning per AGENTS.md and 00_PROJECT_CHARTER.md.
Provides deterministic model versioning, weight serialization, and prediction calibration mapping.
"""

import os
import json
import hashlib
from typing import Dict, Any, Tuple, Optional
import numpy as np
import torch
import torch.nn as nn

NUM_FEATURES = 8


class LogisticRegressionCreditModel(nn.Module):
    """
    Interpretable baseline logistic regression model.
    Maps an 8-dimensional normalized financial feature vector to a single scalar logit.
    """

    def __init__(self, in_features: int = NUM_FEATURES):
        super().__init__()
        self.in_features = in_features
        self.linear = nn.Linear(in_features, 1, bias=True)
        # Initialize with neutral small weights
        nn.init.zeros_(self.linear.weight)
        nn.init.zeros_(self.linear.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Computes raw logit."""
        return self.linear(x).squeeze(-1)

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Computes default probability via sigmoid."""
        logits = self.forward(x)
        return torch.sigmoid(logits)

    def get_weights_and_bias(self) -> Tuple[np.ndarray, float]:
        """Returns linear coefficients and bias as numpy array and float."""
        weights = self.linear.weight.detach().cpu().numpy().flatten()
        bias = float(self.linear.bias.detach().cpu().numpy()[0])
        return weights, bias

    def set_weights_and_bias(self, weights: np.ndarray, bias: float) -> None:
        """Sets linear layer parameters from numpy arrays."""
        with torch.no_grad():
            self.linear.weight.copy_(torch.from_numpy(weights).reshape(1, -1))
            self.linear.bias.copy_(torch.tensor([bias], dtype=torch.float32))

    def save_artifact(
        self,
        filepath: str,
        version: str,
        training_run_id: str,
        metrics: Optional[Dict[str, Any]] = None,
        feature_names: Optional[list] = None,
        privacy_mode: str = "none",
    ) -> Dict[str, Any]:
        """
        Saves model weights along with metadata and artifact hash.
        """
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        weights, bias = self.get_weights_and_bias()

        checkpoint = {
            "version": version,
            "training_run_id": training_run_id,
            "in_features": self.in_features,
            "feature_names": feature_names or [],
            "state_dict": self.state_dict(),
            "weights": weights.tolist(),
            "bias": bias,
            "metrics": metrics or {},
            "privacy_mode": privacy_mode,
        }

        torch.save(checkpoint, filepath)

        # Compute SHA-256 integrity hash
        with open(filepath, "rb") as f:
            artifact_hash = hashlib.sha256(f.read()).hexdigest()

        manifest = {
            "version": version,
            "training_run_id": training_run_id,
            "filepath": filepath,
            "artifact_hash": artifact_hash,
            "metrics": metrics or {},
            "privacy_mode": privacy_mode,
        }

        manifest_path = filepath + ".json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        return manifest

    @classmethod
    def load_artifact(cls, filepath: str) -> Tuple["LogisticRegressionCreditModel", Dict[str, Any]]:
        """
        Loads saved checkpoint and returns (model, metadata).
        """
        checkpoint = torch.load(filepath, map_location="cpu", weights_only=False)
        in_features = checkpoint.get("in_features", NUM_FEATURES)
        model = cls(in_features=in_features)
        model.load_state_dict(checkpoint["state_dict"])
        model.eval()

        metadata = {
            "version": checkpoint.get("version", "unknown"),
            "training_run_id": checkpoint.get("training_run_id", "unknown"),
            "metrics": checkpoint.get("metrics", {}),
            "feature_names": checkpoint.get("feature_names", []),
            "privacy_mode": checkpoint.get("privacy_mode", "none"),
            "weights": checkpoint.get("weights", []),
            "bias": checkpoint.get("bias", 0.0),
        }
        return model, metadata


def compute_demo_risk_band(prob: float) -> Tuple[str, str]:
    """
    Maps estimated default probability to a predefined presentation risk band.
    Demo only: not calibrated real-world credit rating.
    """
    if prob < 0.15:
        return "LOW", "Demo Model Estimated Risk: Low (<15% estimated default probability)"
    elif prob < 0.35:
        return "MODERATE", "Demo Model Estimated Risk: Moderate (15%–35% estimated default probability)"
    elif prob < 0.60:
        return "ELEVATED", "Demo Model Estimated Risk: Elevated (35%–60% estimated default probability)"
    else:
        return "HIGH", "Demo Model Estimated Risk: High (>=60% estimated default probability)"
