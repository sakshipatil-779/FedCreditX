"""
Generates synthetic fixture for JS vs Python preprocessing parity testing.
Uses synthetic partitions only (no real customer data).
"""

import os
import json
import pandas as pd
import numpy as np

from backend.ml.preprocessing import FeaturePreprocessor, FEATURE_NAMES

def main():
    data_dir = "backend/local_data"
    prep_path = os.path.join(data_dir, "preprocessor.json")
    train_path = os.path.join(data_dir, "lender_a", "train.csv")

    assert os.path.exists(prep_path), f"Missing {prep_path}"
    assert os.path.exists(train_path), f"Missing {train_path}"

    preprocessor = FeaturePreprocessor.load(prep_path)
    df = pd.read_csv(train_path)

    # Take 20 rows
    sample_df = df.head(20)[FEATURE_NAMES]
    transformed = preprocessor.transform(sample_df)

    fixture = {
        "preprocessor": {
            "feature_names": FEATURE_NAMES,
            "means": preprocessor.means,
            "stds": preprocessor.stds,
        },
        "raw_rows": sample_df.to_dict(orient="records"),
        "expected_transformed": transformed.tolist(),
    }

    out_dir = "frontend/test"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "parity_fixture.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixture, f, indent=2)

    print(f"Generated {out_path} with {len(fixture['raw_rows'])} rows.")

if __name__ == "__main__":
    main()
