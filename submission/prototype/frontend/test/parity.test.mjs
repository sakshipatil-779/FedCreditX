/**
 * Parity test verifying that JavaScript client-side feature preprocessing
 * matches Python scikit-learn / pandas FeaturePreprocessor transformation
 * to within 1e-6 precision across all features on 20 synthetic sample rows.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function preprocessRow(rawValues, preprocessor) {
  const featureNames = preprocessor.feature_names;
  const result = new Array(featureNames.length);

  for (let j = 0; j < featureNames.length; j++) {
    const feat = featureNames[j];
    const val = Array.isArray(rawValues) ? rawValues[j] : rawValues[feat];
    const mean = preprocessor.means[feat] ?? 0;
    const std = preprocessor.stds[feat] ?? 1;
    const safeStd = Math.abs(std) < 1e-7 ? 1.0 : std;
    result[j] = (val - mean) / safeStd;
  }

  return result;
}

test('JavaScript vs Python Feature Preprocessing Parity Test (20 sample rows, tolerance < 1e-6)', () => {
  const fixturePath = path.join(__dirname, 'parity_fixture.json');
  assert.ok(fs.existsSync(fixturePath), 'Fixture file parity_fixture.json must exist');

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const { preprocessor, raw_rows, expected_transformed } = fixture;

  assert.equal(raw_rows.length, 20, 'Fixture must contain exactly 20 sample rows');
  assert.equal(expected_transformed.length, 20, 'Fixture must contain 20 transformed rows');

  for (let i = 0; i < raw_rows.length; i++) {
    const jsTransformed = preprocessRow(raw_rows[i], preprocessor);
    const pyTransformed = expected_transformed[i];

    assert.equal(
      jsTransformed.length,
      preprocessor.feature_names.length,
      `Row ${i} must have ${preprocessor.feature_names.length} features`
    );

    for (let f = 0; f < preprocessor.feature_names.length; f++) {
      const featName = preprocessor.feature_names[f];
      const diff = Math.abs(jsTransformed[f] - pyTransformed[f]);

      assert.ok(
        diff < 1e-6,
        `Discrepancy in row ${i}, feature ${featName}: JS=${jsTransformed[f]}, Py=${pyTransformed[f]}, diff=${diff}`
      );
    }
  }

  console.log(`Parity test passed: 20 rows x ${preprocessor.feature_names.length} features verified within 1e-6.`);
});
