"""
Flower Federated Learning Client for Simulated Lenders.

Each simulated lender runs an isolated client that reads ONLY its local partition.
Local raw data is never exposed or sent to the central coordinator.
Adheres to 08_TECHNICAL_ARCHITECTURE.md, FR-04, and NFR-02.
"""

import os
from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

from backend.ml.model import LogisticRegressionCreditModel
from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES, TARGET_NAME

try:
    import flwr as fl
    from flwr.client import NumPyClient
except ImportError:
    # Fallback base class if flwr is still installing
    class NumPyClient:
        pass


class LenderFlowerClient(NumPyClient):
    """
    Flower client representing an independent simulated lending institution.
    Loads and trains strictly on its own local synthetic dataset partition.
    """

    def __init__(
        self,
        lender_id: str,
        data_dir: str = "backend/local_data",
        preprocessor_path: Optional[str] = None,
        local_epochs: int = 3,
        batch_size: int = 32,
        learning_rate: float = 0.02,
        use_dp: bool = False,
        dp_noise_multiplier: float = 1.0,
        dp_max_grad_norm: float = 1.0,
        dp_delta: float = 1e-4,
    ):
        self.lender_id = lender_id
        self.data_dir = data_dir
        self.local_epochs = local_epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.use_dp = use_dp
        self.dp_noise_multiplier = dp_noise_multiplier
        self.dp_max_grad_norm = dp_max_grad_norm
        self.dp_delta = dp_delta

        # Cumulative privacy accountant across federated rounds
        self.accountant = None
        if self.use_dp:
            try:
                from opacus.accountants import RDPAccountant
                self.accountant = RDPAccountant()
            except ImportError:
                self.accountant = None

        # Load shared preprocessor parameters
        prep_path = preprocessor_path or os.path.join(data_dir, "preprocessor.json")
        if not os.path.exists(prep_path):
            raise FileNotFoundError(f"Preprocessor config not found at {prep_path}")
        self.preprocessor = FeaturePreprocessor.load(prep_path)

        # Initialize local PyTorch model
        self.model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
        self.criterion = nn.BCEWithLogitsLoss()

        # Load local partition ONLY
        self.train_loader, self.val_loader, self.num_train_samples = self._load_local_data()

    def _load_local_data(self) -> Tuple[DataLoader, DataLoader, int]:
        csv_path = os.path.join(self.data_dir, self.lender_id, "train.csv")
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Local client partition missing: {csv_path}")

        df = pd.read_csv(csv_path)
        X_scaled = self.preprocessor.transform(df)
        y = df[TARGET_NAME].values.astype(np.float32)

        # 80/20 train/validation split locally
        split_idx = int(0.8 * len(df))
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]

        train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
        val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))

        train_loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=self.batch_size, shuffle=False)
        return train_loader, val_loader, len(train_ds)

    def get_parameters(self, config: Dict[str, Any]) -> List[np.ndarray]:
        """Returns local model weights as NumPy arrays."""
        weights, bias = self.model.get_weights_and_bias()
        return [weights, np.array([bias], dtype=np.float32)]

    def set_parameters(self, parameters: List[np.ndarray]) -> None:
        """Sets local model weights from aggregated server parameters."""
        weights = parameters[0]
        bias = float(parameters[1][0])
        self.model.set_weights_and_bias(weights, bias)

    def fit(
        self, parameters: List[np.ndarray], config: Dict[str, Any]
    ) -> Tuple[List[np.ndarray], int, Dict[str, Any]]:
        """
        Trains local model on client partition for local_epochs and returns updated weights.
        Supports standard local gradient descent or Opacus DP-SGD with cumulative privacy accounting.
        """
        # Initialize local training model from received server parameters
        local_model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
        weights = parameters[0]
        bias = float(parameters[1][0])
        local_model.set_weights_and_bias(weights, bias)

        optimizer = torch.optim.SGD(local_model.parameters(), lr=self.learning_rate)

        # Handle Differential Privacy via Opacus
        privacy_engine = None
        loader = self.train_loader
        train_model = local_model

        if self.use_dp:
            try:
                from opacus import PrivacyEngine
                from opacus.accountants import RDPAccountant
                if self.accountant is None:
                    self.accountant = RDPAccountant()

                privacy_engine = PrivacyEngine(secure_mode=False)
                # Attach persistent client accountant so budget accumulates across rounds
                privacy_engine.accountant = self.accountant

                train_model, optimizer, loader = privacy_engine.make_private(
                    module=local_model,
                    optimizer=optimizer,
                    data_loader=self.train_loader,
                    noise_multiplier=self.dp_noise_multiplier,
                    max_grad_norm=self.dp_max_grad_norm,
                )
            except Exception as e:
                print(f"[Client {self.lender_id}] Warning: Opacus DP initialization failed: {e}. Falling back to standard SGD.")
                self.use_dp = False

        train_model.train()
        total_loss = 0.0
        batches = 0

        for epoch in range(self.local_epochs):
            for batch_x, batch_y in loader:
                optimizer.zero_grad()
                logits = train_model(batch_x)
                loss = self.criterion(logits, batch_y)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
                batches += 1

        avg_loss = total_loss / max(1, batches)

        # Extract weights from local model
        updated_weights, updated_bias = local_model.get_weights_and_bias()
        self.model.set_weights_and_bias(updated_weights, updated_bias)
        updated_params = [updated_weights, np.array([updated_bias], dtype=np.float32)]

        metrics = {
            "lender_id": self.lender_id,
            "train_loss": float(avg_loss),
            "samples": self.num_train_samples,
            "dp_enabled": self.use_dp,
        }

        if self.use_dp and self.accountant is not None:
            try:
                eps = self.accountant.get_epsilon(delta=self.dp_delta)
                metrics["epsilon"] = float(eps)
                metrics["delta"] = float(self.dp_delta)
                metrics["max_grad_norm"] = float(self.dp_max_grad_norm)
                metrics["noise_multiplier"] = float(self.dp_noise_multiplier)
                metrics["total_steps"] = sum(entry[2] for entry in self.accountant.history) if self.accountant.history else 0
            except Exception as e:
                metrics["dp_error"] = str(e)

        return updated_params, self.num_train_samples, metrics

    def evaluate(
        self, parameters: List[np.ndarray], config: Dict[str, Any]
    ) -> Tuple[float, int, Dict[str, Any]]:
        """Evaluates model on local validation split."""
        self.set_parameters(parameters)
        self.model.eval()

        val_loss = 0.0
        batches = 0
        correct = 0
        total = 0

        with torch.no_grad():
            for batch_x, batch_y in self.val_loader:
                logits = self.model(batch_x)
                loss = self.criterion(logits, batch_y)
                val_loss += loss.item()
                batches += 1

                preds = (torch.sigmoid(logits) >= 0.5).float()
                correct += (preds == batch_y).sum().item()
                total += len(batch_y)

        avg_loss = val_loss / max(1, batches)
        accuracy = correct / max(1, total)

        return float(avg_loss), total, {"accuracy": float(accuracy), "lender_id": self.lender_id}


def start_flower_lender_client(
    lender_id: str,
    server_address: str = "127.0.0.1:8089",
    data_dir: str = "backend/local_data",
    local_epochs: int = 1,
    use_dp: bool = False,
):
    """
    Starts an isolated Flower client process connected to the central coordinator over gRPC.
    """
    client = LenderFlowerClient(
        lender_id=lender_id,
        data_dir=data_dir,
        local_epochs=local_epochs,
        use_dp=use_dp,
    )
    fl.client.start_client(
        server_address=server_address,
        client=client.to_client(),
    )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Start Standalone Flower Lender Client")
    parser.add_argument("--lender-id", required=True, help="Lender ID (e.g. lender_a, lender_b, lender_c)")
    parser.add_argument("--server-address", default="127.0.0.1:8089", help="gRPC address of Flower server")
    parser.add_argument("--data-dir", default="backend/local_data", help="Path to local data folder")
    parser.add_argument("--epochs", type=int, default=1, help="Local epochs per round")
    parser.add_argument("--dp", action="store_true", help="Enable Opacus DP-SGD")
    args = parser.parse_args()

    start_flower_lender_client(
        lender_id=args.lender_id,
        server_address=args.server_address,
        data_dir=args.data_dir,
        local_epochs=args.epochs,
        use_dp=args.dp,
    )

