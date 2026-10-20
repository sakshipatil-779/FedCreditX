# 02 — Research Evidence Ledger (Three Selected Papers Audit)

## Purpose and source discipline

This file records what can responsibly be carried forward from the rigorous audit of the three peer-reviewed research papers provided in `research/papers/`. Every bibliographic detail, section reference, quantitative metric, and limitation below has been directly extracted and verified from the original PDF documents.

In accordance with HackFront evidence discipline:
- **Evidence** is strictly grounded in the audited text and tables of the three papers.
- **Inference** represents engineering interpretations connecting paper findings to our prototype design.
- **Hypotheses** are testable propositions requiring empirical validation in our synthetic benchmark or practitioner tests.
- **Assumptions** are declared operational constraints.
- No citations, authors, DOIs, numerical findings, or market claims have been fabricated.

---

## Paper-level verified findings

### P1 — Privacy-Preserving Risk Prediction and Sensitive Data Detection in FinTech Platforms: A Hybrid Approach for Secure and Intelligent Early Warning

- **Exact Title:** Privacy-Preserving Risk Prediction and Sensitive Data Detection in FinTech Platforms: A Hybrid Approach for Secure and Intelligent Early Warning
- **Author:** Ye Ju
- **Affiliation:** College of Applied Arts and Science of Beijing Union University, Beijing, 100191, China (E-mail: `juyejulia@gmail.com`)
- **Publication Venue:** *Journal of Cyber Security and Mobility*, Vol. 14, Issue 4 (Vol. 14_4), pp. 877–900
- **Publication Year:** 2025 (Received: 30 June 2025; Accepted: 14 August 2025)
- **Publisher:** River Publishers
- **DOI / URL:** [10.13052/jcsm2245-1439.1445](https://doi.org/10.13052/jcsm2245-1439.1445)

#### Main contribution
Proposes a modular, three-layer, regulation-aware early warning system for FinTech platforms integrating:
1. Automated sensitive data detection and redaction using transformer-based Named Entity Recognition (BERT), regex patterns, and domain-specific ontologies (Section 3.1, pp. 883–885).
2. Privacy-preserving risk prediction using Federated Learning (FedAvg) combined with Differential Privacy (DP-SGD with moments accountant) over non-IID data partitions across decentralized nodes (Section 3.2 & 4.3, pp. 885–886, 889–891).
3. Cryptographically auditable real-time alerting with an administrative feedback loop and a 4-tier severity hierarchy (Informational, Warning, High, Critical) (Section 3.3 & 4.4, pp. 886–888, 891–893).

#### Verified findings relevant to FedCreditX
- **Federated DP-SGD Parameterization (Section 4.3, pp. 889–891):** Client nodes train locally on non-IID data; gradient sensitivity is bounded using a clipping norm of $1.0$; calibrated Gaussian noise with standard deviation $\sigma = 1.1$ is injected; privacy budget $\varepsilon$ is tracked via the moments accountant method.
- **Empirical Privacy vs. Utility Trade-Off (Table 2, p. 890):**
  - Baseline without DP ($\varepsilon = \infty$): $\text{F1} = 0.924$, $\text{AUROC} = 0.961$, $\text{Precision} = 0.918$, $\text{Recall} = 0.930$.
  - Modest DP ($\varepsilon = 10.0$): $\text{F1} = 0.908$, $\text{AUROC} = 0.952$, $\text{Precision} = 0.903$, $\text{Recall} = 0.914$.
  - Balanced DP ($\varepsilon = 5.0$): $\text{F1} = 0.891$, $\text{AUROC} = 0.942$, $\text{Precision} = 0.886$, $\text{Recall} = 0.897$.
  - GDPR-aligned target ($\varepsilon = 3.0$): $\text{F1} = 0.872$, $\text{AUROC} = 0.926$, $\text{Precision} = 0.861$, $\text{Recall} = 0.884$ (demonstrating that utility degradation remains modest under practical regulatory constraints).
  - Strong privacy ($\varepsilon = 1.0$): $\text{F1} = 0.804$, $\text{AUROC} = 0.884$, $\text{Precision} = 0.796$, $\text{Recall} = 0.812$.
- **Latency & Scalability (Section 4.4, p. 891):** In a 10-node federated simulation under 50 concurrent user sessions, end-to-end alert latency averaged $187\text{ ms} \pm 23\text{ ms}$; critical alerts escalated in 1–2 seconds.
- **Administrative Feedback Loop (Section 4.4, p. 892):** Human-in-the-loop administrative review reduced long-term false positives by 18% over a two-week simulation.
- **Regulatory Framework Mapping (Section 2, pp. 880–883):** Explicitly maps pipeline stages to GDPR, PCI-DSS, PSD2, eIDAS, APPI, and PIPA compliance mandates.

#### Explicit limitations and research gaps supported by the paper
- **Auditing layer lacks explainability (Section 6, p. 896):** The paper explicitly notes as future work: *"Lastly, we will extend the system's auditing layer with explainability modules and dynamic policy adaptation to further align with evolving regulatory requirements and ethical AI principles."* The paper does not provide prediction-level feature attributions or explainable underwriter outputs.
- **Hardware-backed security needed (Section 6, p. 896):** Future work notes the need for hardware-backed Trusted Execution Environments (Intel SGX) to protect against malicious nodes.
- **Absence of zero-day threat discovery (Section 6, p. 896):** Relies on known entity and anomaly patterns; lacks unsupervised contrastive learning or graph neural networks for novel zero-day threats.
- **Data scope:** Tested on synthetic transaction, session, and communication logs, not on multi-institutional credit portfolio datasets.

---

### P2 — Scaling Secure Fintech Applications With Micro Frontends: A Case Study in Regulated Environments

- **Exact Title:** Scaling Secure Fintech Applications With Micro Frontends: A Case Study in Regulated Environments
- **Author:** Roman Fedytskyi (Senior Member, IEEE)
- **Affiliation:** ORSNN, Seattle, WA 98121, USA (E-mail: `fedytskyi@gmail.com`)
- **Publication Venue:** *IEEE Access*, Vol. 14, pp. 5178–5196
- **Publication Year:** 2026 (Received: 29 October 2025; Accepted: 24 November 2025; Published: 27 November 2025; Current version: 12 January 2026)
- **Publisher:** IEEE
- **DOI / URL:** [10.1109/ACCESS.2025.3638252](https://doi.org/10.1109/ACCESS.2025.3638252)
- **IEEE Article ID:** 11270827

#### Main contribution
Presents an empirical, 18-month longitudinal case study of ORSNN (an institutional investment financial services platform) migrating from a monolithic frontend to a federated micro frontend architecture using Webpack Module Federation and React. Quantifies operational, performance, security, and developer productivity impacts in a regulated financial environment subject to SOC 2, ISO 27001, and PCI-DSS.

#### Verified findings relevant to FedCreditX
- **Performance Optimization (Section VIII.A, p. 5188; Table 6; Section X.A, p. 5194):**
  - Largest Contentful Paint (LCP) improved by 37% (3.8 s to 2.4 s).
  - First Contentful Paint (FCP) improved by 36% (2.2 s to 1.4 s).
  - Time to Interactive (TTI) reduced by 35% (4.9 s to 3.2 s).
  - Initial JavaScript bundle size decreased by 35% (4.2 MB to 2.7 MB).
- **Deployment Agility & Compliance Adaptation (Section VIII.B, p. 5189; Table 7):**
  - Deployment frequency increased by 278% (from 2.1 to 8.0 releases per week).
  - Mean Time to Production (MTTP) reduced by 64% (from 14.2 days to 5.1 days).
  - Time to implement new regulatory/compliance requirements reduced by 61% (from 18.4 days to 7.2 days) due to domain isolation.
- **Frontend Security Best Practices (Section IV.A–D, pp. 5182–5184):**
  - Storing authentication tokens in application memory rather than browser `localStorage` or `sessionStorage` mitigates token theft via Cross-Site Scripting (XSS).
  - Domain-isolated audit logging with cryptographic nonces ensures traceable frontend actions without cross-tenant data contamination.

#### Explicit limitations and research gaps supported by the paper
- **Single-case study (Section X.C, p. 5194):** Findings are derived from a single organization (ORSNN); generalizability is constrained by organizational maturity and scale.
- **Technology specificity (Section X.C, p. 5194):** Heavily coupled to Webpack Module Federation and React.
- **Maturity horizon (Section X.C, pp. 5194–5195):** 18-month window does not evaluate 3–5 year risks such as shared dependency version drift, domain boundary erosion, and remotes coordination overhead.
- **Critical boundary distinction:** Paper 2 is strictly a study of **software architecture (micro frontends)**. The term "federation" refers exclusively to Webpack Module Federation (dynamic loading of JavaScript bundles). Paper 2 contains **zero machine learning, zero credit risk modeling, and zero federated learning**.
- **Product decision for FedCreditX:** Adopt modular component design and frontend security hygiene (memory state, strict separation of concerns, clear audit events), but **explicitly do not implement micro frontends or multi-service infrastructure** for this prototype.

---

### P3 — Heterogeneous Privacy-Preserving Blockchain-Enabled Federated Learning for Social Fintech

- **Exact Title:** Heterogeneous Privacy-Preserving Blockchain-Enabled Federated Learning for Social Fintech
- **Authors:** Hu Xiong (Senior Member, IEEE), Ye Xia, Yaxin Zhao, Abubaker Wahaballa, and Kuo-Hui Yeh (Senior Member, IEEE; Corresponding Author)
- **Affiliations:**
  - Hu Xiong, Ye Xia, Yaxin Zhao: School of Information and Software Engineering, University of Electronic Science and Technology of China (UESTC), Chengdu 610054, China.
  - Abubaker Wahaballa: Department of Computer Science and Engineering, Southern University of Science and Technology, Shenzhen 518055, China.
  - Kuo-Hui Yeh: Department of Information Management, National Dong Hwa University, Hualien 97401, Taiwan (E-mail: `khyeh@gms.ndhu.edu.tw`).
- **Publication Venue:** *IEEE Transactions on Computational Social Systems*, Vol. 12, No. 6, pp. 5229–5244
- **Publication Year:** 2025 (Received: 15 October 2024; Revised: 1 January 2025; Accepted: 10 January 2025; Published: 13 February 2025; Current version: 3 December 2025)
- **Publisher:** IEEE
- **DOI / URL:** [10.1109/TCSS.2025.3533634](https://doi.org/10.1109/TCSS.2025.3533634)
- **IEEE Article ID:** 10884960

#### Main contribution
Proposes the Heterogeneous Privacy-Preserving Blockchain-Enabled Federated Learning (HPP-BEFL) system to resolve single points of failure (SPF), inference attacks (IA), man-in-the-middle attacks (MMA), and cryptographic system heterogeneity across social FinTech participants belonging to different cryptographic systems (Public Key Infrastructure / PKI vs. Identity-Based Cryptography / IBC).
The framework develops two foundational cryptographic schemes:
1. **PKI-IB-HAAGKA:** A PKI and Identity-Based Heterogeneous Authenticated Asymmetric Group Key Agreement protocol.
2. **PKI-IB-HBMS:** A PKI and Identity-Based Heterogeneous Batch Multisignature scheme serving as a cryptographic building block.

#### Verified findings relevant to FedCreditX
- **Vulnerability of Raw Federated Learning Updates (Section I & III, pp. 5229–5231):** Formally details that decentralized data retention is insufficient on its own: gradient and model weight updates transmitted to a central aggregator remain susceptible to inference attacks and membership disclosure, motivating cryptographic protection (or DP) for transmitted updates.
- **Cryptographic Security Proofs (Section VI.B, p. 5237):** Proves confidentiality against Chosen-Plaintext Attacks (IND-CPA) under the decisional Bilinear Diffie-Hellman Exponent ($k$-BDHE) hardness assumption.
- **Federated Training Dynamics (Section VI.C, p. 5237; Table III):** Demonstrates convergence of distributed learning with client fraction $C = 0.1$, local epochs $E = 5$, batch size $B = 10$, SGD momentum $0.5$, and learning rate $\eta = 0.01$.

#### Explicit limitations and research gaps supported by the paper
- **Asymmetric security protection (Section VII, p. 5238):** The paper explicitly admits: *"However, the proposed HPP-BEFL primarily addresses the security of the local model upload process, overlooking the security aspects of the global model download. Therefore, it is essential to explore additional approaches to secure the downloading process."*
- **Cryptographic scope restriction (Section VII, p. 5238):** Resolves heterogeneity strictly between PKI and Identity-Based systems; does not support other cryptographic mechanisms or wider operational heterogeneity.
- **Domain and model gap:** Experiments in Section VI.C (p. 5237) were conducted exclusively on computer vision benchmarks (**MNIST** digit recognition and **CIFAR-10** image classification) using Convolutional Neural Networks (**CNN**). The paper did **not** test tabular financial or credit risk data.
- **Overhead:** Blockchain consensus mechanisms, smart contract execution, and bilinear pairing operations introduce substantial latency and computational overhead.
- **Absence of explainability:** Does not provide feature-level attributions, explainable risk outputs, or underwriter-understandable reasoning.
- **Product decision for FedCreditX:** Adopt the principle that model updates require privacy protection, but **explicitly exclude blockchain, deep neural networks, and pairing cryptography** from our prototype in favor of Flower federated orchestration and Opacus differential privacy.

---

## Cross-Paper Synthesis & Solution Mapping

The table below maps the architectural components of FedCreditX to the explicit evidentiary support provided by the three audited papers:

| FedCreditX Component | P1 (Ju, 2025) | P2 (Fedytskyi, 2026) | P3 (Xiong et al., 2025) | FedCreditX Synthesis & Architecture Decision |
|---|---|---|---|---|
| **Federated Learning Orchestration** | Supported (FedAvg on non-IID partitions) | Not supported (uses Module Federation) | Supported (Blockchain-enabled FL) | Implement Flower FedAvg across 3 simulated lender partitions; no central raw-data merging. |
| **Differential Privacy (DP)** | Supported (DP-SGD, moments accountant, $\varepsilon = 1.0 - 10.0$) | Not addressed | Not addressed (uses cryptography) | Implement Opacus PrivacyEngine with calibrated clipping and noise accounting. |
| **Model Architecture** | Uses neural temporal encoders | Not addressed | Uses CNNs on image data (MNIST/CIFAR-10) | Adopt transparent PyTorch Logistic Regression; deep learning explicitly excluded. |
| **Domain Data Type** | Synthetic transactions & logs | Institutional investment UI workflows | Image benchmarks (MNIST, CIFAR-10) | Address the empirical gap: generate tabular synthetic credit records with financial features. |
| **Prediction Explainability** | **Explicitly noted as future work / research gap** (p. 896) | Not addressed | Not addressed | Address the documented research gap: integrate prediction-level feature attributions (SHAP) and reason codes. |
| **Human-in-the-Loop Review** | Supported (Administrative feedback loop, 18% FP reduction) | Supported (RBAC & manual approvals) | Not addressed | Implement underwriter review workflow (`Reviewed`, `Need More Info`, `Escalate`). |
| **Audit Trail & Governance** | Supported (auditable alert logs) | Supported (tamper-evident frontend audit logs) | Supported (blockchain ledger) | Implement SQLite demo audit event trail recording model version, run ID, and safe metadata. |
| **Modular System Architecture** | Supported (3-layer modular architecture) | Supported (Module Federation, domain isolation) | Supported (Modular crypto protocols) | Build clean modular separation: Next.js frontend, FastAPI backend, Flower ML engine. |

---

## Evidence vs Inference vs Hypothesis vs Assumption

To maintain strict scientific and engineering rigor, every claim is classified according to the HackFront taxonomy:

| ID | Statement / Claim | Category | Basis / Verification Reference |
|---|---|---|---|
| **E1** | P1 demonstrates federated risk modeling using FedAvg and DP-SGD on non-IID partitions, maintaining $\text{F1} > 0.85$ at $\varepsilon = 3.0$ with 187 ms alert latency and 18% false-positive reduction via human review. | **Evidence** | Ju (2025), *JCSM*, Table 2 (p. 890), Section 4.4 (pp. 891–892). |
| **E2** | P1 explicitly identifies user-level explainability as an unaddressed limitation to be developed in future work. | **Evidence** | Ju (2025), *JCSM*, Section 6 (p. 896). |
| **E3** | P2 proves that frontend domain isolation reduces regulatory implementation time by 61% and MTTP by 64% in a regulated investment platform, but does not involve machine learning. | **Evidence** | Fedytskyi (2026), *IEEE Access*, Table 7 (p. 5189), Section X.A (p. 5194). |
| **E4** | P3 proves that raw federated model updates leak information under inference attacks, motivating cryptographic or DP defenses, but evaluates only CNNs on image datasets (MNIST/CIFAR-10) with blockchain overhead. | **Evidence** | Xiong et al. (2025), *IEEE TCSS*, Section I (pp. 5229–5231), Section VI.C (p. 5237), Section VII (p. 5238). |
| **I1** | A credit-risk prototype combining local data retention, differential privacy, prediction-level feature attributions, and an audit trail addresses genuine research gaps explicitly acknowledged in P1 and P3. | **Inference** | Derived from the cross-paper synthesis: P1 left explainability as future work; P3 showed update leakage and lacked tabular credit evaluation. |
| **I2** | Eliminating deep learning and blockchain in favor of PyTorch logistic regression, Flower, and Opacus reduces non-essential complexity while preserving the core privacy and collaborative learning evaluation. | **Inference** | Engineering decision based on hackathon constraints, interpretability requirements, and P3's heavy pairing overhead. |
| **H1** | Lending-risk analysts and underwriters will find prediction-level feature attributions (positive/negative reason codes) more interpretable and actionable than an unadorned probability score. | **Hypothesis** | Requires stranger testing and user evaluation in Applicant Lab (to be tested in Phase E/F). |
| **H2** | A federated logistic regression model trained across 3 simulated synthetic lender partitions can achieve predictive utility comparable to a centralized baseline. | **Hypothesis** | Requires empirical testing via baseline vs. Flower federated benchmark runs (Phase B/C). |
| **H3** | Injecting Opacus differential privacy noise into local logistic regression updates will exhibit a gradual, sub-linear utility degradation similar to the profile reported in P1. | **Hypothesis** | Requires empirical verification via DP on/off evaluation runs (Phase D). |
| **A1** | Three simulated lender partitions running on a single developer machine adequately illustrate multi-institutional data isolation for a research prototype. | **Assumption** | Operational scope constraint; does not prove multi-tenant cloud or network security. |
| **A2** | Participating institutions can agree on a shared synthetic feature schema and target definition. | **Assumption** | Necessary prerequisite for horizontal federated learning; real-world data harmonization is out of scope. |
| **A3** | The proposed integrated workflow represents an unfilled commercial product niche. | **Assumption / Unverified** | Unverified assumption. The three research papers motivate research directions but do not constitute an exhaustive market inventory. Market claims are explicitly excluded. |

---

## References to Implementation Documentation (Technical Guides Only)

The following references are technical guides for development and are explicitly distinguished from the peer-reviewed research papers above:
- **Flower PyTorch Quickstart:** [https://flower.ai/docs/framework/tutorial-quickstart-pytorch.html](https://flower.ai/docs/framework/tutorial-quickstart-pytorch.html)
- **Flower Secure Aggregation Guide:** [https://flower.ai/docs/framework/how-to-use-docker.html](https://flower.ai/docs/framework/)
- **Opacus PrivacyEngine API Reference:** [https://opacus.ai/api/privacy_engine.html](https://opacus.ai/api/privacy_engine.html)
- **Next.js App Router Documentation:** [https://nextjs.org/docs/app](https://nextjs.org/docs/app)
- **FastAPI Documentation:** [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
- **SHAP Documentation:** [https://shap.readthedocs.io/en/latest/](https://shap.readthedocs.io/en/latest/)

