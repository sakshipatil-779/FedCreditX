# FedCreditX — Prototype Documentation & Developer Setup Guide

**Project Name:** FedCreditX: Privacy-Aware Collaborative Credit-Risk Assessment  
**Repository:** [https://github.com/sakshipatil-779/FedCreditX](https://github.com/sakshipatil-779/FedCreditX)  
**Hosted Prototype Application:** [https://fedcreditx.onrender.com/](https://fedcreditx.onrender.com/)  
**Version:** 2.0.0 (Final Submission)  
**License:** MIT (Academic Research Prototype)  

---

## 1. Project Overview & End-to-End Workflow

**FedCreditX** is a research-oriented software prototype demonstrating how multiple decentralized commercial lenders can collaboratively train credit-risk models under **Federated Learning (Flower)** and **Differential Privacy (Opacus DP-SGD)** without centralizing raw customer records. The prototype provides prediction-level explainability through **LinearSHAP** feature attributions and a deterministic **Decision Tree baseline**, coupled with a human underwriter review workflow, mandatory override justifications, and senior officer approval tracking backed by an immutable SQLite audit trail.

### The Single End-to-End Workflow Implemented:
```
1. Authentication:
   The bank officer or risk auditor signs in via Google Identity Authentication.

2. Case Selection:
   The officer selects a preloaded synthetic applicant (e.g. DEMO-A-001) from an isolated local lender partition (Lender A, B, or C).

3. Primary Model Inference (FL + DP Logistic Regression):
   The backend scores the applicant using the federated global model trained with Opacus DP-SGD (epsilon = 2.2069), computing an estimated default probability (45.5%) and demo risk band (ELEVATED).

4. Key Risk Drivers (LinearSHAP) & Interpretable Baseline:
   The officer inspects the top 3 directional risk drivers (e.g. Credit History Length, Revolving Utilization, DTI) alongside an interpretable Decision Tree split-path baseline.

5. Underwriting Decision & Mandatory Override:
   The officer can Approve, Reject, or Submit for Senior Officer Review. Any departure from the system recommendation requires a documented override reason.

6. Senior Approval Tracking:
   Senior officers review escalated applications in the dedicated Approval Tracking screen, inputting comments and recording senior approval or rejection.

7. Immutable Audit Trail:
   All scoring events, underwriter decisions, override justifications, and senior sign-offs are persisted in SQLite and can be exported as a CSV audit log.
```

---

## 2. System Architecture & Project Structure

```
prototype/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & REST routing
│   │   └── schemas/credit.py    # Pydantic v2 validation models
│   ├── artifacts/
│   │   ├── models/              # Saved model checkpoints (.pt, .joblib)
│   │   └── metrics/             # Evaluation benchmark JSON records
│   ├── config/
│   │   └── risk_rules.py        # Centralized underwriting policy thresholds
│   ├── data/
│   │   └── generate_synthetic.py# Deterministic multi-lender data generator
│   ├── federation/
│   │   ├── client_app.py        # Flower NumPyClient with Opacus DP-SGD
│   │   └── server_app.py        # Multi-round FedAvg coordinator
│   ├── local_data/              # Isolated local partitions (lender_a, b, c, holdout)
│   ├── ml/
│   │   ├── baseline.py          # Centralized baseline model
│   │   ├── decision_tree.py     # Interpretable Decision Tree baseline
│   │   ├── fl_scoring.py        # LinearSHAP inference & explanation engine
│   │   └── preprocessing.py     # Feature schema normalization
│   └── tests/
│       ├── test_data_and_preprocessing.py
│       ├── test_federation.py
│       └── test_api.py
├── frontend/
│   ├── app/
│   │   ├── components/          # Reusable UI icons, risk gauge, landing page
│   │   ├── lib/firebase.ts      # Google Authentication & session handling
│   │   ├── layout.tsx           # Global root layout
│   │   └── page.tsx             # Main dashboard (Denezo design language)
│   ├── package.json
│   └── tsconfig.json
├── .env.example                 # Safe environment configuration template
├── .gitignore                   # Excludes caches, secrets, and build outputs
├── data_card.md                 # Dataset distribution and synthetic metadata
├── requirements.txt             # Pinned backend Python dependencies
└── README.md                    # This developer documentation
```

---

## 3. Step-by-Step Setup Instructions

### Prerequisites
- **Python:** 3.10 to 3.13 (Tested on Python 3.13.1 AMD64 Windows)
- **Node.js:** v18.0.0 or higher (Tested on Node.js v24.14.0, npm 11.9.0)
- **Git**

---

### Step 1: Environment Setup & Backend Installation

1. Navigate to the `prototype/` root directory in your terminal:
   ```bash
   cd prototype
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # On Windows:
   python -m venv venv
   venv\Scripts\activate

   # On macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Create your local environment file from the safe template:
   ```bash
   # On Windows:
   copy .env.example .env

   # On macOS / Linux:
   cp .env.example .env
   ```

---

### Step 2: Deterministic Synthetic Data Generation

Generate the isolated synthetic lender partitions and preloaded demo cases:
```bash
python -m backend.data.generate_synthetic
```
*Expected Output:*
- Generates 1,200 rows for Lender A (`backend/local_data/lender_a/train.csv`).
- Generates 1,200 rows for Lender B (`backend/local_data/lender_b/train.csv`).
- Generates 1,200 rows for Lender C (`backend/local_data/lender_c/train.csv`).
- Generates 900 rows for the central Holdout Test Set (`backend/local_data/holdout_test/test.csv`).
- Generates 10 preloaded applicant demo cases per lender (`demo_cases.json`).

---

### Step 3: Run Backend Verification Tests

Execute the comprehensive automated test suite:
```bash
python -m unittest discover -s backend/tests -v
```
*Expected Output:*
```
Ran 19 tests in ~12s
OK
```
All 19 tests must pass, confirming dataset reproducibility, partition isolation, Opacus DP-SGD accumulation, API endpoint routing, and RBAC security.

---

### Step 4: Launch the FastAPI Backend Server

Start the backend API server with Uvicorn:
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Verification:*
- Open your browser to `http://127.0.0.1:8000/api/health`. You will receive:
  ```json
  {
    "status": "healthy",
    "service": "fedcreditx-api",
    "version": "0.2.0",
    "partitions_found": {"lender_a": true, "lender_b": true, "lender_c": true, "holdout_test": true},
    "model_artifact_present": true
  }
  ```

---

### Step 5: Launch the Next.js Frontend Dashboard

1. Open a new terminal window, navigate to `prototype/frontend`:
   ```bash
   cd frontend
   npm install
   ```

2. Start the local Next.js development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 4. Operational Walkthrough & Demonstration

1. **Google Identity Authentication:**
   - On the Landing Page, click **"Sign In as Neha Patel (Bank Officer)"** or sign in with your own Google account.
2. **Score Applicant:**
   - Select Lender A (Commercial Bank).
   - Select Applicant `DEMO-A-001`.
   - Click the single **"Score Applicant"** button.
   - Observe the real-time default probability (**45.5%**), demo risk band (**ELEVATED**), and the top 3 **LinearSHAP** risk drivers:
     - Credit History Length (+0.0464 default contribution)
     - Revolving Credit Utilization (+0.0425 default contribution)
     - Debt-to-Income Ratio (+0.0187 default contribution)
   - Inspect the **Interpretable Decision Tree Baseline** comparison card.
3. **Submit for Senior Approval:**
   - In the Underwriting Sign-Off card, enter underwriting notes.
   - Click **"Submit for Senior Officer Approval"**.
4. **Senior Approval Tracking:**
   - Click the **"Approval Tracking"** item in the sidebar menu.
   - Inspect the application in "Pending Senior Review" status with full historical timeline.
   - Enter senior comments and click **"Approve Application"**.
5. **Inspect Audit Trail:**
   - Click **"Audit Logs"** in the sidebar.
   - Verify that all scoring events, underwriter notes, and senior approval events are recorded.
   - Click **"Export Filtered CSV"** to download the audit log.
6. **Role-Based Access Control (RBAC):**
   - Click **"Holdout Benchmark"** as a Bank Officer: access is restricted.
   - Sign out and sign in as **"Vikram Malhotra (Supervisory Auditor)"**: full cross-partition benchmark table and Opacus differential privacy parameters are unlocked.

---

## 5. Disclosure of Incomplete, Partially Implemented, or Out-of-Scope Features

To maintain strict research and engineering integrity, we disclose the exact operational status of every planned capability:

| Feature / Mechanism | Implementation Status | Honest Disclosure & Rationale |
|---|---|---|
| **Synthetic Data Generation** | **Fully Functional** | 100% deterministic, reproducible via seed 42. No real PII. |
| **FL + DP Logistic Regression** | **Fully Functional** | PyTorch logistic regression trained with Opacus DP-SGD ($\varepsilon=2.2069$). |
| **LinearSHAP Attributions** | **Fully Functional** | Exact mathematical attributions matching model weights and feature deviations. |
| **Decision Tree Baseline** | **Fully Functional** | Scikit-Learn `DecisionTreeClassifier` (depth 5) split path comparison. |
| **Approval Tracking & Audit** | **Fully Functional** | Multi-step underwriting escalation and SQLite persistence with CSV export. |
| **Role-Based Access Control** | **Fully Functional** | Google Identity authentication enforcing Auditor-only access to `/api/metrics`. |
| **Flower SecAgg+ Protocol** | **Documented as Not Implemented** | SecAgg+ simulation in Flower requires Ray background drivers incompatible with Windows Python 3.13. Transparently omitted per project charter. |
| **Consortium Blockchain Ledger** | **Documented as Not Implemented** | SQLite WAL mode provides a demo audit trail. It is *not* a tamper-proof cryptographic blockchain ledger. |
| **Autonomous Credit Actioning**| **Deliberately Out of Scope** | All lending decisions require human underwriter sign-off. The system does not autonomously issue credit. |

---

## 6. Safe Configuration (.env.example)

The prototype requires no private API keys or paid credentials. A safe template is provided in `.env.example`:
```env
# FedCreditX Local Environment Configuration Template
API_HOST=127.0.0.1
API_PORT=8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
ENVIRONMENT=development
DISCLAIMER_NOTICE="SYNTHETIC DEMO — NOT FOR REAL CREDIT DECISIONS"
```
No `.env` files containing secrets or credentials are included in the repository.
