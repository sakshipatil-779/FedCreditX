# AGENTS.md — Rules for AI Coding Agents

## Mission

Build **FedCreditX**, a research-oriented demo of privacy-aware collaborative credit-risk modelling with explainable outputs. Treat the numbered project documents as the source of truth. If this file and a numbered spec conflict, stop and flag the conflict in the build notes instead of silently choosing.

## Required reading order

1. `MASTER_BUILD_BRIEF.md`
2. `00_PROJECT_CHARTER.md`
3. `01_PROBLEM_STATEMENT.md`
4. `02_RESEARCH_EVIDENCE.md`
5. `03_USER_PERSONAS.md`
6. `04_USER_WORKFLOWS.md`
7. `05_PRODUCT_REQUIREMENTS.md`
8. `06_MVP_SCOPE.md`
9. `07_UX_UI_SPEC.md`
10. `08_TECHNICAL_ARCHITECTURE.md`
11. `09_DATA_MODEL.md`
12. `10_SECURITY_AND_TRUST.md`
13. `11_VALIDATION_AND_TEST_PLAN.md`
14. `12_BUILD_PLAN.md`

## Non-negotiable engineering rules

- Use the approved stack: Next.js + TypeScript + Tailwind, FastAPI, Flower, PyTorch logistic regression, Opacus, SHAP, and SQLite.
- Do **not** use deep learning. The credit model must be a simple logistic-regression model implemented as a single PyTorch linear layer with a binary classification loss, or a comparably simple non-neural baseline if compatibility forces it. Document any deviation before proceeding.
- Use synthetic data only. Never request, check in, upload, or log real financial/customer data or personal identifiers.
- No real bank, NBFC, bureau, UPI, Account Aggregator, or payment-service integration.
- Do not present a risk score as a real-world credit score. Call it a **demo model-estimated default probability** and a **demo risk band**.
- All loan decisions are illustrative. Keep a human-review step; the application must not autonomously approve or reject real credit applications.
- Never claim “fully private,” “secure by design,” “production-ready,” “regulator-certified,” or “no market competitor exists.” State the limitations plainly.
- Federated learning means local training plus aggregation of model updates; it does not mean raw datasets are merged or that different records for one applicant are automatically combined.
- Federated learning alone is not a complete privacy guarantee. Do not claim differential privacy or secure aggregation is active unless it is implemented, configured, and test evidence is recorded.
- Do not send raw features, identifiers, free-text customer data, or training records to an external LLM. LLM explanation is optional and out of the core scope; use deterministic templates first.
- Keep secrets out of source control. Provide `.env.example` with placeholders only and ensure `.env`, SQLite DBs, generated datasets, model artifacts, and logs are ignored when appropriate.
- Pin compatible dependency versions after a clean install and smoke test. Do not guess library APIs; consult current official docs and use the relevant official Flower example as the starting point.

## Implementation principles

- Build in small, testable increments. Run targeted tests after each increment.
- Prefer one coherent end-to-end workflow to a broad collection of incomplete screens.
- Keep business logic out of UI components.
- Validate request schemas and reject malformed/oversized input.
- Return actionable error messages without exposing stack traces to the UI.
- Use explicit loading, empty, success, and failure states.
- Make the UI accessible: labels, keyboard focus, readable contrast, and non-colour-only risk indicators.
- Keep client data partitions separate on disk. Only the simulated lender client should read its own training partition in the demo design.
- Log training status, model version, aggregate metrics, privacy configuration, scoring events, and manual-review outcomes. Do not log raw training rows or sensitive feature values.
- Do not describe a SQLite audit table as immutable. It is a demo audit trail, not a tamper-proof production ledger.

## Required working style

1. Inspect the existing repository before creating or replacing files.
2. Report the initial project state briefly.
3. Create a small implementation checklist mapped to `05_PRODUCT_REQUIREMENTS.md` and `11_VALIDATION_AND_TEST_PLAN.md`.
4. Build the vertical slice first: deterministic synthetic data → baseline → Flower simulation → case scoring → explanation → audit event.
5. Add Opacus differential privacy after the non-private federated path passes tests.
6. Attempt Flower SecAgg+ only after checking compatibility with the selected Flower app pattern. If it cannot be completed and tested in time, document it as not implemented rather than faking the behavior.
7. Run backend tests, frontend checks, and the manual end-to-end smoke test. Fix failures rather than reporting success without evidence.
8. Update `README.md` with exact setup/run/test commands and known limitations.
9. Maintain a `BUILD_LOG.md` recording decisions, tests actually run, observed results, known issues, and which assumptions remain unvalidated.
10. At the end, provide a concise file/change summary, commands executed, test outcomes, unimplemented items, and exact local run instructions.

## Definition of done

The prototype is not done until a fresh run can (a) create or load synthetic lender datasets, (b) run a real Flower federated-training workflow rather than a fake animation, (c) display measured metrics, (d) score one synthetic applicant through the simulated lender workflow, (e) show honest feature contributions/reasons, (f) persist an audit event, and (g) pass the tests required in `11_VALIDATION_AND_TEST_PLAN.md`.
