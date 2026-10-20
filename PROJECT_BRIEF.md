# FedCreditX — Judge-Facing Project Brief

**Project:** FedCreditX (Privacy-Aware Collaborative Credit-Risk Modelling with Explainable Outputs)  
**Hackathon Track:** Privacy-Preserving AI / Responsible FinTech / Federated Systems  
**Workspace:** `E:\FedCreditX`  
**Status:** Validated Research Prototype & Demonstration Package  

---

## 1. Executive Summary & Problem Statement

Financial lending institutions face a fundamental tension:
- **Information Asymmetry & Data Silos:** Smaller lenders, digital FinTechs, and specialized banks often have limited or localized portfolio distributions (e.g. prime borrowers vs. thin-file gig-economy applicants). Pooling data across lenders would significantly improve credit default risk estimation.
- **Regulatory, Commercial & Privacy Barriers:** Under banking regulations (such as GDPR, Fair Credit Reporting Acts, and central bank data localization rules), lenders **cannot and must not merge raw borrower financial records** into a central data lake due to privacy risks, competitive sensitivity, and leakage of Personally Identifiable Information (PII).

**FedCreditX** explores how multiple simulated lending institutions can collaboratively train a shared credit default risk model through **Federated Learning** without transmitting, centralizing, or pooling their raw customer training partitions.

---

## 2. Proposed Approach & Collaboration Protocol

1. **Partition Isolation:** Each simulated lender (`Lender A: Prime Bank`, `Lender B: Consumer Growth`, `Lender C: Digital FinTech`) stores its training records strictly in a local client-controlled directory.
2. **Local Model Training:** Lenders receive global model weights, train locally on their private records using PyTorch, and calculate parameter gradients.
3. **Weight-Only Transmission:** Only numerical parameter weight updates ($\Delta w$) and sample counts ($N_k$) are shared with the central coordinator; raw rows, text, or applicant identifiers never leave the client.
4. **Federated Averaging (FedAvg):** The coordinator aggregates client updates using sample-weighted FedAvg and distributes the updated global model to participants.
5. **Leakage-Free Benchmark:** An independent, held-out test partition (900 synthetic records) is kept completely separate from all client training and scaling routines, enabling fair benchmarking against a centralized baseline.

---

## 3. Technical Architecture & Approved Stack

```
+-----------------------------------------------------------------------------------------+
|                                    FEDCREDITX ARCHITECTURE                              |
|                                                                                         |
|   [Next.js 16 Web Dashboard] <====== REST/JSON ======> [FastAPI Backend Service]       |
|    - High-Contrast FinTech UI                           - Endpoint Validation (Pydantic)|
|    - Applicant Lab & Attributions                       - Inference Coordination        |
|    - Audit Trail Viewer                                 - SQLite Demo Persistence       |
|                                                                                         |
|   [Flower Coordinator (Server)] <==== gRPC/Local ====> [3x Simulated Lender Clients]    |
|    - Multi-Round FedAvg                                 - Lender A (Prime)              |
|    - Holdout Set Evaluation                            - Lender B (Near-Prime)         |
|    - Versioned PyTorch Artifacts                        - Lender C (Digital FinTech)    |
|                                                                                         |
|   [Opacus DP-SGD Engine]                                [PyTorch Logistic Regression]   |
|    - L2 Gradient Clipping (C=1.0)                       - Single Linear Layer (No DL)   |
|    - Gaussian Noise (σ=1.0)                             - BCEWithLogitsLoss             |
|    - Persistent RDP Accountant (ε=2.2069)               - Exact Linear Attributions     |
+-----------------------------------------------------------------------------------------+
```

| Layer | Approved Technology | Implementation Details |
|---|---|---|
| **User Interface** | Next.js 16 (App Router) + TypeScript + Tailwind CSS | High-contrast dashboard with live model comparison, applicant lab, attribution bars, and audit explorer. |
| **Backend API** | FastAPI + Pydantic v2 | Python REST service with schema validation, sanitized error handling, and inference routing. |
| **Model** | PyTorch Logistic Regression | Transparent single-layer model (`in_features=8`, `out_features=1`) with `BCEWithLogitsLoss`. Deep neural networks are strictly excluded. |
| **Federation** | Flower (`flwr` v1.13.0) | Multi-process gRPC orchestration (`start_server` & `start_client`) and fast in-process simulation (`mode="sim"`). |
| **Differential Privacy** | Opacus (`opacus` v1.6.0) | Client-level DP-SGD with persistent Rényi Differential Privacy (`RDPAccountant`). |
| **Database** | SQLite (`fedcreditx.db`) | Local persistence for training runs, scoring outputs, human reviews, and audit events. |
| **Synthetic Benchmark** | NumPy + Pandas | Deterministic synthetic credit dataset with controlled financial distributions. |

---

## 4. Transparent Explainability (No Black Boxes)

Financial regulations (e.g. adverse action notices) require credit risk models to provide understandable reason codes:
- Instead of using ungrounded LLM text generation or computationally expensive post-hoc approximations, FedCreditX evaluates **exact linear feature attributions** directly from the trained PyTorch linear layer and standardization parameters:
  $$\hat{z} = \sum_{i=1}^M w_i \cdot \frac{x_i - \mu_i}{\sigma_i} + b, \quad \text{Attribution}_i = w_i \cdot x_{\text{norm}, i}$$
- The dashboard highlights top factors increasing risk (e.g. elevated debt-to-income or utilization) and factors decreasing risk (e.g. longer credit history, higher stable monthly income).

---

## 5. Human-in-the-Loop Oversight & Auditability

- **No Autonomous Approvals:** The application prohibits autonomous approval or rejection of loans.
- **Mandatory Review:** Every scored applicant requires an underwriter review action (`Approved`, `Need More Information`, `Confirmed High Risk`) with an associated rationale code.
- **Traceable Demo Audit Trail:** Review events, scoring inferences, and federated training runs are recorded with ISO UTC timestamps and actor labels in the SQLite `audit_events` table.

---

## 6. Scientific Experimental Evidence

All configurations were trained on strictly **2,880 samples** (960 rows $\times$ 3 lenders) and evaluated against the identical **900-sample holdout test set** (default prevalence: 28.67%, decision threshold $\tau = 0.50$):

| Configuration | Training Samples | Holdout Loss | AUROC | PR-AUC | F1-Score | Precision | Recall | Brier Score | Privacy Budget |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Centralized Baseline** (PyTorch LR, 40 Epochs) | 2,880 | **0.4652** | 0.8069 | 0.6304 | 0.5045 | 0.6099 | 0.4302 | **0.1546** | Non-private ($\varepsilon = \infty$) |
| **Flower FedAvg** (3 Clients, 5 Rnds, 3 Ep/rnd) | 2,880 | 0.4863 | **0.8071** | 0.6279 | 0.5664 | 0.5709 | 0.5620 | 0.1612 | Non-private ($\varepsilon = \infty$) |
| **Flower + Opacus DP-SGD** (3 Clients, 3 Rnds, 1 Ep/rnd) | 2,880 | 0.5685 | **0.8077** | **0.6306** | **0.6014** | 0.5401 | **0.6783** | 0.1908 | **$\varepsilon = 2.2069$** ($\delta = 10^{-4}$) |

### Key Scientific Takeaways
- **No Overclaiming:** The difference between centralized (0.8069) and federated (0.8071) AUROC is within statistical noise ($\Delta = +0.0002$); federated learning is not claimed as inherently superior in accuracy, but as achieving equivalent discriminative utility without centralizing data.
- **Calibration Trade-off:** Centralized learning achieves the best probability calibration (Brier score 0.1546 vs 0.1612).
- **DP-SGD Dynamics:** Noise injection ($\sigma = 1.0$) increases loss (0.5685) while shifting parameter weights, yielding higher sensitivity/recall (0.6783) at a bounded privacy cost.

---

## 7. Precise Privacy & Security Boundaries

To prevent misleading claims, the exact security boundaries are categorized honestly:

1. **Local Raw Data Retention (PASS):** Lenders never send raw borrower records, text, or customer tables to the central server.
2. **Sample-Level Differential Privacy (PASS):** Opacus DP-SGD guarantees bounded differential privacy for individual synthetic loan records within a client partition ($\varepsilon = 2.2069$ at $\delta = 10^{-4}$). By parallel composition across disjoint client datasets, the record-level guarantee across the entire federation is $\varepsilon = 2.2069$.
3. **Client-Level Differential Privacy (NOT CLAIMED):** Does not conceal whether an entire lending institution joined a round.
4. **Flower SecAgg+ (BLOCKED / UNIMPLEMENTED):** Multi-party cryptographic secure aggregation is documented as blocked by environment constraints rather than faked.
5. **Audit Trail Scope (DEMO ONLY):** SQLite table `audit_events` provides a demonstration event log, not an immutable cryptographic blockchain.

---

## 8. Limitations & Disclosures

- **Synthetic Data Exclusively:** All datasets are generated using NumPy/Pandas. No real customer or bank records exist in this workspace.
- **Model Simplification:** Built strictly with PyTorch logistic regression per project charter to guarantee explainability and avoid deep-learning opacity.
- **Single-Machine Simulation:** Demonstrates architectural separation using separate processes on a single development machine; does not demonstrate cross-cloud inter-bank network deployment.
- **Probability Calibration:** Risk scores are prototype-estimated probabilities, not credit bureau scores.

---

## 9. Reproducibility & Demonstration Pointers

- **Reproducibility & Presentation Script:** See [REPRODUCIBILITY_AND_DEMO_GUIDE.md](REPRODUCIBILITY_AND_DEMO_GUIDE.md) for full commands and a 5–7 minute live walkthrough.
- **Technical Audit & Mathematical Proofs:** See [FINAL_AUDIT_REPORT.md](FINAL_AUDIT_REPORT.md).
- **Quickstart & Test Commands:** See [README.md](README.md).
