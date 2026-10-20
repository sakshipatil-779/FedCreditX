# MASTER_BUILD_BRIEF.md — FedCreditX

## 1. Product in one paragraph

FedCreditX is a local, synthetic-data hackathon prototype that demonstrates how several simulated lenders can collaboratively train a simple credit-default model through federated learning while keeping each simulated lender's training partition in its own local client environment. A user can inspect the training run, compare federated metrics with a centralized synthetic-data baseline, score a preloaded synthetic applicant at a selected lender, inspect feature-level reasons, and view a demo audit trail.

## 2. Core question

Can a small, testable workflow combine (1) local training at multiple simulated lenders, (2) aggregation of model updates, and (3) a human-understandable explanation of a model-estimated default probability—without centralizing the raw training partitions?

This is a question to test, not a proven claim that the system will produce better predictions or that the market lacks comparable products.

## 3. Target users for the prototype

- **Primary:** a lending-risk analyst/underwriter who needs to understand how a demo model reached a risk estimate.
- **Secondary:** a fintech ML/engineering lead evaluating the mechanics and trade-offs of collaborative training.
- **Secondary:** a federation administrator monitoring simulated clients, training rounds, aggregate metrics, and run status.

These personas are hypotheses, not validated customer research. See `03_USER_PERSONAS.md`.

## 4. One main flow

1. Open the dashboard and confirm that three simulated lenders are configured.
2. Start a federated training run.
3. See actual run status, participating clients, completed rounds, and measured metrics.
4. Select a preloaded synthetic applicant held by one simulated lender.
5. Run inference with the current global model inside the simulated lender workflow.
6. See estimated default probability, clearly labelled demo risk band, and top positive/negative feature contributions or reason codes.
7. Record a human review outcome and inspect the audit event.

## 5. Approved stack

| Layer | Choice | Reason |
|---|---|---|
| Web UI | Next.js App Router + TypeScript + Tailwind CSS | Custom multi-panel fintech interface with typed UI and reusable components. |
| API | FastAPI + Pydantic schemas | Python-native API for model/federation operations and validation. |
| Federated learning | Flower | Purpose-built FL orchestration; follow a compatible official PyTorch example. |
| Model | PyTorch logistic regression | Small, interpretable baseline; no deep learning. |
| Differential privacy | Opacus | Add clipping/noise and privacy accounting to compatible local PyTorch training. |
| Secure aggregation | Flower SecAgg+ | Valuable privacy enhancement, but only included as implemented if the selected Flower workflow supports it and it passes tests. |
| Explainability | SHAP or explicit reason codes | Explain a specific prediction honestly; reason codes are the fallback if SHAP integration is unstable. |
| Database | SQLite | Simple local persistence for training runs, synthetic cases/results, decisions, and audit events. |
| Data | Generated synthetic records | Reproducible test fixtures; no real customer or financial records. |

Gemini or any other LLM is **not required for MVP**. Deterministic explanation templates are preferred first.

## 6. Privacy and claim boundaries

- The training workflow must keep each local training partition inside the corresponding simulated client process/folder; the central UI/API stores run metadata and aggregate metrics, not the training rows.
- The demo is run on one developer-controlled machine, so it does not prove security across independent institutions or deployment environments.
- FL by itself does not guarantee privacy. Model updates can leak information. Differential privacy and secure aggregation are separate mechanisms and need correct configuration and tests.
- Any privacy mode shown in the UI must correspond to a real configuration. Do not implement “DP ON” as a visual toggle that changes no training behaviour.
- No market-absence or superiority claim without independent market research and validation.

## 7. Build priorities

**P0 — must work:** generated dataset partitions; simple model; actual Flower federation; metric display; synthetic case scoring; explanation/reason codes; SQLite audit event; tests; clean README.

**P1 — important:** Opacus local-DP path with documented settings and measured impact; centralized baseline comparison; error/empty/loading states; a simple federation status view.

**P2 — only if stable:** Flower SecAgg+; privacy-performance comparison; robust charts; optional natural-language template improvements.

**Out of scope:** real lender onboarding, production authentication/authorization, live credit bureau/bank integrations, legal compliance claims, actual credit approvals/denials, blockchain, microservices for every module, deep learning, LLM chat, customer data uploads.

## 8. Success criteria

- A clean local setup works from README commands.
- Three simulated clients complete at least one real federated training run.
- The UI shows actual metrics from that run, not hard-coded values.
- A test applicant can be scored and the result explained using the current model.
- A review action creates a queryable audit record.
- Test suite covers model/data validation, API errors, federation smoke test, and scoring/explanation.
- Build notes distinguish evidence, inference, hypothesis, and assumption.
- Any incomplete feature is clearly declared.

## 9. Evidence discipline

Use `02_RESEARCH_EVIDENCE.md` as the only research-evidence ledger for the three selected papers. Do not invent their titles, authors, dates, numerical findings, or direct quotations. Market-product comparisons and customer pain are unverified unless a separately documented source/interview is added.

## 10. Recommended implementation references (technical, not research evidence)

- Flower + PyTorch quickstart: https://flower.ai/docs/examples/quickstart-pytorch.html
- Flower SecAgg+ example: https://flower.ai/docs/examples/flower-secure-aggregation.html
- Opacus PrivacyEngine docs: https://opacus.ai/api/privacy_engine.html
- Next.js App Router docs: https://nextjs.org/docs/app/getting-started
- FastAPI tutorial: https://fastapi.tiangolo.com/tutorial/
- SHAP documentation: https://shap.readthedocs.io/en/latest/

Check the current official documentation at implementation time; compatible library APIs can change.
