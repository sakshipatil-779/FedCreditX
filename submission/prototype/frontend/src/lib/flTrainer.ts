/**
 * Client-Side Federated Learning Trainer for FedCreditX.
 *
 * Implements browser-based preprocessing using coordinator-supplied feature parameters
 * and local SGD optimization on Binary Cross-Entropy (BCE) loss for logistic regression.
 * Raw applicant records never leave the client's browser.
 *
 * Note: Browser-side Differential Privacy (DP-SGD with Opacus accountant) is planned for future work.
 */

export interface FLPreprocessorParams {
  feature_names: string[];
  means: Record<string, number>;
  stds: Record<string, number>;
  fitted?: boolean;
}

export interface FLConfig {
  round_id: string;
  feature_names: string[];
  target_name: string;
  preprocessor: FLPreprocessorParams;
  learning_rate: number;
  local_epochs: number;
  min_clients: number;
  max_update_norm: number;
}

export interface FLGlobalModel {
  round_id: string;
  version: string;
  feature_names: string[];
  weights: number[];
  bias: number;
  status: string;
}

export interface FLTrainInput {
  X: number[][]; // N records by numFeatures
  y: number[];   // N labels (0 or 1)
  initialWeights: number[];
  initialBias: number;
  learningRate: number;
  epochs: number;
  batchSize?: number;
  onProgress?: (progress: number, epoch: number) => void;
}

export interface FLTrainResult {
  weights: number[];
  bias: number;
  steps: number;
  num_samples: number;
}

/**
 * Normalizes a single row of raw feature values using coordinator preprocessor parameters.
 * Formula: (val - mean) / (std < 1e-7 ? 1.0 : std)
 */
export function preprocessRow(
  rawValues: Record<string, number> | number[],
  preprocessor: FLPreprocessorParams
): number[] {
  const featureNames = preprocessor.feature_names;
  const result: number[] = new Array(featureNames.length);

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

/**
 * Normalizes an array of raw applicant records according to coordinator parameters.
 */
export function preprocessRows(
  rows: (Record<string, number> | number[])[],
  preprocessor: FLPreprocessorParams
): number[][] {
  return rows.map((r) => preprocessRow(r, preprocessor));
}

/**
 * Executes local mini-batch SGD on binary cross-entropy loss.
 *
 * p = 1 / (1 + exp(-clip(w^T * x + b, -20, 20)))
 * grad_w = (1/B) * sum((p - y) * x)
 * grad_b = (1/B) * sum(p - y)
 */
export function trainLogisticRegressionSGD(input: FLTrainInput): FLTrainResult {
  const {
    X,
    y,
    initialWeights,
    initialBias,
    learningRate,
    epochs,
    batchSize = 16,
    onProgress,
  } = input;

  const N = X.length;
  if (N === 0) {
    throw new Error("Cannot train on an empty dataset.");
  }
  const numFeatures = initialWeights.length;

  const weights = [...initialWeights];
  let bias = initialBias;
  let totalSteps = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Shuffle indices for stochastic batching
    const indices = Array.from({ length: N }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let start = 0; start < N; start += batchSize) {
      const batchIndices = indices.slice(start, Math.min(start + batchSize, N));
      const B = batchIndices.length;

      const gradW = new Array(numFeatures).fill(0);
      let gradB = 0;

      for (const idx of batchIndices) {
        const x_i = X[idx];
        const y_i = y[idx];

        let z = bias;
        for (let j = 0; j < numFeatures; j++) {
          z += weights[j] * x_i[j];
        }

        const clampedZ = Math.max(-20, Math.min(20, z));
        const p = 1.0 / (1.0 + Math.exp(-clampedZ));
        const err = p - y_i;

        for (let j = 0; j < numFeatures; j++) {
          gradW[j] += err * x_i[j];
        }
        gradB += err;
      }

      // Update parameters
      for (let j = 0; j < numFeatures; j++) {
        weights[j] -= (learningRate * gradW[j]) / B;
      }
      bias -= (learningRate * gradB) / B;
      totalSteps++;
    }

    if (onProgress) {
      const progressPercent = Math.round(((epoch + 1) / epochs) * 100);
      onProgress(progressPercent, epoch + 1);
    }
  }

  return {
    weights,
    bias,
    steps: totalSteps,
    num_samples: N,
  };
}
