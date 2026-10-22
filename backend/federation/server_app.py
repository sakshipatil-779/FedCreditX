"""
Flower Federated Learning Coordinator for FedCreditX.

Orchestrates multi-round Federated Averaging (FedAvg) across 3 simulated lender clients.
Evaluates aggregated global model on central synthetic holdout test set after each round.
Saves versioned global model artifacts and persists run metadata into SQLite.
Adheres to 08_TECHNICAL_ARCHITECTURE.md, FR-04, FR-05, and FR-12.
"""

import os
import sys
import json
import uuid
import datetime
from typing import Dict, List, Tuple, Optional, Any
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score, confusion_matrix, brier_score_loss, average_precision_score

import torch
import torch.nn as nn

from backend.ml.model import LogisticRegressionCreditModel
from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES, TARGET_NAME
from backend.federation.client_app import LenderFlowerClient

try:
    import flwr as fl
    from flwr.server import ServerConfig
    from flwr.server.strategy import FedAvg
    from flwr.common import Parameters, Scalar, ndarrays_to_parameters, parameters_to_ndarrays
except ImportError:
    fl = None


def get_evaluate_fn(test_df: pd.DataFrame, preprocessor: FeaturePreprocessor):
    """
    Returns an evaluation function that assesses the aggregated global model
    on the central held-out test partition.
    """
    X_test_np = preprocessor.transform(test_df)
    y_test_np = test_df[TARGET_NAME].values.astype(np.float32)

    X_test = torch.from_numpy(X_test_np)
    y_test = torch.from_numpy(y_test_np)
    criterion = nn.BCEWithLogitsLoss()

    def evaluate(server_round: int, parameters: List[np.ndarray], config: Dict[str, Scalar]):
        model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
        model.set_weights_and_bias(parameters[0], float(parameters[1][0]))
        model.eval()

        with torch.no_grad():
            logits = model(X_test)
            loss = criterion(logits, y_test).item()
            probs = torch.sigmoid(logits).numpy()

        preds = (probs >= 0.50).astype(int)
        auc = float(roc_auc_score(y_test_np, probs))
        pr_auc = float(average_precision_score(y_test_np, probs))
        f1 = float(f1_score(y_test_np, preds, zero_division=0))
        prec = float(precision_score(y_test_np, preds, zero_division=0))
        rec = float(recall_score(y_test_np, preds, zero_division=0))
        brier = float(brier_score_loss(y_test_np, probs))

        print(f"--- [FedAvg Round {server_round}] Holdout Test Loss: {loss:.4f} | AUROC: {auc:.4f} | PR-AUC: {pr_auc:.4f} | F1: {f1:.4f} ---")
        return float(loss), {
            "roc_auc": auc,
            "pr_auc": pr_auc,
            "f1_score": f1,
            "precision": prec,
            "recall": rec,
            "brier_score": brier,
        }

    return evaluate


def run_federated_simulation(
    num_rounds: int = 5,
    data_dir: str = "backend/local_data",
    artifacts_dir: str = "backend/artifacts",
    db_path: str = "backend/fedcreditx.db",
    learning_rate: float = 0.02,
    local_epochs: int = 3,
    use_dp: bool = False,
    dp_noise_multiplier: float = 1.0,
    dp_max_grad_norm: float = 1.0,
) -> Dict[str, Any]:
    """
    Executes a Flower federated training simulation across three simulated clients.
    Supports standard FedAvg or Opacus DP-SGD with differential privacy accounting.
    """
    if fl is None:
        raise RuntimeError("Flower (flwr) package is not installed.")

    # 1. Load Preprocessor & Holdout Test Partition
    prep_path = os.path.join(data_dir, "preprocessor.json")
    if not os.path.exists(prep_path):
        raise FileNotFoundError(f"Preprocessor config missing: {prep_path}")
    preprocessor = FeaturePreprocessor.load(prep_path)

    test_path = os.path.join(data_dir, "holdout_test", "test.csv")
    test_df = pd.read_csv(test_path)

    client_ids = ["lender_a", "lender_b", "lender_c"]

    # Client factory function for Flower simulation
    def client_fn(cid: str):
        # Maps client index or name to simulated lender
        try:
            idx = int(cid)
            lender_id = client_ids[idx % len(client_ids)]
        except ValueError:
            lender_id = cid

        return LenderFlowerClient(
            lender_id=lender_id,
            data_dir=data_dir,
            preprocessor_path=prep_path,
            local_epochs=local_epochs,
            learning_rate=learning_rate,
            use_dp=use_dp,
            dp_noise_multiplier=dp_noise_multiplier,
            dp_max_grad_norm=dp_max_grad_norm,
        )

    # Initial global model parameters
    init_model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
    w, b = init_model.get_weights_and_bias()
    initial_parameters = ndarrays_to_parameters([w, np.array([b], dtype=np.float32)])

    eval_fn = get_evaluate_fn(test_df, preprocessor)

    # Strategy: FedAvg
    strategy = FedAvg(
        fraction_fit=1.0,
        fraction_evaluate=1.0,
        min_fit_clients=3,
        min_evaluate_clients=3,
        min_available_clients=3,
        initial_parameters=initial_parameters,
        evaluate_fn=eval_fn,
    )

    run_id = f"RUN-FL-{uuid.uuid4().hex[:8]}"
    start_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
    print(f"\n=======================================================")
    print(f"Starting Federated Training Run: {run_id}")
    print(f"Rounds: {num_rounds} | Simulated Clients: {len(client_ids)}")
    print(f"Strategy: FedAvg (Weighted Parameter Aggregation)")
    print(f"=======================================================\n")

    # Instantiate isolated client instances for each lender
    clients = {cid: client_fn(cid) for cid in client_ids}

    # Initial global model parameters
    current_weights, current_bias = init_model.get_weights_and_bias()
    current_parameters = [current_weights, np.array([current_bias], dtype=np.float32)]

    round_history = []
    final_loss = 0.0
    final_auc = 0.0
    final_f1 = 0.0

    # Multi-round federated training loop
    for rnd in range(1, num_rounds + 1):
        print(f"\n>>> [Round {rnd}/{num_rounds}] Coordinating Local Training Across 3 Lenders...")
        client_updates = []
        total_samples = 0
        last_client_metrics = {}

        # Each client trains strictly in its local environment
        for cid in client_ids:
            client = clients[cid]
            updated_params, num_samples, fit_metrics = client.fit(current_parameters, {"round": rnd})
            last_client_metrics[cid] = fit_metrics
            dp_tag = f" | DP eps: {fit_metrics['epsilon']:.2f}" if fit_metrics.get("dp_enabled") and "epsilon" in fit_metrics else ""
            print(f"  * {cid.upper()}: Trained on {num_samples} local records | Local Loss: {fit_metrics['train_loss']:.4f}{dp_tag}")
            client_updates.append((updated_params, num_samples))
            total_samples += num_samples

        # Server-side FedAvg Aggregation (Weighted by client sample count)
        aggregated_weights = np.zeros_like(current_parameters[0])
        aggregated_bias = 0.0

        for params, n_samples in client_updates:
            weight_factor = n_samples / max(1, total_samples)
            aggregated_weights += params[0] * weight_factor
            aggregated_bias += float(params[1][0]) * weight_factor

        current_parameters = [aggregated_weights, np.array([aggregated_bias], dtype=np.float32)]

        # Global Holdout Evaluation
        eval_loss, eval_metrics = eval_fn(rnd, current_parameters, {})
        final_loss = eval_loss
        final_auc = eval_metrics["roc_auc"]
        final_pr_auc = eval_metrics["pr_auc"]
        final_f1 = eval_metrics["f1_score"]
        final_prec = eval_metrics["precision"]
        final_rec = eval_metrics["recall"]
        final_brier = eval_metrics["brier_score"]

        round_history.append({
            "round": rnd,
            "loss": round(eval_loss, 4),
            "roc_auc": round(final_auc, 4),
            "pr_auc": round(final_pr_auc, 4),
            "f1_score": round(final_f1, 4),
            "precision": round(final_prec, 4),
            "recall": round(final_rec, 4),
            "brier_score": round(final_brier, 4),
        })

    completed_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
    privacy_mode = "dp" if use_dp else "none"

    final_metrics = {
        "model_type": f"Flower FedAvg (3 Clients){' + Opacus DP-SGD' if use_dp else ''}",
        "completed_rounds": num_rounds,
        "holdout_test_samples": len(test_df),
        "final_loss": round(final_loss, 4),
        "roc_auc": round(final_auc, 4),
        "pr_auc": round(final_pr_auc, 4),
        "f1_score": round(final_f1, 4),
        "precision": round(final_prec, 4),
        "recall": round(final_rec, 4),
        "brier_score": round(final_brier, 4),
        "participating_clients": client_ids,
        "privacy_mode": privacy_mode,
        "round_history": round_history,
    }

    if use_dp:
        client_eps = {cid: m.get("epsilon") for cid, m in last_client_metrics.items() if "epsilon" in m}
        max_eps = max(client_eps.values()) if client_eps else None
        final_metrics["differential_privacy"] = {
            "mechanism": "DP-SGD (Gaussian Noise + L2 Gradient Clipping)",
            "privacy_scope": "Sample-level Differential Privacy (Local Client DP-SGD)",
            "accountant_type": "Rényi Differential Privacy (RDPAccountant)",
            "noise_multiplier": dp_noise_multiplier,
            "max_grad_norm": dp_max_grad_norm,
            "target_delta": 1e-4,
            "cumulative_client_epsilons": client_eps,
            "cumulative_max_epsilon": round(max_eps, 4) if max_eps is not None else None,
            "secure_mode": False,
            "secure_mode_note": "Cryptographically non-secure PRNG used for prototype speed; production deployments require secure_mode=True with CS-PRNG.",
        }

    # Save final model artifact
    models_dir = os.path.join(artifacts_dir, "models")
    metrics_dir = os.path.join(artifacts_dir, "metrics")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(metrics_dir, exist_ok=True)

    artifact_filename = "federated_global_dp.pt" if use_dp else "federated_global_latest.pt"
    artifact_path = os.path.join(models_dir, artifact_filename)
    final_weights = current_parameters[0]
    final_bias = float(current_parameters[1][0])
    init_model.set_weights_and_bias(final_weights, final_bias)
    manifest = init_model.save_artifact(
        filepath=artifact_path,
        version=f"fl-global-{'dp-' if use_dp else ''}v{num_rounds}",
        training_run_id=run_id,
        metrics=final_metrics,
        feature_names=FEATURE_NAMES,
        privacy_mode=privacy_mode,
    )

    metrics_filename = "federated_run_dp_metrics.json" if use_dp else "federated_run_metrics.json"
    metrics_path = os.path.join(metrics_dir, metrics_filename)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(final_metrics, f, indent=2)

    # Persist in SQLite
    if os.path.exists(os.path.dirname(db_path)):
        import sqlite3
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO training_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id, "completed", start_time, completed_time, num_rounds, num_rounds,
            len(client_ids), "LogisticRegression", manifest["version"], privacy_mode, json.dumps(final_metrics)
        ))
        cur.execute("""
            INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f"AUDIT-{uuid.uuid4().hex[:8]}", completed_time, "FEDERATED_TRAINING_COMPLETED",
            "flower_coordinator", run_id, "SUCCESS", json.dumps({"rounds": num_rounds, "auc": final_auc, "privacy_mode": privacy_mode})
        ))
        conn.commit()
        conn.close()

    return {
        "run_id": run_id,
        "metrics": final_metrics,
        "model_manifest": manifest,
    }


def start_flower_grpc_server(
    server_address: str = "127.0.0.1:8089",
    num_rounds: int = 1,
    min_clients: int = 3,
):
    """
    Starts an authentic Flower gRPC server running on the main thread of its process.
    """
    strategy = FedAvg(
        fraction_fit=1.0,
        min_fit_clients=min_clients,
        min_available_clients=min_clients,
        fraction_evaluate=0.0,
        min_evaluate_clients=0,
    )
    fl.server.start_server(
        server_address=server_address,
        config=ServerConfig(num_rounds=num_rounds),
        strategy=strategy,
    )


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def get_last_log_lines(filepath: str, n: int = 50) -> List[str]:
    """Retrieves up to the last n lines from a log file."""
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
            return [l.rstrip() for l in lines[-n:]]
    except Exception:
        return []


def is_port_in_use(host: str, port: int) -> bool:
    """Checks whether a local port is already bound."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return False
        except OSError:
            return True


def aggregate_weighted_fedavg(
    client_updates: List[Dict[str, Any]],
) -> Tuple[np.ndarray, float]:
    """
    Weighted Federated Averaging across client updates according to sample counts.
    Each update contains: 'weights' (np.ndarray or list), 'bias' (float), 'num_samples' (int).
    Returns (aggregated_weights, aggregated_bias).
    """
    total_samples = sum(u["num_samples"] for u in client_updates)
    if total_samples <= 0:
        raise ValueError("Total samples across updates must be greater than zero.")

    first_w = np.array(client_updates[0]["weights"], dtype=np.float64).flatten()
    agg_weights = np.zeros_like(first_w, dtype=np.float64)
    agg_bias = 0.0

    for u in client_updates:
        weight_factor = float(u["num_samples"]) / float(total_samples)
        w_vec = np.array(u["weights"], dtype=np.float64).flatten()
        agg_weights += weight_factor * w_vec
        agg_bias += weight_factor * float(u["bias"])

    return agg_weights.astype(np.float32), float(agg_bias)


def compute_simulated_partner_update(
    partner_id: str,
    global_weights: np.ndarray,
    global_bias: float,
    data_dir: str,
    local_epochs: int = 1,
    learning_rate: float = 0.05,
    use_dp: bool = False,
) -> Dict[str, Any]:
    """
    Generates a genuine local update for a simulated partner lender from its local partition.
    Used during collaborative rounds when live officers submit updates.
    """
    csv_path = os.path.join(data_dir, partner_id, "train.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Training partition missing for partner {partner_id} at {csv_path}")

    df = pd.read_csv(csv_path)
    prep_path = os.path.join(data_dir, "preprocessor.json")
    if os.path.exists(prep_path):
        preprocessor = FeaturePreprocessor.load(prep_path)
    else:
        preprocessor = FeaturePreprocessor().fit(df)

    X_train = preprocessor.transform(df)
    y_train = df[TARGET_NAME].values.astype(np.float32)

    X_t = torch.from_numpy(X_train)
    y_t = torch.from_numpy(y_train)

    local_model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
    local_model.set_weights_and_bias(global_weights, global_bias)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.SGD(local_model.parameters(), lr=learning_rate)

    local_model.train()
    dataset = torch.utils.data.TensorDataset(X_t, y_t)
    loader = torch.utils.data.DataLoader(dataset, batch_size=32, shuffle=True)

    for _ in range(local_epochs):
        for bx, by in loader:
            optimizer.zero_grad()
            logits = local_model(bx)
            loss = criterion(logits, by)
            loss.backward()
            optimizer.step()

    w, b = local_model.get_weights_and_bias()
    return {
        "lender_id": partner_id,
        "weights": w.tolist(),
        "bias": float(b),
        "num_samples": len(df),
        "steps": len(loader) * local_epochs,
        "is_simulated": True,
    }


def run_genuine_flower_grpc(
    num_rounds: int = 1,
    server_address: str = "127.0.0.1:8089",
    data_dir: Optional[str] = None,
    local_epochs: int = 1,
    client_ids: Optional[List[str]] = None,
    server_readiness_timeout: float = 60.0,
    client_timeout: float = 300.0,
    timeout: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Executes authentic Flower server/client orchestration over gRPC across independent processes.
    Replaces subprocess.PIPE with dedicated log files, checks for port conflicts, uses project-root
    path resolution, and returns structured failure diagnostics.
    """
    import subprocess
    import socket
    import time
    from pathlib import Path

    if timeout is not None:
        client_timeout = timeout

    if client_ids is None:
        client_ids = ["lender_a", "lender_b", "lender_c"]

    # Resolve paths relative to project root
    resolved_root = Path(PROJECT_ROOT)
    resolved_data_dir = str(resolved_root / "backend" / "local_data") if data_dir is None else (
        str(Path(data_dir).resolve()) if os.path.isabs(data_dir) else str(resolved_root / data_dir)
    )

    logs_dir = resolved_root / "logs"
    os.makedirs(logs_dir, exist_ok=True)
    server_log_path = str(logs_dir / "fl_server.log")

    host, port_str = server_address.split(":")
    port_int = int(port_str)

    # 1. Detect if port is already bound
    if is_port_in_use(host, port_int):
        err_msg = f"gRPC port {port_int} on {host} is already in use by another process."
        return {
            "status": "failed",
            "failed_step": "server_start",
            "message": err_msg,
            "last_50_log_lines": [err_msg],
            "client_returncodes": {},
            "server_returncode": -1,
            "rounds_completed": 0,
        }

    # 2. Start Flower Server with dedicated log file
    server_cmd = [
        sys.executable,
        "-m",
        "backend.federation.server_app",
        "--mode",
        "server_only",
        "--server-address",
        server_address,
        "--rounds",
        str(num_rounds),
        "--min-clients",
        str(len(client_ids)),
    ]

    server_log_file = open(server_log_path, "w", encoding="utf-8")
    try:
        server_proc = subprocess.Popen(
            server_cmd,
            stdout=server_log_file,
            stderr=subprocess.STDOUT,
            cwd=str(resolved_root),
        )
    except Exception as e:
        server_log_file.close()
        return {
            "status": "failed",
            "failed_step": "server_start",
            "message": f"Failed to spawn Flower server process: {str(e)}",
            "last_50_log_lines": [str(e)],
            "client_returncodes": {},
            "server_returncode": -1,
            "rounds_completed": 0,
        }

    # 3. Wait for server socket to accept connections
    server_ready = False
    start_wait = time.time()
    while time.time() - start_wait < server_readiness_timeout:
        # Check if process died prematurely
        if server_proc.poll() is not None:
            break
        try:
            with socket.create_connection((host, port_int), timeout=0.5):
                server_ready = True
                break
        except (OSError, ConnectionRefusedError):
            time.sleep(0.3)

    if not server_ready:
        if server_proc.poll() is None:
            server_proc.kill()
        server_proc.wait()
        server_log_file.close()
        last_lines = get_last_log_lines(server_log_path, 50)
        combined = " ".join(last_lines).lower()
        failed_step = "out_of_memory" if ("memory" in combined or "oom" in combined) else "server_start"
        return {
            "status": "failed",
            "failed_step": failed_step,
            "message": f"Flower gRPC server failed to start on {server_address} within {server_readiness_timeout}s.",
            "last_50_log_lines": last_lines,
            "client_returncodes": {},
            "server_returncode": server_proc.returncode,
            "rounds_completed": 0,
        }

    # 4. Launch isolated Flower client processes with log files
    client_procs = []
    client_log_files = {}
    client_log_paths = {}

    for cid in client_ids:
        c_log_path = str(logs_dir / f"fl_client_{cid}.log")
        c_log_file = open(c_log_path, "w", encoding="utf-8")
        client_log_files[cid] = c_log_file
        client_log_paths[cid] = c_log_path

        client_cmd = [
            sys.executable,
            "-m",
            "backend.federation.client_app",
            "--lender-id",
            cid,
            "--server-address",
            server_address,
            "--data-dir",
            resolved_data_dir,
            "--epochs",
            str(local_epochs),
        ]
        try:
            cp = subprocess.Popen(
                client_cmd,
                stdout=c_log_file,
                stderr=subprocess.STDOUT,
                cwd=str(resolved_root),
            )
            client_procs.append((cid, cp))
        except Exception as e:
            c_log_file.write(f"Failed to spawn client {cid}: {str(e)}\n")
            c_log_file.close()

    # 5. Wait for all clients to finish
    client_statuses = {}
    client_failed_step = None
    problem_log_lines = []

    client_start_time = time.time()
    for cid, cp in client_procs:
        remaining = max(1.0, client_timeout - (time.time() - client_start_time))
        try:
            cp.wait(timeout=remaining)
            client_statuses[cid] = cp.returncode
        except subprocess.TimeoutExpired:
            cp.kill()
            cp.wait()
            client_statuses[cid] = -1
            client_failed_step = "timeout"

        # Close client log file
        client_log_files[cid].close()

        if client_statuses[cid] != 0 and not client_failed_step:
            c_lines = get_last_log_lines(client_log_paths[cid], 50)
            combined = " ".join(c_lines).lower()
            if "connection refused" in combined or "failed to connect" in combined:
                client_failed_step = "client_connect"
            elif "memory" in combined or "oom" in combined:
                client_failed_step = "out_of_memory"
            else:
                client_failed_step = "round_failed"
            problem_log_lines = c_lines

    # 6. Wait for server process to finish
    server_timeout_remaining = max(5.0, client_timeout - (time.time() - client_start_time))
    try:
        server_proc.wait(timeout=server_timeout_remaining)
        server_code = server_proc.returncode
    except subprocess.TimeoutExpired:
        server_proc.kill()
        server_proc.wait()
        server_code = -1
        if not client_failed_step:
            client_failed_step = "timeout"

    server_log_file.close()
    server_last_lines = get_last_log_lines(server_log_path, 50)

    success = (server_code == 0) and all(code == 0 for code in client_statuses.values())

    if not success and not client_failed_step:
        combined = " ".join(server_last_lines).lower()
        if "memory" in combined or "oom" in combined:
            client_failed_step = "out_of_memory"
        else:
            client_failed_step = "round_failed"

    reported_log_lines = problem_log_lines if problem_log_lines else server_last_lines

    return {
        "status": "completed" if success else "failed",
        "failed_step": None if success else client_failed_step,
        "mode": "flower_grpc_multiprocess",
        "server_address": server_address,
        "rounds_completed": num_rounds if success else 0,
        "server_returncode": server_code,
        "client_returncodes": client_statuses,
        "last_50_log_lines": reported_log_lines,
        "server_stderr_snippet": "\n".join(server_last_lines[-10:]) if server_last_lines else "",
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Flower Federated Coordinator for FedCreditX")
    parser.add_argument("--mode", choices=["sim", "grpc", "server_only"], default="sim", help="Execution mode")
    parser.add_argument("--rounds", type=int, default=5, help="Number of federated rounds")
    parser.add_argument("--epochs", type=int, default=3, help="Local epochs per round")
    parser.add_argument("--lr", type=float, default=0.02, help="Learning rate")
    parser.add_argument("--server-address", default="127.0.0.1:8089", help="gRPC address for server")
    parser.add_argument("--min-clients", type=int, default=3, help="Minimum clients for server_only mode")
    args = parser.parse_args()

    if args.mode == "server_only":
        start_flower_grpc_server(server_address=args.server_address, num_rounds=args.rounds, min_clients=args.min_clients)
    elif args.mode == "grpc":
        print(f"Starting genuine multi-process Flower gRPC federation on {args.server_address}...")
        res = run_genuine_flower_grpc(num_rounds=args.rounds, server_address=args.server_address, local_epochs=args.epochs)
        print("\nFlower gRPC Orchestration Result:")
        print(json.dumps(res, indent=2))
    else:
        result = run_federated_simulation(num_rounds=args.rounds, local_epochs=args.epochs, learning_rate=args.lr)
        print("\nFederated Simulation Completed Successfully!")
        print(json.dumps(result["metrics"], indent=2))
