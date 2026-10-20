# FedCreditX — Reproducibility and Live Demonstration Guide

> **MANDATORY SCIENTIFIC DISCLAIMER**  
> **FedCreditX is a synthetic-data research prototype.** All applicant records, default probabilities, and financial parameters are generated programmatically for research and technical demonstration purposes.  
> **This software is NOT an underwriting engine, is NOT calibrated to real-world financial credit bureaus, and must NEVER be used for actual credit decisions.**

---

## 1. Environment Requirements & Setup

### Prerequisites
- **Operating System:** Windows 10/11, macOS, or Linux (AMD64 / ARM64)
- **Python:** Python 3.11, 3.12, or 3.13 (Python 3.13.1 verified on Windows 11)
- **Node.js:** Node.js v18.0.0+ (Node.js v24.14.0 & npm 11.9.0 verified)

### Step 1: Install Python Dependencies
```bash
# Core machine learning & federated dependencies
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install flwr==1.13.0 fastapi uvicorn[standard] scikit-learn pandas numpy pydantic opacus httpx
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 2. End-to-End Pipeline Execution Commands

### Step 1: Generate Deterministic Synthetic Datasets (FR-01, FR-02)
Generates 1,200 synthetic borrower records for each simulated lender (`lender_a`, `lender_b`, `lender_c`), fits the initial feature scaler on training records, and isolates 900 holdout test records:
```bash
python backend/data/generate_synthetic.py --seed 42 --samples 1200 --holdout 900
```
- **Output:**
  - `backend/local_data/lender_a/train.csv` (1,200 rows: 960 train / 240 local validation)
  - `backend/local_data/lender_b/train.csv` (1,200 rows: 960 train / 240 local validation)
  - `backend/local_data/lender_c/train.csv` (1,200 rows: 960 train / 240 local validation)
  - `backend/local_data/holdout_test/test.csv` (900 isolated test records)
  - `backend/local_data/preprocessor.json` (Fitted standardization parameters $\mu, \sigma$)

### Step 2: Train Centralized Pooled Baseline (FR-03)
Trains a transparent PyTorch Logistic Regression model on the combined training records (strictly **2,880 samples** across all three lenders, preserving equitable comparison with federated learning):
```bash
python -m backend.ml.baseline --epochs 40 --lr 0.02
```
- **Output Artifacts:**
  - Model Checkpoint: `backend/artifacts/models/centralized_baseline.pt`
  - Metrics File: `backend/artifacts/metrics/centralized_baseline_metrics.json`
- **Verified Benchmark Metrics (900 Holdout Samples):**
  - AUROC: `0.8069` | PR-AUC: `0.6304` | F1-Score: `0.5045` | Loss: `0.4652` | Brier Score: `0.1546`

### Step 3: Run Federated Training Workflows (FR-04, FR-05, FR-11)

#### Option A: Genuine Multi-Process Flower gRPC Orchestration (Verified FR-04)
Launches the authentic Flower gRPC server (`start_server`) in a dedicated coordinator process, spawns three independent client processes (`start_client`), and completes federated rounds over local gRPC networking:
```bash
# Executes 1 round of authentic Flower gRPC federation across 3 client processes
python -m backend.federation.server_app --mode grpc --rounds 1 --server-address 127.0.0.1:8089
```

#### Option B: Standard In-Process Federated Simulation (Fast Dashboard Engine)
Runs 5 rounds of sample-weighted Federated Averaging (FedAvg):
```bash
python -m backend.federation.server_app --mode sim --rounds 5 --epochs 3 --lr 0.02
```
- **Output Artifacts:**
  - Model Checkpoint: `backend/artifacts/models/federated_global_latest.pt`
  - Metrics File: `backend/artifacts/metrics/federated_run_metrics.json`
- **Verified Benchmark Metrics (900 Holdout Samples):**
  - AUROC: `0.8071` | PR-AUC: `0.6279` | F1-Score: `0.5664` | Loss: `0.4863` | Brier Score: `0.1612`

#### Option C: Differential Privacy with Opacus (DP-SGD, FR-11)
Executes 3 rounds of DP-SGD with sample-level gradient clipping ($C = 1.0$), Gaussian noise ($\sigma = 1.0$), and persistent cumulative Rényi Differential Privacy accounting:
```bash
python -c "from backend.federation.server_app import run_federated_simulation; run_federated_simulation(num_rounds=3, local_epochs=1, use_dp=True)"
```
- **Output Artifacts:**
  - Model Checkpoint: `backend/artifacts/models/federated_global_dp.pt`
  - Metrics File: `backend/artifacts/metrics/federated_run_dp_metrics.json`
- **Verified Benchmark Metrics (900 Holdout Samples):**
  - AUROC: `0.8077` | PR-AUC: `0.6306` | F1-Score: `0.6014` | Loss: `0.5685` | Cumulative $\mathbf{\varepsilon = 2.2069}$ ($\delta = 10^{-4}$)

---

## 3. Automated Validation & Quality Checks

### Run Backend Unit & Integration Tests (19 Tests)
```bash
python -m unittest discover -s backend/tests -v
```
- **Test Coverage:**
  - Data generation bitwise reproducibility and bound validation (4 tests)
  - Client partition isolation and no raw data leakage (2 tests)
  - Genuine Flower gRPC server/client multi-process orchestration (1 test)
  - Mathematical FedAvg simulation (1 test)
  - Opacus DP-SGD local training & noise injection (1 test)
  - Persistent Opacus RDP accountant accumulation across multiple rounds (1 test)
  - FastAPI health, overview, metrics, scoring, review, and audit endpoints (9 tests)
- **Expected Result:** `Ran 19 tests ... OK` (approx. 12 seconds).

### Run Frontend Type Checking & Production Build
```bash
cd frontend
npx tsc --noEmit
npm run build
cd ..
```
- **Expected Result:** `0 errors` and `Compiled successfully` with static route generation.

---

## 4. Starting the Live Application

### Terminal 1: Launch FastAPI Backend Server
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
- Interactive Swagger documentation: `http://127.0.0.1:8000/docs`
- Health check verification: `http://127.0.0.1:8000/api/health`

### Terminal 2: Launch Next.js Frontend Dashboard
```bash
cd frontend
npm run dev -- -p 3000
```
- Live web dashboard: `http://localhost:3000`

---

## 5. Live Demonstration Walkthrough (5–7 Minute Sequence)

This structured walkthrough is designed for presentations to research reviewers, faculty, and technical evaluators.

```
+-----------------------------------------------------------------------------------------+
|                                    DEMO WORKFLOW                                        |
|  [1. Disclaimers] -> [2. Lenders] -> [3. Model Benchmarks] -> [4. Inference & Explain]  |
|                                        -> [5. Human Review] -> [6. Audit Trail]         |
+-----------------------------------------------------------------------------------------+
```

### Stage 1: Welcome & Mandatory Disclaimers (Minute 0:00 – 1:00)
- **Presenter Action:** Open `http://localhost:3000` in the browser. Direct attention to the top persistent amber banner.
- **Visible Confirmation:**
  - System Header: *"FedCreditX — Privacy-Aware Collaborative Credit-Risk Modelling with Explainable Outputs"*.
  - Amber Banner: *"DEMONSTRATION PROTOCOL: Synthetic credit profiles only. Probability estimates are demo model estimates and not calibrated credit scores."*
- **What to Say to Judges:**
  > *"FedCreditX investigates how multiple financial institutions can collaboratively train a credit default model without centralizing private customer records. Before demonstrating features, note our research boundaries: all records are 100% synthetic, no real bank APIs or customer PII are connected, and all risk bands are illustrative demonstration bands."*

### Stage 2: Three Distinct Simulated Lenders (Minute 1:00 – 2:00)
- **Presenter Action:** Scroll to the **Simulated Lending Institutions** section.
- **Visible Confirmation:**
  - Three distinct lender cards:
    1. **Lender A (Prime Bank):** High income, prime portfolio, default rate ~7.7%.
    2. **Lender B (Consumer Growth):** Near-prime consumer lending, high utilization, default rate ~44.2%.
    3. **Lender C (Digital FinTech):** Thin-file gig economy borrowers, default rate ~42.8%.
  - Status indicator shows `Ready (1,200 local samples)`.
- **What to Say to Judges:**
  > *"Each simulated institution holds an isolated, heterogeneous customer distribution. Under our data isolation protocol, client datasets are strictly stored in local lender folders. In federated rounds, raw records never leave the local environment; only model weight parameters are transmitted to the coordinator."*

### Stage 3: Rigorous Model Benchmarks & Privacy Trade-off (Minute 2:00 – 3:30)
- **Presenter Action:** Scroll to the **Model Performance Comparison** card.
- **Visible Confirmation:**
  - Side-by-side benchmark table comparing Centralized Baseline, Flower FedAvg, and Opacus DP-SGD on the common 900-sample holdout test set.
  - Baseline AUROC: `0.8069` | Loss: `0.4652` | Brier Score: `0.1546`.
  - Federated FedAvg (5 Rnds): AUROC: `0.8071` | Loss: `0.4863` | Brier Score: `0.1612`.
  - Opacus DP-SGD: AUROC: `0.8077` | Cumulative $\varepsilon = 2.2069$ ($\delta = 10^{-4}$).
- **What to Say to Judges:**
  > *"Notice that both Centralized and Federated models train on an equitable 2,880 samples and are benchmarked against an isolated holdout set. Centralized training achieves the best probability calibration (Brier score 0.1546), while Federated Averaging closely matches discriminative performance without data pooling. Our Opacus differential privacy implementation uses a persistent Rényi DP accountant, proving cumulative $\varepsilon = 2.2069$ across all 3 federated rounds."*

### Stage 4: Applicant Lab, Case Scoring & Honest Attributions (Minute 3:30 – 5:00)
- **Presenter Action:** Scroll to the **Applicant Lab & Underwriter Scoring** section.
  1. Select Lender: `Lender A (Prime Bank)`.
  2. Select Synthetic Applicant: `DEMO-A-001`.
  3. Click **"Score Selected Applicant"**.
- **Visible Confirmation:**
  - The live model checkpoint executes inference via `/api/cases/DEMO-A-001/score`.
  - Result Card displays:
    - Default Probability Estimate: `~21.2%` (Check displayed value).
    - Demo Risk Band: `MODERATE` (`15%–35% estimated probability`).
    - Explanation Method: `Exact Linear Feature Attributions (w_i * x_norm_i)`.
    - Horizontal attribution bars showing top risk contributors (e.g. `credit_utilization_ratio` increasing risk; `monthly_income_band_value` reducing risk).
- **What to Say to Judges:**
  > *"Rather than using black-box approximations or ungrounded generative LLM summaries, our explainability module calculates exact linear feature attributions directly from the model weights and standardized features. This fulfills credit compliance expectations where an underwriter must provide clear reason codes for adverse action notices."*

### Stage 5: Human-in-the-Loop Review & Audit Persistence (Minute 5:00 – 6:00)
- **Presenter Action:**
  1. Under the scored applicant, locate the **Underwriter Human Review** form.
  2. Select Decision: `Need More Information` or `Confirmed High Risk`.
  3. Enter Reviewer Note: `Request recent utility bills to verify address and income stability`.
  4. Click **"Submit Review Decision"**.
- **Visible Confirmation:**
  - Success badge appears: *"Human review state successfully logged."*
  - Scroll down to the **Audit Trail & System Events** table.
  - The latest row displays the newly created event:
    - Event Type: `HUMAN_REVIEW_RECORDED`
    - Actor: `human_underwriter_demo`
    - Entity ID: `DEMO-A-001`
    - Status: `RECORDED`
- **What to Say to Judges:**
  > *"Autonomous loan approval is strictly prohibited by our system architecture. Every scored case requires human reviewer confirmation. Review actions are immediately persisted to the SQLite audit log alongside federated training and scoring events, ensuring end-to-end traceability."*

### Stage 6: Disclosures, Architecture Reality & Limitations (Minute 6:00 – 7:00)
- **Presenter Action:** Open the **Architecture & Research Disclosures** drawer or point to documentation.
- **Key Disclosures to Highlight to Judges:**
  1. **Single Machine Simulation:** In this prototype, multiple lenders are executed as simulated processes on a single development machine to demonstrate interface and protocol correctness.
  2. **Sample-Level vs. Client-Level DP:** Differential privacy protects individual loan records within client partitions; it does not protect whether an entire institution participated.
  3. **SecAgg+ Status:** Flower SecAgg+ is honestly documented as blocked/out of scope in this Windows environment.
  4. **Audit Trail Scope:** The audit table is a demonstration SQLite ledger, not a cryptographically immutable blockchain.

---

## 6. Verification Checklist for Presenters

Before going on stage or beginning an evaluation session, run this rapid 30-second checklist:

| Check Item | Command / URL | Expected Status |
|---|---|---|
| Backend Running | `http://127.0.0.1:8000/api/health` | `{"status": "healthy"}` |
| Frontend Running | `http://localhost:3000` | Dashboard renders without console errors |
| Test Suite Valid | `python -m unittest discover -s backend/tests` | `Ran 19 tests ... OK` |
| Preprocessor Exists | `backend/local_data/preprocessor.json` | Present |
| Models Exist | `backend/artifacts/models/` | `centralized_baseline.pt`, `federated_global_latest.pt`, `federated_global_dp.pt` present |
| Database Exists | `backend/fedcreditx.db` | Tables `training_runs`, `scoring_results`, `audit_events` populated |
