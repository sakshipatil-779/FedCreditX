# FedCreditX — Build Summary (Executive Summary)

**Project Name:** FedCreditX: Privacy-Aware Collaborative Credit-Risk Assessment with Explainable Outputs  
**Innovation Theme:** Privacy-Preserving Collaborative Artificial Intelligence in Regulated FinTech & Multi-Institutional Credit Intelligence  
**Repository:** [https://github.com/sakshipatil-779/FedCreditX](https://github.com/sakshipatil-779/FedCreditX)  
**Hosted Prototype Application:** [https://fedcreditx.onrender.com/](https://fedcreditx.onrender.com/)  
**Document Type:** 1-Page Cohort Executive Summary  

---

## 1. Theme
The project is registered under the Innovation Theme: **Privacy-Preserving Collaborative Artificial Intelligence in Regulated FinTech & Multi-Institutional Credit Intelligence**. It investigates how commercial banks, non-banking financial companies (NBFCs), and digital FinTech lenders can collaboratively train credit-risk models on distributed customer repayment patterns without centralizing raw customer records or violating data-sovereignty mandates.

---

## 2. Problem Statement
**Final Problem Statement:** Commercial lending institutions possess private, siloed repayment datasets containing predictive credit signals for thin-file and near-prime borrowers, but data-protection regulations (GDPR, DPDP Act) and competitive barriers prevent pooling raw records into a centralized repository. Simultaneously, black-box credit models lack the interpretability required by risk committees and underwriters. FedCreditX addresses this by providing a verifiable, local-first workflow where decentralized lenders collaboratively train a differential-privacy-compliant credit model, generate exact LinearSHAP risk attributions, and enforce human-underwriter override governance and senior approval escalation backed by an immutable SQLite audit trail.

**Problem Evolution (One Sentence):** *The problem evolved from an initial theoretical question of whether federated learning alone could replace credit bureaus to a pragmatic, regulation-focused realization that collaborative training requires formal differential privacy ($\varepsilon$-accounting) to prevent reconstruction attacks, transparent linear/tree explanations rather than ungrounded neural scores, and mandatory human underwriter oversight with traceable override governance.*

---

## 3. What We Built
We built **FedCreditX**, a functional vertical-slice prototype demonstrating a complete, auditable credit underwriting and collaborative modeling workflow:
1. **Decentralized Data Partitions:** Three distinct synthetic lender partitions (Lender A: Prime Commercial, Lender B: Consumer NBFC, Lender C: Digital FinTech) with zero cross-tenant raw data contamination.
2. **Federated Learning + Differential Privacy (FL + DP):** A PyTorch logistic regression model trained across isolated client nodes using Flower FedAvg, secured with Opacus DP-SGD ($\varepsilon = 2.2069, \delta = 10^{-4}, C = 1.0, \sigma = 1.0$) to provably bound individual record memorization.
3. **Exact LinearSHAP Attributions & Interpretable Baseline:** Applicant risk scoring with top 3 directional risk drivers derived from exact feature attributions ($\phi_i = w_i \cdot z_i$), cross-validated against a deterministic Decision Tree baseline (`DecisionTreeClassifier`, depth=5).
4. **Underwriting Sign-Off & Senior Approval Escalation:** A bank underwriter workflow enabling immediate approval, rejection, or escalation to Senior Officers via an asynchronous `approval_tracking` and `approval_history` engine with mandatory documented justification for any model override.
5. **Google Identity & Role-Based Access Control (RBAC):** Firebase/Google authentication isolating Bank Underwriting Officer permissions from Senior Compliance Auditor capabilities (restricting the Holdout Benchmark to authorized auditors).

**What We Deliberately Did Not Attempt:**
- Did **not** use deep neural networks or complex ensembles (strictly forbidden by project charter to ensure auditability).
- Did **not** process real customer PII or connect live banking APIs / bureaus.
- Did **not** implement autonomous, unreviewed lending decisions (decisions are illustrative demos requiring human review).
- Did **not** implement production blockchain consensus or micro-frontends (unnecessary architectural bloat for a vertical slice).

---

## 4. Technology Stack

| Layer | Technology Selected | Selection Rationale |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router) + TypeScript + Tailwind CSS | Institutional SaaS interface inspired by modern fintech design (Denezo design language), providing strict client-side typing and reactive workflow state. |
| **Authentication** | Google Identity / Firebase Authentication REST | Strict role-based session isolation (Bank Officer vs. Senior Compliance Auditor) without storing plaintext passwords. |
| **Backend API** | FastAPI + Pydantic v2 | Python-native asynchronous REST backend with strict request validation, structured error handling, and direct ML engine bindings. |
| **Federated Learning** | Flower (`flwr` 1.13) | Industry-standard federated learning framework implementing multi-round client parameter aggregation (`NumPyClient`). |
| **Privacy Engine** | Opacus 1.6 (PyTorch DP-SGD) | Provable $(\varepsilon, \delta)$-differential privacy with per-sample gradient clipping and Gaussian noise injection. |
| **Credit Risk Engine** | PyTorch Logistic Regression + LinearSHAP | Single linear classification layer ensuring mathematical convexity, exact LinearSHAP attribution, and zero black-box opacity. |
| **Interpretable Baseline** | Scikit-Learn `DecisionTreeClassifier` | Deterministic split-path benchmark for comparative underwriter transparency. |
| **Audit Ledger** | SQLite with WAL Mode | Zero-configuration, ACID-compliant local audit trail logging runs, scoring inferences, override reasons, and approval transitions. |

---

## 5. Evidence Position

- **Verified Claims:**
  - Synthetic data generation produces reproducible partitions with statistically distinct default characteristics (Lender A: 7.7%, Lender B: 44.2%, Lender C: 42.8%).
  - FL + DP Logistic Regression trains reproducibly across clients, achieving held-out AUROC of **0.8077** (non-private FL: **0.8071**; pooled baseline: **0.8069**), demonstrating near-zero utility loss under formal privacy.
  - LinearSHAP values match exact model logit deviations and accurately flag risk-increasing drivers (e.g., credit utilization, short credit history).
  - Multi-round Opacus DP accumulation accurately tracks privacy spend via Rényi Differential Privacy ($\varepsilon = 2.2069$ across 3 rounds).
  - All 19 backend unit/integration tests and Next.js production builds pass cleanly with 0 errors.
- **Untested Assumptions:**
  - Real-world non-IID distributions across commercial banks may exhibit feature-shift severities greater than synthetic beta distributions.
  - LinearSHAP explanations assume feature independence, which may understate collinear macro-economic factors in real portfolios.
- **Required Additional Evidence:** Empirical validation on anonymized institutional credit datasets under actual inter-bank network latency.

---

## 6. What We Would Build Next
The immediate next capability is **Secure Aggregation (SecAgg+) Protocol Integration** with hardware-assisted cryptographic enclaves. While client data remains locally on disk, intermediate gradient updates sent to the coordinator could theoretically be vulnerable to gradient inversion attacks if the coordinator is compromised. Implementing cryptographic secure multiparty aggregation (SMPC) would guarantee that the central server observes only the summed vector $\sum w_k$ and never individual client weights. This effort would be justified once two or more independent financial institutions enter a pilot consortium requiring mathematical non-disclosure of local gradient vectors.
