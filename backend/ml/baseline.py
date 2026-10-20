"""
Centralized Baseline Training Script for FedCreditX.

Trains a non-deep-learning PyTorch Logistic Regression model on pooled synthetic data
from all three simulated lenders and evaluates on the central held-out test set.
Records AUROC, Precision, Recall, F1, Confusion Matrix, and saves baseline model artifact.
Adheres to FR-03 and 08_TECHNICAL_ARCHITECTURE.md.
"""

import os
import json
import argparse
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score, confusion_matrix, brier_score_loss

import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES, TARGET_NAME
from backend.ml.model import LogisticRegressionCreditModel


def train_centralized_baseline(
    data_dir: str = "backend/local_data",
    artifacts_dir: str = "backend/artifacts",
    epochs: int = 40,
    lr: float = 0.02,
    batch_size: int = 64,
    seed: int = 42,
) -> dict:
    """
    Trains the pooled synthetic baseline and evaluates on the held-out test partition.
    """
    torch.manual_seed(seed)
    np.random.seed(seed)

    # 1. Load and pool client partitions (using the identical 80% training split: 960 rows per lender, total 2,880)
    lenders = ["lender_a", "lender_b", "lender_c"]
    dfs = []
    for l in lenders:
        path = os.path.join(data_dir, l, "train.csv")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Partition missing: {path}. Run generate_synthetic.py first.")
        df = pd.read_csv(path)
        split_idx = int(0.8 * len(df))
        dfs.append(df.iloc[:split_idx])

    pooled_train_df = pd.concat(dfs, ignore_index=True)

    # 2. Fit shared preprocessor strictly on the pooled training split (no leakage from holdout test)
    preprocessor = FeaturePreprocessor(FEATURE_NAMES)
    preprocessor.fit(pooled_train_df)
    preprocessor_path = os.path.join(data_dir, "preprocessor.json")
    preprocessor.save(preprocessor_path)

    # 3. Transform training and held-out test sets
    X_train_np = preprocessor.transform(pooled_train_df)
    y_train_np = pooled_train_df[TARGET_NAME].values.astype(np.float32)

    test_path = os.path.join(data_dir, "holdout_test", "test.csv")
    if not os.path.exists(test_path):
        raise FileNotFoundError(f"Holdout test partition missing: {test_path}")
    test_df = pd.read_csv(test_path)
    X_test_np = preprocessor.transform(test_df)
    y_test_np = test_df[TARGET_NAME].values.astype(np.float32)

    # Convert to PyTorch Tensors
    X_train = torch.from_numpy(X_train_np)
    y_train = torch.from_numpy(y_train_np)
    X_test = torch.from_numpy(X_test_np)
    y_test = torch.from_numpy(y_test_np)

    train_dataset = TensorDataset(X_train, y_train)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    # 4. Instantiate Logistic Regression Model
    model = LogisticRegressionCreditModel(in_features=len(FEATURE_NAMES))
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    # 5. Training loop
    model.train()
    history = []
    for epoch in range(1, epochs + 1):
        epoch_loss = 0.0
        batches = 0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            batches += 1

        avg_loss = epoch_loss / max(1, batches)
        history.append({"epoch": epoch, "loss": round(avg_loss, 4)})

    # 6. Evaluation on held-out test partition
    model.eval()
    with torch.no_grad():
        test_logits = model(X_test)
        test_loss = criterion(test_logits, y_test).item()
        test_probs = torch.sigmoid(test_logits).numpy()

    from sklearn.metrics import average_precision_score

    # Thresholding & Metrics
    threshold = 0.50
    test_preds = (test_probs >= threshold).astype(int)

    auc = float(roc_auc_score(y_test_np, test_probs))
    pr_auc = float(average_precision_score(y_test_np, test_probs))
    prec = float(precision_score(y_test_np, test_preds, zero_division=0))
    rec = float(recall_score(y_test_np, test_preds, zero_division=0))
    f1 = float(f1_score(y_test_np, test_preds, zero_division=0))
    brier = float(brier_score_loss(y_test_np, test_probs))
    cm = confusion_matrix(y_test_np, test_preds).tolist()
    class_prevalence = float(np.mean(y_test_np))

    metrics = {
        "model_type": "PyTorch Logistic Regression (Centralized Baseline)",
        "train_samples": len(pooled_train_df),
        "test_samples": len(test_df),
        "class_prevalence": round(class_prevalence, 4),
        "decision_threshold": threshold,
        "test_loss": round(test_loss, 4),
        "roc_auc": round(auc, 4),
        "pr_auc": round(pr_auc, 4),
        "f1_score": round(f1, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "brier_score": round(brier, 4),
        "confusion_matrix": {
            "tn": cm[0][0],
            "fp": cm[0][1],
            "fn": cm[1][0],
            "tp": cm[1][1],
        },
        "epochs": epochs,
        "final_train_loss": round(history[-1]["loss"], 4),
    }

    # 7. Save Model Checkpoint & Metrics
    models_dir = os.path.join(artifacts_dir, "models")
    metrics_dir = os.path.join(artifacts_dir, "metrics")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(metrics_dir, exist_ok=True)

    model_path = os.path.join(models_dir, "centralized_baseline.pt")
    manifest = model.save_artifact(
        filepath=model_path,
        version="baseline-v1.0",
        training_run_id="run-centralized-baseline",
        metrics=metrics,
        feature_names=FEATURE_NAMES,
        privacy_mode="none",
    )

    metrics_path = os.path.join(metrics_dir, "centralized_baseline_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    return {
        "metrics": metrics,
        "model_manifest": manifest,
        "preprocessor_path": preprocessor_path,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train centralized baseline credit model")
    parser.add_argument("--data-dir", type=str, default="backend/local_data")
    parser.add_argument("--artifacts-dir", type=str, default="backend/artifacts")
    parser.add_argument("--epochs", type=int, default=40)
    args = parser.parse_args()

    result = train_centralized_baseline(
        data_dir=args.data_dir,
        artifacts_dir=args.artifacts_dir,
        epochs=args.epochs,
    )
    print("Baseline Training Succeeded!")
    print(json.dumps(result["metrics"], indent=2))
