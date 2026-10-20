# 11 — Validation and Test Plan

## Test philosophy

Test what the application actually does, not what its UI says it does. Every claim about federated training, privacy, explainability, or performance must have a reproducible test or be marked unverified.

## Model/data tests

- Synthetic generator is deterministic for a fixed seed.
- Each of the three partitions has the expected columns and a valid binary target.
- Train/test partitioning prevents accidental reuse of holdout rows in training.
- Preprocessing is fit consistently and the feature order is identical across clients/inference.
- Missing, extra, nonnumeric, NaN, infinite, or out-of-range values are handled safely.
- PyTorch model produces finite logits/probabilities in [0, 1] for valid cases.
- Training loss and metrics are finite.
- Saved and reloaded weights reproduce predictions within a numerical tolerance.

## Federated learning tests

- One smoke test completes a real Flower federation involving three simulated clients.
- Logs show that each client performed local training and the server aggregated updates.
- A client never sends raw dataset rows to the aggregator/API.
- The resulting global model artifact is saved and versioned.
- A second run can load/score with the saved model.
- Failure in one client results in a failed/partial run state, not false “completed.”
- Compare centralized baseline and federated model using a clearly defined common synthetic holdout and metrics.
- Report ROC-AUC, precision, recall, F1, confusion matrix, class prevalence, and threshold. Do not overinterpret any one metric.
- Record seed, client partition strategy, rounds, optimizer settings, feature schema, and package versions.

## Differential privacy tests (when implemented)

- DP mode changes the local training implementation; it is not a UI-only flag.
- Confirm Opacus PrivacyEngine is actually used in the client training path.
- Record noise multiplier, max gradient norm, delta, sampling/step configuration, and valid privacy accountant output.
- Compare model metrics and convergence with DP on/off under repeatable configurations.
- If the privacy guarantee/accounting cannot be validated, mark this test failed/experimental and remove formal guarantee language.

## Secure aggregation tests (when implemented)

- Run the current documented Flower SecAgg+ workflow in the selected architecture.
- Confirm clients/server complete the protocol and aggregation yields a usable model.
- Test failure when a client does not participate or the protocol does not complete.
- Do not infer cryptographic correctness from a green status label alone; cite the official implementation example and record the integration smoke-test result.
- If not completed, explicitly record as “not implemented” in README and UI.

## Explainability tests

- Explanation corresponds to the same saved model and prediction returned to the UI.
- Top contributions/reasons are deterministic within expected numerical tolerance for the same input/version.
- The displayed direction (increases/decreases model output) matches the chosen explanation semantics.
- If SHAP fails and reason codes are used, the UI names the method correctly; it must not say “SHAP” when only a template is shown.
- Explanatory text contains no fabricated features or conclusions unsupported by attribution values.
- UI warns that attribution is not causality or proof of fairness.

## API/database tests

- Health endpoint succeeds.
- Invalid request schemas return 4xx responses.
- Unknown run/case IDs return a clear 404/4xx.
- Starting a run returns a run ID and status; polling yields the actual terminal state.
- Database initialization works from a clean state.
- Training, scoring, and review events persist and can be retrieved.
- Audit payloads and logs do not contain raw feature vectors, actual identifiers, secrets, or training rows.
- Backend failures return sanitized errors rather than tracebacks to the browser.

## Frontend/manual tests

- Empty state before first run.
- Loading state while training is active; no fake progress.
- Completed and failed run states.
- Scoring disabled or explained when no model is available.
- Applicant selector shows synthetic IDs only.
- Results show probability/risk band, model version, explanation method, and limitations.
- Human-review submission creates an audit event.
- Keyboard navigation, visible focus, labels, contrast, and responsive behavior.
- Test with a person who has not heard the pitch; record task, time/hesitation, misunderstanding, and changes made.

## Break-it tests required by HackFront workflow

1. Empty input.
2. A very long/oversized input.
3. Unsupported or malformed field/type.
4. Missing model artifact.
5. Client or Flower runtime failure.
6. Invalid privacy configuration.
7. Database write error where practical.

For each, record expected behavior, observed behavior, pass/fail, and fix/known issue.

## Go/no-go checklist

**Go** only if the core federated training flow is real, the result can be reproduced, the score is correctly labelled, explanation matches the model, audit trail works, and no actual/sensitive data is used.

**No-go / narrow scope** if federation remains mocked, explanations are fake, metrics are hard-coded, the UI overclaims privacy, or test failures cannot be fixed. In that case, present a smaller working prototype and clearly list unimplemented features.

## Metrics interpretation rules

- Synthetic results show technical feasibility only.
- A better metric on one synthetic split does not prove production superiority.
- Use the same holdout and thresholding rule for fair comparison where applicable.
- Include class imbalance and random seed in report.
- If comparing DP vs non-DP, run comparable settings and report actual run configuration.
