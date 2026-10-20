"""
FedCreditX Deterministic Synthetic Credit Dataset Generator.

Generates reproducible synthetic credit data partitioned across three simulated lenders
(Lender A, Lender B, Lender C) plus a held-out test set.

Strictly excludes real PII, customer identifiers, or protected demographic attributes.
Adheres to 09_DATA_MODEL.md and FR-01/FR-02 requirements.
"""

import os
import json
import argparse
import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "monthly_income_band_value",
    "debt_to_income_ratio",
    "late_payment_count_12m",
    "credit_utilization_ratio",
    "income_variability",
    "loan_amount_to_income",
    "account_history_months",
    "utility_payment_consistency",
]

TARGET_COLUMN = "defaulted"

FEATURE_BOUNDS = {
    "monthly_income_band_value": (1000.0, 50000.0),
    "debt_to_income_ratio": (0.01, 1.50),
    "late_payment_count_12m": (0, 12),
    "credit_utilization_ratio": (0.00, 1.50),
    "income_variability": (0.00, 1.00),
    "loan_amount_to_income": (0.10, 15.00),
    "account_history_months": (1, 360),
    "utility_payment_consistency": (0.00, 1.00),
}


def compute_latent_default_prob(df: pd.DataFrame, rng: np.random.Generator) -> np.ndarray:
    """
    Computes ground-truth logistic default probability from synthetic risk features
    plus modest stochastic perturbation.
    """
    log_income = np.log(np.clip(df["monthly_income_band_value"].values, 1000.0, 50000.0) / 1000.0)
    dti = df["debt_to_income_ratio"].values
    lates = df["late_payment_count_12m"].values
    util = df["credit_utilization_ratio"].values
    variability = df["income_variability"].values
    loan_to_inc = df["loan_amount_to_income"].values
    history = df["account_history_months"].values / 12.0  # in years
    utility_score = df["utility_payment_consistency"].values

    # Latent linear risk score (higher = higher default probability)
    z = (
        -2.0
        - 0.55 * log_income
        + 1.80 * dti
        + 0.50 * lates
        + 1.25 * util
        + 0.90 * variability
        + 0.35 * loan_to_inc
        - 0.12 * history
        - 0.80 * utility_score
        + rng.normal(0.0, 0.25, size=len(df))  # modest unobserved noise
    )

    probs = 1.0 / (1.0 + np.exp(-z))
    return probs


def generate_partition(
    lender_type: str,
    n_samples: int,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """
    Generates synthetic borrower records tailored to each lender's market profile (realistic non-IID partitions).
    - Lender A: Prime commercial bank (higher income, lower DTI, seasoned history)
    - Lender B: Near-prime / consumer finance (mid income, higher credit utilization)
    - Lender C: Digital / FinTech lender (younger accounts, higher income variability, non-traditional profiles)
    - Central Holdout: Representative mixture of all profiles
    """
    if lender_type == "lender_a":  # Prime / Conservative
        income = rng.lognormal(mean=8.7, sigma=0.4, size=n_samples)  # mean ~$6,500
        dti = rng.beta(a=2.0, b=5.0, size=n_samples) * 0.7 + 0.05
        late_probs = [0.80, 0.14, 0.04, 0.015, 0.005]
        late_count = rng.choice(5, size=n_samples, p=late_probs)
        utilization = rng.beta(a=2.0, b=4.0, size=n_samples) * 0.8
        variability = rng.beta(a=1.5, b=5.0, size=n_samples) * 0.5
        loan_to_inc = rng.gamma(shape=3.0, scale=0.8, size=n_samples) + 0.5
        history_months = rng.integers(low=24, high=240, size=n_samples)
        utility = rng.beta(a=6.0, b=2.0, size=n_samples)

    elif lender_type == "lender_b":  # Near-prime / High Utilization
        income = rng.lognormal(mean=8.2, sigma=0.5, size=n_samples)  # mean ~$4,000
        dti = rng.beta(a=3.0, b=4.0, size=n_samples) * 0.8 + 0.10
        late_probs = [0.55, 0.25, 0.12, 0.05, 0.03]
        late_count = rng.choice(5, size=n_samples, p=late_probs)
        utilization = rng.beta(a=4.0, b=2.5, size=n_samples) * 0.95 + 0.05
        variability = rng.beta(a=2.5, b=3.5, size=n_samples) * 0.7
        loan_to_inc = rng.gamma(shape=3.5, scale=1.0, size=n_samples) + 0.8
        history_months = rng.integers(low=12, high=160, size=n_samples)
        utility = rng.beta(a=4.0, b=3.0, size=n_samples)

    elif lender_type == "lender_c":  # FinTech / Thin-file / Variable
        income = rng.lognormal(mean=8.0, sigma=0.6, size=n_samples)  # mean ~$3,500
        dti = rng.beta(a=2.5, b=4.0, size=n_samples) * 0.8 + 0.08
        late_probs = [0.65, 0.20, 0.09, 0.04, 0.02]
        late_count = rng.choice(5, size=n_samples, p=late_probs)
        utilization = rng.beta(a=2.5, b=3.0, size=n_samples) * 0.85
        variability = rng.beta(a=3.5, b=2.5, size=n_samples) * 0.9  # high variability (gig/contract)
        loan_to_inc = rng.gamma(shape=2.5, scale=1.1, size=n_samples) + 0.6
        history_months = rng.integers(low=6, high=90, size=n_samples)  # shorter histories
        utility = rng.beta(a=4.0, b=3.0, size=n_samples)

    else:  # Representative balanced mix for holdout test
        sub_n = n_samples // 3
        rem = n_samples - sub_n * 2
        df_a = generate_partition("lender_a", sub_n, rng)
        df_b = generate_partition("lender_b", sub_n, rng)
        df_c = generate_partition("lender_c", rem, rng)
        return pd.concat([df_a, df_b, df_c], ignore_index=True)

    df = pd.DataFrame({
        "monthly_income_band_value": np.round(np.clip(income, 1200.0, 45000.0), 2),
        "debt_to_income_ratio": np.round(np.clip(dti, 0.02, 1.20), 4),
        "late_payment_count_12m": late_count.astype(int),
        "credit_utilization_ratio": np.round(np.clip(utilization, 0.01, 1.10), 4),
        "income_variability": np.round(np.clip(variability, 0.01, 0.99), 4),
        "loan_amount_to_income": np.round(np.clip(loan_to_inc, 0.20, 10.0), 4),
        "account_history_months": history_months.astype(int),
        "utility_payment_consistency": np.round(np.clip(utility, 0.05, 0.99), 4),
    })

    probs = compute_latent_default_prob(df, rng)
    df[TARGET_COLUMN] = (rng.uniform(size=len(df)) < probs).astype(int)
    return df


def validate_dataframe(df: pd.DataFrame) -> None:
    """Verifies schema conformance, bounds, and absence of NaN/infinite values."""
    for col in FEATURE_COLUMNS:
        assert col in df.columns, f"Missing required column: {col}"
        assert not df[col].isnull().any(), f"NaN values detected in {col}"
        assert not np.isinf(df[col]).any(), f"Infinite values detected in {col}"
        low, high = FEATURE_BOUNDS[col]
        assert (df[col] >= low).all(), f"Values below minimum bound in {col}"
        assert (df[col] <= high).all(), f"Values above maximum bound in {col}"

    assert TARGET_COLUMN in df.columns, f"Missing target column: {TARGET_COLUMN}"
    assert set(df[TARGET_COLUMN].unique()).issubset({0, 1}), "Target must be binary 0 or 1"


def generate_all_datasets(
    output_base_dir: str = "backend/local_data",
    seed: int = 42,
    samples_per_lender: int = 1200,
    holdout_samples: int = 900,
) -> dict:
    """
    Generates all client partitions and demo inference cases deterministically.
    """
    rng = np.random.Generator(np.random.PCG64(seed))
    os.makedirs(output_base_dir, exist_ok=True)

    summary = {"seed": seed, "partitions": {}}
    lenders = ["lender_a", "lender_b", "lender_c"]

    for lender in lenders:
        lender_dir = os.path.join(output_base_dir, lender)
        os.makedirs(lender_dir, exist_ok=True)

        df = generate_partition(lender, samples_per_lender, rng)
        validate_dataframe(df)

        train_path = os.path.join(lender_dir, "train.csv")
        df.to_csv(train_path, index=False)

        # Generate 10 curated synthetic demo test cases for interactive scoring
        demo_df = generate_partition(lender, 10, rng)
        validate_dataframe(demo_df)
        demo_cases = []
        lender_code = lender[-1].upper()
        for idx, row in demo_df.iterrows():
            case_id = f"DEMO-{lender_code}-{idx+1:03d}"
            case_data = {
                "case_id": case_id,
                "lender_id": lender,
                "features": {col: float(row[col]) if isinstance(row[col], (np.floating, float)) else int(row[col]) for col in FEATURE_COLUMNS},
                "ground_truth_default": int(row[TARGET_COLUMN]),
            }
            demo_cases.append(case_data)

        demo_path = os.path.join(lender_dir, "demo_cases.json")
        with open(demo_path, "w", encoding="utf-8") as f:
            json.dump(demo_cases, f, indent=2)

        summary["partitions"][lender] = {
            "samples": len(df),
            "default_rate": float(df[TARGET_COLUMN].mean()),
            "train_csv": train_path,
            "demo_cases_count": len(demo_cases),
        }

    # Generate held-out test partition
    test_dir = os.path.join(output_base_dir, "holdout_test")
    os.makedirs(test_dir, exist_ok=True)
    test_df = generate_partition("holdout", holdout_samples, rng)
    validate_dataframe(test_df)
    test_path = os.path.join(test_dir, "test.csv")
    test_df.to_csv(test_path, index=False)

    summary["partitions"]["holdout_test"] = {
        "samples": len(test_df),
        "default_rate": float(test_df[TARGET_COLUMN].mean()),
        "test_csv": test_path,
    }

    # Write schema manifest
    schema_manifest = {
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "bounds": FEATURE_BOUNDS,
        "seed": seed,
        "summary": summary,
    }
    schema_path = os.path.join(output_base_dir, "schema_manifest.json")
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(schema_manifest, f, indent=2)

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic partitions for FedCreditX")
    parser.add_argument("--output-dir", type=str, default="backend/local_data", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Fixed random seed")
    parser.add_argument("--samples", type=int, default=1200, help="Samples per lender")
    parser.add_argument("--holdout", type=int, default=900, help="Holdout test samples")
    args = parser.parse_args()

    result = generate_all_datasets(
        output_base_dir=args.output_dir,
        seed=args.seed,
        samples_per_lender=args.samples,
        holdout_samples=args.holdout,
    )
    print("Synthetic dataset generation complete!")
    print(json.dumps(result, indent=2))
