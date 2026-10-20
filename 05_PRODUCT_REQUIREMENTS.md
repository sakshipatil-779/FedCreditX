# 05 — Product Requirements

## Requirement conventions

- **P0:** must be implemented for the core demo.
- **P1:** expected if the P0 path is stable.
- **P2:** stretch; only call it complete after tests pass.
- Every success criterion must be observable, not just described in the UI.

## Functional requirements

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-01 | P0 | Generate deterministic synthetic lender datasets. | One command creates three different local partitions with consistent features and a binary default label; fixed random seed reproduces the result. |
| FR-02 | P0 | Enforce a shared feature schema. | Training and inference reject missing, extra, nonnumeric, NaN, or infinite required values with a clear error or documented preprocessing. |
| FR-03 | P0 | Train a centralized baseline for comparison. | A script records dataset split, seed, metrics, and model version; the held-out test data is synthetic. |
| FR-04 | P0 | Run a real Flower federated-training round. | At least three simulated clients participate; client-side training and server-side aggregation are logged; no raw training rows are sent to the coordinator. |
| FR-05 | P0 | Store training-run metadata. | Run status, rounds, timestamps, model version, client count, metrics, and privacy settings are persisted in SQLite. |
| FR-06 | P0 | Score a synthetic applicant through a selected simulated lender. | The selected lender's local demo case is scored by the current model; output contains probability, demo risk band, model version, and timestamp. |
| FR-07 | P0 | Explain a prediction. | Show top positive/negative contributions from SHAP, or explicit model-derived reason codes if SHAP is unsupported; label any fallback accurately. |
| FR-08 | P0 | Human review workflow. | User can record Reviewed, Need More Information, or Escalate for Human Review; action is not an automatic lending decision. |
| FR-09 | P0 | Persist audit events. | Training start/finish/failure, scoring, explanation access, and review outcomes create searchable SQLite audit events. |
| FR-10 | P0 | Provide end-to-end setup documentation. | A fresh environment can follow README instructions; `.env.example` contains no real secrets. |
| FR-11 | P1 | Add differential privacy using Opacus. | Privacy-enabled local training is genuinely configured; DP parameters and accounting/output are recorded; tests verify the mode is not merely visual. |
| FR-12 | P1 | Compare baseline and federated metrics. | UI/report shows metrics from the same held-out test set and documents how the comparison was made. |
| FR-13 | P1 | Add clear training status and error handling. | UI distinguishes queued/running/completed/failed and shows an actionable error without a stack trace. |
| FR-14 | P2 | Integrate Flower SecAgg+. | Server/client code uses the supported SecAgg+ workflow; an integration test or reproducible smoke-test log confirms it ran. |
| FR-15 | P2 | Show privacy-performance trade-off. | Real run results show non-private vs DP-enabled metric changes plus actual DP configuration; no invented data. |
| FR-16 | P2 | Use deterministic natural-language explanations. | Templates transform validated reason codes/attributions into text without external API calls. |

## Non-functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| NFR-01 | Reproducibility | Seeds, configuration, package versions, and run instructions are recorded. |
| NFR-02 | Privacy-safe demo | No real personal/financial data is needed; no raw training rows enter central API storage or logs. |
| NFR-03 | Honest output | “Demo estimate” and synthetic-data caveats appear wherever risk results are shown. |
| NFR-04 | Reliability | Loading, empty, success, and failure states are designed; API failures do not silently look successful. |
| NFR-05 | Usability | A first-time tester can complete the scoring/explanation task without verbal help. |
| NFR-06 | Accessibility | Keyboard focus, labels, readable contrast, and icons/text beyond colour alone. |
| NFR-07 | Maintainability | UI, API schemas, model, federation, explanation, persistence, and synthetic data generation have clear module boundaries. |
| NFR-08 | Security hygiene | Secrets, generated private data, model artifacts, DB files, and logs are ignored by Git as appropriate. |
| NFR-09 | Performance | Synthetic end-to-end training and one case-scoring path complete within a reasonable local demo time; record observed timings, don't promise a fixed latency before testing. |

## UI output fields

- Run status and run ID
- Simulated lender/client list and participation state
- Completed rounds
- Model version
- Centralized baseline metrics and federated model metrics (when run)
- Privacy mode and configuration actually used
- Synthetic applicant ID and selected lender
- Model-estimated probability of default
- Demo risk band and clear calibration caveat
- Top positive and negative feature contributions/reason codes
- Human-review status
- Audit event timestamp and associated run/model version

## Error states to design

- Datasets not generated
- Federation process not installed or not compatible
- One or more clients fail
- Training run times out or returns non-finite weights
- Model artifact missing or schema mismatch
- Applicant ID not found
- Invalid features
- Explanation library fails (use the declared fallback or show an honest failure)
- Database unavailable/read-only
- DP requested but unsupported configuration
- SecAgg+ requested but not implemented/compatible

## Explicit anti-requirements

Do not add deep learning, blockchain, real customer uploads, real lender integrations, an LLM chat assistant, untested “privacy toggles,” automatic approval/decline, or claims of regulatory compliance.
