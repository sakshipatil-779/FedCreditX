# FedCreditX — Privacy-Aware Collaborative Credit-Risk Modelling with Explainable Outputs

> **SYNTHETIC DATA RESEARCH PROTOTYPE — NOT FOR REAL CREDIT DECISIONS OR PRODUCTION LENDING**  
> All records, financial profiles, and probabilities in this prototype are deterministic synthetic artifacts. No real bank, bureau, customer records, or financial identities are accessed or stored.

---

## 1. Project Overview

**FedCreditX** is a research prototype demonstrating privacy-aware collaborative credit intelligence with explainable Decision Tree risk scoring, human underwriting review, and an auditable decision workflow.

The application allows risk analysts and reviewers to:
1. **Decision Tree Risk Scoring:** Assess applicant default risk using exclusively `sklearn.tree.DecisionTreeClassifier` with deterministic preprocessing and dynamic positive-class resolution.
2. **Exact Boundary Rules:** Apply prototype classification rules:
   - $p < 0.30$: **Low Risk** $\rightarrow$ *Auto-approve recommendation*
   - $0.30 \le p \le 0.70$: **Medium Risk** $\rightarrow$ *Send to human review* (pending review)
   - $p > 0.70$: **High Risk** $\rightarrow$ *Flag high risk* (requires authorized officer confirmation; does not auto-reject)
3. **Three Primary Items on Decision Screen:**
   - **Section A (Risk Level & Probability):** High-contrast risk result (**LOW — 13%**, **MEDIUM — 54%**, **HIGH — 78%**) with non-color icon and gauge meter indicators.
   - **Section B (Top Three Reasons):** Defensible, human-readable explanations derived directly from traversed Decision Tree splits and conditions.
   - **Section C (Action Panel):** System recommendation, review status, and officer controls (**Approve**, **Reject**, **Send to Human Review**).
4. **Mandatory Override Accountability:** Enforces a documented justification on both frontend and backend whenever an officer changes the system recommendation, persisting an `OVERRIDE_MODEL` event.
5. **Two Dedicated Screens:**
   - **Screen A (Applicant Decision):** Focused bank officer underwriting workspace.
   - **Screen B (Audit Logs):** Full auditor screen with filtering (event, actor, case, decision), pagination, and real CSV export.
6. **Preserved Research Experiments:** Retains historical Flower federated learning coordinator and Opacus DP-SGD experiments as documented research benchmarks.

---

## 2. Approved Technology Stack

| Layer | Technology | Role in Prototype |
|---|---|---|
| **Applicant Scoring** | `sklearn.tree.DecisionTreeClassifier` | Deterministic tree-based default risk classification and decision-path explanation. |
| **Risk Rules Engine** | Python Config (`risk_rules.py`) | Configurable exact prototype boundary conditions ($p < 0.30$, $0.30 \le p \le 0.70$, $p > 0.70$). |
| **Web UI** | Next.js App Router, TypeScript, Tailwind CSS | Separate Screen A (Applicant Decision) and Screen B (Audit Logs). |
| **Backend API** | FastAPI + Pydantic v2 | Python REST API with schema validation, CORS, scoring, and atomic decision persistence. |
| **Audit Persistence** | SQLite | Persistent local storage for runs, decision records, and `audit_events`. |
| **Federated Research** | Flower (`flwr` v1.39) + PyTorch + Opacus | Preserved federated learning simulation and DP-SGD accounting research lab. |
| **Synthetic Data** | NumPy + Pandas | Seed-controlled deterministic synthetic credit benchmark (3,600 train + 900 test). |

---

## 3. Quickstart: Reproduction & Local Execution

### Prerequisites
- Python 3.11+ (Python 3.13 supported)
- Node.js 18+ & npm 9+

### Step 1: Install Dependencies
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install flwr fastapi uvicorn httpx scikit-learn pandas numpy pydantic opacus joblib
cd frontend && npm install && cd ..
```

### Step 2: Generate Synthetic Datasets
```bash
python backend/data/generate_synthetic.py --seed 42
```

### Step 3: Train and Persist Decision Tree Risk Model
```bash
python -m backend.ml.decision_tree
```
*Observed Holdout Metrics (Holdout Set: 900 samples):*
- **AUROC:** 0.7371
- **F1-Score:** 0.5185
- **Precision:** 0.4578
- **Recall:** 0.5980
- **Artifact:** `backend/artifacts/models/decision_tree_risk_model.joblib`

### Step 4: Start the FastAPI Backend
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Interactive API documentation available at: `http://127.0.0.1:8000/docs`

### Step 5: Start the Next.js Frontend Dashboard
```bash
cd frontend
npm run dev -- -p 3000
```
Open `http://localhost:3000` to interact with **Screen A (Applicant Decision)** and **Screen B (Audit Logs)**.

---

## 4. Running the Test Suite

Run the full unified backend test suite (**32 unit and integration tests**):
```bash
python -m unittest discover -s backend/tests -v
```

Run frontend type checking and production build validation:
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 5. Authentication & Role-Based Access Control (RBAC)

FedCreditX implements a 5-checkpoint server-enforced authentication workflow:
1. **Interactive Role Selection on Sign-In:** Every Google sign-in prompts the user to select between **Bank Underwriting Officer** (*review applicants and record decisions*) and **Auditor** (*read-only access to audit trail and model governance*).
2. **Server-Side Token Verification & Allowlist Match:** The backend independently verifies Google ID tokens and checks the requested role against `AUDITOR_EMAILS` (and optional `OFFICER_EMAILS`).
3. **HTTP 403 on Unapproved Auditor Requests:** If an unapproved account requests the Auditor role, the server returns HTTP 403 (*"Your account is not approved as Auditor. Contact the administrator."*).
4. **Server-Side Role Storage:** Granted roles are persisted in the `server_sessions` table in SQLite, and all role checks on `/api/audit`, `/api/audit/export`, and `/api/metrics` are enforced on the server.
5. **Audit Logging:** Every sign-in attempt (`AUTH_ROLE_GRANTED` or `AUTH_ROLE_DENIED`) is logged in the SQLite audit trail.

For full architectural details and instructions on adding approved auditor accounts on Render via `AUDITOR_EMAILS`, refer to [docs/AUTH.md](docs/AUTH.md).

---

## 6. What FedCreditX Does NOT Claim

- **Not a Calibrated Real-World Credit Score:** This prototype generates model-estimated probabilities on synthetic distributions; it does not approve real bank loans or replace credit bureaus.
- **Human-in-the-Loop Primacy:** Prototype recommendations (Auto-approve, Send to review, Flag high risk) never autonomously disburse funds; authorized officers must confirm decisions.
- **Demo Audit Trail:** The local SQLite audit trail provides demonstration traceability, not a tamper-proof cryptographic production ledger.

