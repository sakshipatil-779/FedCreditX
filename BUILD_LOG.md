# FedCreditX — Build Log & Decision Ledger

**Project Name:** FedCreditX: Privacy-Aware Collaborative Credit-Risk Modelling with Explainable Outputs  
**Build Methodology:** HackFront / Vertical Slice Implementation  
**Log Start Date:** 2026-10-11  

---

## 1. Initial State & Workspace Audit (2026-10-11)

### Status & Actions
- **Repository Inspection:** Verified repository structure. Files and specifications synchronized to the repository root `e:\FedCreditX\`.
- **Runtimes Detected:**
  - Python: `3.13.1` (Windows 64-bit)
  - Node.js: `v24.14.0`
  - npm: `11.9.0`
- **Research Papers Verification:**
  - `iee fintech.pdf`: Ye Ju (2025), *JCSM* (DOI: `10.13052/jcsm2245-1439.1445`). Verified and extracted.
  - `iee fintech1.pdf`: Roman Fedytskyi (2026), *IEEE Access* (DOI: `10.1109/ACCESS.2025.3638252`). Verified and extracted.
  - `iee fintech2.pdf`: Hu Xiong et al. (2025), *IEEE TCSS* (DOI: `10.1109/TCSS.2025.3533634`). Verified and extracted.
- **Evidence Ledger Updated:** Updated `02_RESEARCH_EVIDENCE.md` with exact bibliographic citations, empirical parameters, verified findings, limitations, solution mapping, and the evidence/hypothesis matrix.

### Key Architecture & Scope Decisions
1. **Model Simplicity:** Credit default model must be a PyTorch logistic regression (single linear layer with BCEWithLogitsLoss). Deep learning is strictly excluded per `00_PROJECT_CHARTER.md` and `AGENTS.md`.
2. **Data Boundaries:** 100% synthetic data. No real PII or customer financial records. Client training partitions (`lender_a`, `lender_b`, `lender_c`) reside exclusively in client local folders; the central database stores only run metadata, aggregate metrics, case IDs, and audit events.
3. **No Blockchain / No Micro-Frontends:** Excluded from prototype to avoid irrelevant complexity.
4. **Deterministic Explainability First:** Prediction-level feature attributions/reason codes with clear calibration and non-causation caveats.

---

## 2. Requirement Checklist (`05_PRODUCT_REQUIREMENTS.md`)

| ID | Priority | Requirement Description | Implementation Status | Evidence / Verification |
|---|---|---|---|---|
| **FR-01** | P0 | Deterministic synthetic lender datasets (3 partitions) | **Completed** | `generate_synthetic.py` executed; bitwise reproducibility verified via unit tests. |
| **FR-02** | P0 | Shared feature schema enforcement | **Completed** | Strict validation of bounds, nulls, and non-numeric values verified via test suite. |
| **FR-03** | P0 | Centralized baseline training & evaluation | **Completed** | `baseline.py` trained on 3,600 rows: **ROC-AUC: 0.8049**, Loss: 0.4643; weights saved. |
| **FR-04** | P0 | Real Flower federated training across 3 simulated clients | **Completed** | 5-round FedAvg run completed (**ROC-AUC: 0.8072**, Loss: 0.4676); partition isolation verified. |
| **FR-05** | P0 | Training-run metadata & metrics persistence | **Completed** | SQLite `training_runs` table populated with `RUN-FL-6c474c1f`. |
| **FR-06** | P0 | Score synthetic applicant via lender-local workflow | **Completed** | Local inference route `/api/cases/{case_id}/score` verified via TestClient. |
| **FR-07** | P0 | Explain prediction (feature attributions / reason codes) | **Completed** | Linear attributions with honest labeling tested via API and UI. |
| **FR-08** | P0 | Human review workflow (`Reviewed`/`Need Info`/`Escalate`) | **Completed** | Review record persistence via `/api/cases/{case_id}/review` verified. |
| **FR-09** | P0 | Persist audit events for training, scoring, and reviews | **Completed** | SQLite `audit_events` and retrieval `/api/audit` verified. |
| **FR-10** | P0 | End-to-end setup documentation and `.env.example` | **Completed** | `.env.example`, `.gitignore`, `data_card.md` created. |
| **FR-11** | P1 | Opacus differential privacy integration & accounting | **Completed** | DP-SGD implemented via `PrivacyEngine`; ε = 1.18, δ = 1e-4, C = 1.0, σ = 1.0; holdout AUROC: 0.8070; test verified. |
| **FR-12** | P1 | Baseline vs. federated metrics comparison view | **Completed** | Baseline (0.8049) vs. FL (0.8072) vs. DP-FL (0.8070) verified via `/api/metrics` and UI. |
| **FR-13** | P1 | Granular run status and sanitized error handling | **Completed** | UI loading/empty/error states and API input validation verified. |
| **FR-14** | P2 | Flower SecAgg+ secure aggregation protocol | **Documented as Not Implemented** | SecAgg+ in Flower simulation requires RPC driver/runtime incompatible with Windows Python 3.13; honestly documented per AGENTS.md. |
| **FR-15** | P2 | Privacy-performance trade-off report | **Completed** | Centralized (0.8049) vs. Non-private FL (0.8072) vs. Opacus DP-FL (0.8070) empirically recorded. |
| **FR-16** | P2 | Deterministic natural-language explanation templates | **Completed** | Structured template reason codes generated from exact linear attributions. |

---

## 3. Daily Execution Log

### Day 1 / Phase A: Runnable Skeleton & Synthetic Data
- **Synthetic Data Generation (FR-01, FR-02):**
  - Generated 1,200 rows for Lender A (default rate: 7.7%).
  - Generated 1,200 rows for Lender B (default rate: 44.2%).
  - Generated 1,200 rows for Lender C (default rate: 42.8%).
  - Generated 900 rows for central holdout test set (default rate: 28.7%).
  - Generated 10 preloaded demo cases per lender (`demo_cases.json`).
  - Unit tests in `backend/tests/test_data_and_preprocessing.py`: **4/4 PASSED**.
- **Centralized Baseline Model (FR-03):**
  - Trained PyTorch logistic regression on pooled 3,600 training samples over 40 epochs.
  - Held-out test metrics (900 samples):
    - **AUROC:** 0.8049 | **F1-Score:** 0.5519 | **Precision:** 0.5938 | **Recall:** 0.5155 | **Brier Score:** 0.1573
  - Saved model checkpoint: `backend/artifacts/models/centralized_baseline.pt` (SHA-256: `094c44c007...`)
- **FastAPI Backend (FR-05, FR-06, FR-08, FR-09):**
  - Implemented `backend/app/main.py` and `backend/app/schemas/credit.py`.
  - Comprehensive integration smoke tests: **ALL PASSED (200 OK)**.
- **Frontend Dashboard Shell:**
  - Built Next.js App Router dashboard in `frontend/app/page.tsx`.

### Day 2 / Phase B: Genuine Federated Training (FR-04, FR-05, FR-12)
- **Flower Client & Isolation Tests:**
  - Implemented `backend/federation/client_app.py` (`LenderFlowerClient`).
  - Unit tests in `backend/tests/test_federation.py`: **3/3 PASSED**. Verified that Lender A, B, and C only read their assigned partition files and that client updates contain no raw rows or text data.
- **Federated Training Execution:**
  - Executed 5-round FedAvg coordinator across 3 simulated lenders:
    - Round 1 Holdout Loss: 0.4973 | AUROC: 0.8054
    - Round 2 Holdout Loss: 0.4762 | AUROC: 0.8074
    - Round 3 Holdout Loss: 0.4701 | AUROC: 0.8075
    - Round 4 Holdout Loss: 0.4686 | AUROC: 0.8069
    - Round 5 Holdout Loss: 0.4676 | **AUROC: 0.8072** | F1: 0.5362
  - Saved global model artifact: `backend/artifacts/models/federated_global_latest.pt`
  - Persisted run metadata into SQLite `training_runs` table (`RUN-FL-6c474c1f`).
  - Tested `/api/metrics` endpoint verifying side-by-side comparison of baseline (0.8049) vs. federated model (0.8072).

### Day 3 / Phase C & D: Differential Privacy (Opacus) & End-to-End Integration
- **Opacus Differential Privacy Integration (FR-11):**
  - Installed Opacus 1.6.0.
  - Upgraded `LenderFlowerClient.fit()` to support DP-SGD with `PrivacyEngine(secure_mode=False)`.
  - Configured per-sample gradient clipping ($C = 1.0$), Gaussian noise multiplier ($\sigma = 1.0$), and target $\delta = 10^{-4}$.
  - Saved DP model artifact: `backend/artifacts/models/federated_global_dp.pt`.
  - Initial integration tests and Next.js frontend dashboard created.

---

## 4. Phase E: Independent Scientific & Technical Audit (2026-10-11)

### 4.1 Flower Orchestration Investigation & Architecture Labeling (FR-04)
- **Environment Assessment:**
  - OS: Windows 11 AMD64
  - Python: `3.13.1`
  - Flower: `flwr` 1.13.0
- **Technical Barrier Discovered:**
  - `flwr.simulation.start_simulation` relies on `ray`, which does not publish Windows wheels for Python 3.13. Attempting Ray-based simulation raises binary distribution errors.
  - Starting standalone Flower gRPC background servers (`flwr.server.start_server`) inside worker threads raises `ValueError: signal only works in main thread of the main interpreter` on Python 3.13 / Windows.
- **Remediation & Architecture Decision:**
  - Used real Flower `NumPyClient` subclasses (`LenderFlowerClient`) with authentic `get_parameters()`, `set_parameters()`, and `fit()` contracts.
  - Aggregated updates via multi-round weighted FedAvg in `server_app.py`.
  - **Honest Labeling:** Clearly documented in `README.md`, `BUILD_LOG.md`, and `FINAL_AUDIT_REPORT.md` as a **locally simulated Flower-compatible FedAvg workflow**. No claims of multi-tenant inter-bank deployments or distributed network consensus are made.

### 4.2 Dataset Reconciliation & Evaluation Isolation (FR-01, FR-02, FR-03)
- **Discrepancy Identified & Fixed:**
  - Centralized baseline was previously fitted on 3,600 raw rows (all generated rows across 3 lenders), whereas federated clients trained on only 960 rows each (totaling 2,880 train rows).
  - Re-factored `backend/ml/baseline.py` to strictly pool the identical 80% training splits (`train_df` with 960 rows per lender = 2,880 total training rows).
  - Validation splits (240 rows per lender = 720 rows) kept strictly separate.
  - Holdout evaluation set (900 rows) strictly isolated from feature scalers and model training.
- **Reproduced Scientific Metrics (Strictly Controlled):**
  | Metric | Centralized Baseline (2,880 train) | Flower FedAvg (5 Rnds, 2,880 train) | Flower + Opacus DP-SGD (3 Rnds, 2,880 train) |
  |---|---:|---:|---:|
  | **Training Samples** | 2,880 | 2,880 | 2,880 |
  | **Holdout Test Samples**| 900 | 900 | 900 |
  | **Holdout Loss** | **0.4652** | **0.4863** | **0.5685** |
  | **ROC-AUC** | **0.8069** | **0.8071** | **0.8077** |
  | **PR-AUC** | **0.6304** | **0.6279** | **0.6306** |
  | **F1-Score** | 0.5045 | 0.5664 | 0.6014 |
  | **Precision** | 0.6099 | 0.5709 | 0.5401 |
  | **Recall** | 0.4302 | 0.5620 | 0.6783 |
  | **Brier Score** | **0.1546** | **0.1612** | **0.1908** |
  | **Cumulative Privacy** | None ($\varepsilon = \infty$) | None ($\varepsilon = \infty$) | **$\varepsilon = 2.2069$** ($\delta=10^{-4}, C=1.0, \sigma=1.0$) |

### 4.3 Cumulative Differential Privacy Accounting Audit (FR-11)
- **Defect Identified & Fixed:**
  - Re-instantiating `PrivacyEngine` in each round caused the privacy accountant to reset its step history, falsely reporting $\varepsilon \approx 1.18$ on every round regardless of round count.
  - Embedded a persistent `RDPAccountant` into `LenderFlowerClient`.
  - Re-attached the persistent accountant across rounds via `privacy_engine.accountant = self.accountant`.
  - Added regression test `test_opacus_dp_accountant_accumulates_across_multiple_rounds` in `backend/tests/test_federation.py`.
  - Measured verified cumulative privacy: $\varepsilon = 2.2069$ for 3 rounds of DP-SGD.
- **Privacy Guarantees & Assumptions Disclosed:**
  - **Sample-Level DP:** Guarantees protection for individual synthetic training records within a client's partition. Does *not* constitute client-level differential privacy.
  - **`secure_mode=False`:** Uses non-CS-PRNG for prototype execution speed and cross-platform reliability; production deployments must enable CS-PRNG.

### 4.4 Feature Attribution Engine Verification (FR-07)
- **Defect Identified & Fixed:**
  - `backend/app/main.py` previously evaluated an approximate scoring function for fast mock scoring.
  - Updated inference engine to dynamically load the active PyTorch checkpoint (`federated_global_latest.pt` / `centralized_baseline.pt`) and preprocessor (`preprocessor.json`).
  - Implemented exact linear feature attributions ($w_i \cdot x_{\text{norm}, i}$) where $x_{\text{norm}, i} = (x_i - \mu_i)/\sigma_i$.
  - Attributions rigorously verified to match model weights and directionality.

### 4.5 Test Suite & Quality Verification
- **Backend Tests:** Converted all test modules to standard `unittest.TestCase`. Added `test_genuine_flower_grpc_orchestration`. Ran `python -m unittest discover -s backend/tests -v`.
  - Result: **19 tests PASSED in 12.27s** (0 failures, 0 errors).
- **Frontend TypeScript & Build:**
  - `npx tsc --noEmit`: **0 errors**.
  - `npm run build`: **Success (Turbopack static export completed)**.
- **API & UI Integration:**
  - Verified live endpoints `/api/health`, `/api/overview`, `/api/metrics`, `/api/cases`, `/api/cases/{case_id}/score`, `/api/cases/{case_id}/review`, `/api/audit`.
  - Verified SQLite persistence of scoring results, training runs, and audit logs.

---

## 5. Phase F: Final Release Gate & Flower Requirement Resolution (2026-10-11)

### 5.1 Flower Requirement Resolution (FR-04)
- **Technical Analysis:**
  - While `flwr.simulation.start_simulation` remains blocked by Ray wheels under Windows Python 3.13, **authentic Flower server and client orchestration over gRPC was implemented and verified across independent processes**.
  - Coordinator process invokes `flwr.server.start_server(server_address=..., strategy=FedAvg(...))` on its main thread.
  - Three simulated lender processes execute `flwr.client.start_client(server_address=..., client=lender_client.to_client())`.
  - Confirmed via `test_genuine_flower_grpc_orchestration` in `backend/tests/test_federation.py` (Round 1 completed with exit code 0 across all 4 processes).
  - Fast simulation mode (`mode="sim"`) is preserved for instantaneous dashboard clicks.

### 5.2 Differential Privacy Parallel Composition Proof (FR-11)
- Verified that each of the three lenders (`lender_a`, `lender_b`, `lender_c`) holds a mutually disjoint partition of 960 synthetic records.
- Batch size: 32 ($q = 1/30$). 1 epoch = 30 steps/round. 3 rounds = 90 total steps.
- Opacus persistent `RDPAccountant` accumulates $\varepsilon_k = 2.2069$ ($\delta = 10^{-4}, C = 1.0, \sigma = 1.0$) for each client partition.
- By the **Parallel Composition Theorem** for disjoint datasets, the record-level differential privacy guarantee across the entire federation is bounded by $\max_k \varepsilon_k = 2.2069$.

### 5.3 Deliverables Generated
- `REPRODUCIBILITY_AND_DEMO_GUIDE.md`: Created with end-to-end command reproduction and 5–7 minute live demonstration script for evaluators.
- `FINAL_AUDIT_REPORT.md`: Updated with genuine Flower gRPC proof, parallel DP composition analysis, and 19-test suite outcomes.
- `README.md` and `BUILD_LOG.md`: Synchronized with latest test suite and dual Flower execution options.

---

## 6. Security & Trust Mechanisms Ledger

| Mechanism | Implementation State | Verification Method |
|---|---|---|
| **Raw Partition Locality** | **Verified** | Clients load only local `train.csv`; payloads contain only weight numpy arrays. |
| **Differential Privacy (DP-SGD)** | **Verified** | Opacus gradient clipping ($C=1.0$) and Gaussian noise ($\sigma=1.0$); $\varepsilon=2.2069$. |
| **Flower gRPC Orchestration** | **Verified** | Multi-process coordinator and clients communicating over local gRPC ports (FR-04). |
| **Secure Aggregation (SecAgg+)** | **Documented as Out of Scope / Blocked** | Flower SecAgg+ simulation blocked by Ray/Python 3.13 Windows incompatibilities. |
| **Tamper-Proof Audit Trail** | **Demo Audit Only** | Stored in SQLite `audit_events`; not a cryptographic or distributed ledger. |
| **Real Credit Scoring** | **Explicitly Disclaimed** | Clearly labeled as "demo model-estimated default probability" on synthetic data. |

---

## 7. Phase G: Decision Tree Risk Engine, Human Review & Auditable Decision Workflow (2026-10-20)

### 7.1 Gap Analysis (Current State vs. Decision Tree Requirements)
1. **Applicant Scoring Model:**
   - *Current State:* Uses PyTorch `LogisticRegressionCreditModel` loaded from `federated_global_latest.pt` or `centralized_baseline.pt`.
   - *Gap:* The new requirement mandates using **ONLY a Decision Tree model (`sklearn.tree.DecisionTreeClassifier`)** for applicant scoring and risk prediction.
   - *Action:* Implement `backend/ml/decision_tree.py` to train, persist, evaluate, and explain with `DecisionTreeClassifier`. Persist artifact `decision_tree_risk_model.joblib`. Ensure positive-class probability verification (`classes_`).
2. **Risk Thresholds & System Recommendations:**
   - *Current State:* 4 legacy risk bands (`LOW` <15%, `MODERATE` 15-35%, `ELEVATED` 35-60%, `HIGH` >=60%).
   - *Gap:* Exact prototype rules required:
     - `p < 0.30`: Low risk -> "Auto-approve recommendation"
     - `0.30 <= p <= 0.70`: Medium risk -> "Send to human review" (pending review)
     - `p > 0.70`: High risk -> "Flag high risk" (require officer confirmation; do not auto-reject)
   - *Action:* Centralize risk rules in `backend/config/risk_rules.py` with exact boundary condition checks.
3. **Model Explainability (Top Three Reasons):**
   - *Current State:* Linear model attributions ($w_i \cdot x_{\text{norm}, i}$).
   - *Gap:* Must present up to 3 meaningful, human-readable explanations derived directly from the Decision Tree decision path (split conditions traversed) without fabricating values.
   - *Action:* Implement decision path traversal extracting split feature, threshold, direction, and impact on probability of default.
4. **Officer Review & Model Override Workflow:**
   - *Current State:* Basic status recording in SQLite `review_records`.
   - *Gap:* Missing explicit override detection (`OVERRIDE_MODEL` action), mandatory non-empty override reasons, atomic database writes, and distinct fields (`system_recommendation`, `final_decision`, `is_override`).
   - *Action:* Implement `/api/cases/{case_id}/decision` endpoint with strict override validation.
5. **Separated Screens:**
   - *Current State:* Single dashboard with multi-tab structure.
   - *Gap:* Must cleanly separate **Screen A (Applicant Decision)** for bank officers and **Screen B (Audit Logs)** for auditors with filtering, pagination, and real export.
   - *Action:* Re-architect `frontend/app/page.tsx` into clearly dedicated views with top navigation.

### 7.2 Implementation & Verification Records (Phase G Completed)
1. **Decision Tree Model (`backend/ml/decision_tree.py`):**
   - Implemented `DecisionTreeRiskModel` wrapping `sklearn.tree.DecisionTreeClassifier(max_depth=5, min_samples_leaf=20, random_state=42)`.
   - Trained exclusively on 2,880 synthetic training records (`lender_a`, `lender_b`, `lender_c`). Holdout test set (900 records) strictly isolated.
   - Holdout performance: **AUROC = 0.7371**, F1 = 0.5185, Precision = 0.4578, Recall = 0.5980.
   - Positive class verification: Dynamically checks `classes_` to ensure positive default class probability is selected.
   - Decision path explanation: Traverses tree splits via `model.decision_path(X)`, computing node feature, split threshold, comparison direction, and impact delta ($\le 3$ reasons).
2. **Configurable Risk Rules (`backend/config/risk_rules.py`):**
   - Single source of truth for exact prototype thresholds:
     - `p < 0.30`: Low Risk -> "Auto-approve recommendation"
     - `0.30 <= p <= 0.70`: Medium Risk -> "Send to human review"
     - `p > 0.70`: High Risk -> "Flag high risk" (requires authorized officer confirmation)
3. **FastAPI Endpoints (`backend/app/main.py`):**
   - `POST /api/cases/{case_id}/score`: Scores applicant exclusively with Decision Tree, returning risk level, percentage, top 3 decision-path reasons, and system recommendation.
   - `POST /api/cases/{case_id}/decision`: Submits officer action (`approve`, `reject`, `send_to_review`). Enforces mandatory non-empty reason when overriding recommendation. Persists atomic `decision_records` and `audit_events`.
   - `GET /api/audit`: Returns filtered audit events (filtering by `event_type`, `actor`, `resource_id`, `decision`, pagination).
   - `GET /api/audit/export`: Exports real CSV audit log.
   - `GET /api/model/status`: Returns active model type (`DecisionTreeClassifier`), version, and thresholds.
4. **Next.js Frontend Architecture (`frontend/app/page.tsx`):**
   - **Screen A (Applicant Decision):** Displays permitted applicant details, Section A (Risk level + probability percentage, non-color icon + gauge meter, synthetic disclaimer), Section B (Top 3 reasons derived from Decision Tree split conditions), and Section C (System recommendation, review status, Approve/Reject/Send to review controls, and mandatory override reason field).
   - **Screen B (Audit Logs):** Full auditor screen with real backend table (Time, User, Action, Resource, Model Score, Final Decision, Status, Override Details), filters for event/actor/case/decision, pagination, and real CSV download.
   - Research tabs preserved for federated learning experiments, holdout benchmark, and project charter.
5. **Verification Evidence:**
   - Backend Unit & Integration Tests: **32/32 tests passed** (`python -m unittest discover -s backend/tests -v`).
   - Frontend TypeScript check: **0 errors** (`npx tsc --noEmit`).
   - Frontend Production Build: **0 errors** (`npm run build`).
   - Live HTTP Integration Test: Verified live scoring, override validation rejection (HTTP 422), valid override submission, SQLite persistence, and CSV export.
6. **Historical Research Preservation:**
   - Flower federated learning coordinator and simulated client scripts preserved.
   - PyTorch logistic regression baseline and DP-SGD accounting records preserved as documented research benchmarks.

---

## 8. Phase H: Firebase Auth & Direct Email/Password Role Sign-In (2026-10-23)
- **Firebase Configuration:** Configured `fedcreditx.firebaseapp.com` with official Firebase JS SDK credentials and Google popup authentication.
- **Direct Email/Password & Role Selection:** Added primary sign-in form with Email, Password, Full Name (optional), and Assigned Role dropdown (`Bank Underwriting Officer` / `Compliance Risk Auditor`).
- **Submit Button:** Button strictly labeled `"Sign In"`.
- **Identity Integrity:** Completely purged fake demo names (`Neha Patel`, `Vikram Malhotra`) from placeholders, fallbacks, mock profiles, and default allowlists across all frontend and backend files.
- **Verification:** 51/51 pytest tests passing, Next.js frontend compiled and built cleanly.

