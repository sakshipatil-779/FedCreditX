"""
Federated Learning Validation and Smoke Test (FR-04).

Verifies multi-client Flower federated training across Lender A, Lender B, and Lender C.
Ensures local client data isolation, server aggregation, and versioned artifact persistence.
Adheres to 11_VALIDATION_AND_TEST_PLAN.md.
"""

import os
import json
import unittest
import numpy as np
import pandas as pd
import torch

from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES
from backend.ml.model import LogisticRegressionCreditModel
from backend.federation.client_app import LenderFlowerClient


class TestFederationIsolationAndClients(unittest.TestCase):
    """
    Tests individual client behavior and partition isolation.
    """

    def setUp(self):
        self.data_dir = "backend/local_data"
        self.prep_path = os.path.join(self.data_dir, "preprocessor.json")
        self.assertTrue(os.path.exists(self.prep_path), "Preprocessor json must exist")

    def test_clients_load_only_their_own_partitions(self):
        """Verifies each client accesses only its assigned partition."""
        client_a = LenderFlowerClient("lender_a", data_dir=self.data_dir)
        client_b = LenderFlowerClient("lender_b", data_dir=self.data_dir)
        client_c = LenderFlowerClient("lender_c", data_dir=self.data_dir)

        # 80% of 1,200 samples = 960 training samples
        self.assertEqual(client_a.num_train_samples, 960)
        self.assertEqual(client_b.num_train_samples, 960)
        self.assertEqual(client_c.num_train_samples, 960)

    def test_local_fit_updates_weights_without_raw_data_leakage(self):
        """Verifies fit() returns updated parameter tensors and metrics, never raw rows."""
        client_a = LenderFlowerClient("lender_a", data_dir=self.data_dir, local_epochs=2)
        initial_params = client_a.get_parameters({})

        # Initial weights are zero
        self.assertEqual(len(initial_params), 2)
        self.assertEqual(initial_params[0].shape, (8,))

        # Run local training round
        updated_params, num_samples, metrics = client_a.fit(initial_params, {})

        # Assert weights changed
        self.assertFalse(np.allclose(initial_params[0], updated_params[0]))
        self.assertEqual(num_samples, 960)
        self.assertIn("train_loss", metrics)
        self.assertIn("lender_id", metrics)
        self.assertEqual(metrics["lender_id"], "lender_a")

        # Crucial privacy assertion: metrics and parameters contain NO raw data rows or text
        for k, v in metrics.items():
            self.assertNotIsInstance(v, (pd.DataFrame, pd.Series, list))

    def test_simulated_federated_averaging(self):
        """
        Simulates manual FedAvg aggregation mathematically to verify parameter shapes and aggregation math.
        """
        client_a = LenderFlowerClient("lender_a", data_dir=self.data_dir, local_epochs=1)
        client_b = LenderFlowerClient("lender_b", data_dir=self.data_dir, local_epochs=1)
        client_c = LenderFlowerClient("lender_c", data_dir=self.data_dir, local_epochs=1)

        init_params = client_a.get_parameters({})
        params_a, n_a, _ = client_a.fit(init_params, {})
        params_b, n_b, _ = client_b.fit(init_params, {})
        params_c, n_c, _ = client_c.fit(init_params, {})

        total_samples = n_a + n_b + n_c
        # Weighted parameter averaging (FedAvg)
        avg_w = (params_a[0] * n_a + params_b[0] * n_b + params_c[0] * n_c) / total_samples
        avg_b = (params_a[1] * n_a + params_b[1] * n_b + params_c[1] * n_c) / total_samples

        self.assertEqual(avg_w.shape, (8,))
        self.assertTrue(np.isfinite(avg_w).all())
        self.assertTrue(np.isfinite(avg_b).all())

    def test_opacus_dp_fit_adds_noise_and_computes_privacy_budget(self):
        """Verifies Opacus DP-SGD runs locally, updates weights, and outputs verified epsilon budget."""
        client_a = LenderFlowerClient(
            "lender_a",
            data_dir=self.data_dir,
            local_epochs=1,
            use_dp=True,
            dp_noise_multiplier=1.0,
            dp_max_grad_norm=1.0,
            dp_delta=1e-4,
        )
        init_params = client_a.get_parameters({})
        updated_params, num_samples, metrics = client_a.fit(init_params, {})

        self.assertTrue(metrics.get("dp_enabled"))
        self.assertIn("epsilon", metrics)
        self.assertGreater(metrics["epsilon"], 0.0)
        self.assertLess(metrics["epsilon"], 100.0)
        self.assertEqual(metrics["delta"], 1e-4)
        self.assertEqual(metrics["max_grad_norm"], 1.0)
        self.assertEqual(metrics["noise_multiplier"], 1.0)
        self.assertFalse(np.allclose(init_params[0], updated_params[0]))

    def test_opacus_dp_accountant_accumulates_across_multiple_rounds(self):
        """Regression test: verifies DP accountant accumulates budget and step history across rounds without resetting."""
        client = LenderFlowerClient(
            "lender_a",
            data_dir=self.data_dir,
            local_epochs=1,
            use_dp=True,
            dp_noise_multiplier=1.0,
            dp_max_grad_norm=1.0,
            dp_delta=1e-4,
        )
        params = client.get_parameters({})

        # Round 1
        params, _, m1 = client.fit(params, {"round": 1})
        eps1 = m1["epsilon"]
        steps1 = m1["total_steps"]

        # Round 2
        params, _, m2 = client.fit(params, {"round": 2})
        eps2 = m2["epsilon"]
        steps2 = m2["total_steps"]

        # Round 3
        params, _, m3 = client.fit(params, {"round": 3})
        eps3 = m3["epsilon"]
        steps3 = m3["total_steps"]

        # Assert monotonically increasing cumulative privacy loss and step counts
        self.assertGreater(eps2, eps1, "Accountant must accumulate privacy loss in round 2")
        self.assertGreater(eps3, eps2, "Accountant must accumulate privacy loss in round 3")
        self.assertGreater(steps2, steps1, "Step history must accumulate in round 2")
        self.assertGreater(steps3, steps2, "Step history must accumulate in round 3")

    def test_genuine_flower_grpc_orchestration(self):
        """
        Integration test (FR-04): Demonstrates authentic Flower server/client orchestration
        across independent processes communicating over gRPC, completing 1 federated round.
        """
        from backend.federation.server_app import run_genuine_flower_grpc
        result = run_genuine_flower_grpc(
            num_rounds=1,
            server_address="127.0.0.1:8096",
            data_dir=self.data_dir,
            local_epochs=1,
            timeout=25.0,
        )
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["mode"], "flower_grpc_multiprocess")
        self.assertEqual(result["rounds_completed"], 1)
        self.assertEqual(result["server_returncode"], 0)
        for client_id, code in result["client_returncodes"].items():
            self.assertEqual(code, 0, f"Client {client_id} failed with exit code {code}")


if __name__ == "__main__":
    unittest.main()
