"""
Tests for Synthetic Dataset Generation and Preprocessing (FR-01, FR-02).
"""

import os
import json
import unittest
import tempfile
import shutil
import numpy as np
import pandas as pd

from backend.data.generate_synthetic import (
    generate_all_datasets,
    validate_dataframe,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    FEATURE_BOUNDS,
)
from backend.ml.preprocessing import FeaturePreprocessor


class TestDataAndPreprocessing(unittest.TestCase):
    """Unit tests for synthetic data generation and preprocessor scaling."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_synthetic_data_generation_reproducibility(self):
        """Verifies that fixed seeds generate bitwise-identical datasets."""
        dir1 = os.path.join(self.temp_dir, "run1")
        dir2 = os.path.join(self.temp_dir, "run2")

        res1 = generate_all_datasets(output_base_dir=dir1, seed=42, samples_per_lender=200, holdout_samples=150)
        res2 = generate_all_datasets(output_base_dir=dir2, seed=42, samples_per_lender=200, holdout_samples=150)

        # Check identical metrics
        for lender in ["lender_a", "lender_b", "lender_c"]:
            self.assertEqual(res1["partitions"][lender]["default_rate"], res2["partitions"][lender]["default_rate"])
            df1 = pd.read_csv(res1["partitions"][lender]["train_csv"])
            df2 = pd.read_csv(res2["partitions"][lender]["train_csv"])
            pd.testing.assert_frame_equal(df1, df2)

    def test_schema_conformance_and_no_missing_values(self):
        """Verifies all columns exist, bounds are respected, and no nulls/NaNs occur."""
        out_dir = os.path.join(self.temp_dir, "data")
        res = generate_all_datasets(output_base_dir=out_dir, seed=99, samples_per_lender=100, holdout_samples=100)

        for lender in ["lender_a", "lender_b", "lender_c"]:
            csv_path = res["partitions"][lender]["train_csv"]
            df = pd.read_csv(csv_path)
            self.assertEqual(len(df), 100)
            validate_dataframe(df)

            for col in FEATURE_COLUMNS:
                low, high = FEATURE_BOUNDS[col]
                self.assertGreaterEqual(df[col].min(), low)
                self.assertLessEqual(df[col].max(), high)
                self.assertFalse(df[col].isnull().any())

            # Check binary target
            self.assertTrue(set(df[TARGET_COLUMN].unique()).issubset({0, 1}))

    def test_preprocessor_fit_transform_cycle(self):
        """Verifies standard scaling, persistence, and single-record transformation."""
        out_dir = os.path.join(self.temp_dir, "data")
        res = generate_all_datasets(output_base_dir=out_dir, seed=123, samples_per_lender=150, holdout_samples=100)

        lender_a_path = res["partitions"]["lender_a"]["train_csv"]
        df_a = pd.read_csv(lender_a_path)
        preprocessor = FeaturePreprocessor(FEATURE_COLUMNS)
        preprocessor.fit(df_a)

        scaled_arr = preprocessor.transform(df_a)
        self.assertEqual(scaled_arr.shape, (150, len(FEATURE_COLUMNS)))
        self.assertEqual(scaled_arr.dtype, np.float32)

        # Scaled columns should have approximately zero mean and unit variance
        self.assertTrue(np.allclose(np.mean(scaled_arr, axis=0), 0.0, atol=1e-5))
        self.assertTrue(np.allclose(np.std(scaled_arr, axis=0), 1.0, atol=1e-5))

        # Save and reload
        save_file = os.path.join(self.temp_dir, "preprocessor.json")
        preprocessor.save(save_file)
        reloaded = FeaturePreprocessor.load(save_file)

        # Single-record transformation
        single_record = {col: float(df_a[col].iloc[0]) for col in FEATURE_COLUMNS}
        single_scaled = reloaded.transform_single(single_record)
        self.assertEqual(single_scaled.shape, (1, len(FEATURE_COLUMNS)))
        self.assertTrue(np.allclose(single_scaled[0], scaled_arr[0], atol=1e-5))

    def test_preprocessor_rejects_missing_or_invalid_features(self):
        """Verifies error handling on schema violation or NaN/Inf input."""
        preprocessor = FeaturePreprocessor(FEATURE_COLUMNS)
        df_valid = pd.DataFrame({col: [1.0, 2.0] for col in FEATURE_COLUMNS})
        preprocessor.fit(df_valid)

        # Missing feature
        incomplete_dict = {col: 1.0 for col in FEATURE_COLUMNS[:-1]}
        with self.assertRaises(ValueError) as ctx:
            preprocessor.transform_single(incomplete_dict)
        self.assertIn("Missing required features", str(ctx.exception))

        # NaN input
        nan_dict = {col: 1.0 for col in FEATURE_COLUMNS}
        nan_dict["debt_to_income_ratio"] = float("nan")
        with self.assertRaises(ValueError) as ctx:
            preprocessor.transform_single(nan_dict)
        self.assertIn("contains NaN or Inf", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()

