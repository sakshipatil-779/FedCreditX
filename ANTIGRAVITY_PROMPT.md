# Copy-paste prompt for Antigravity

Paste the complete prompt below into Antigravity after placing this documentation pack at the root of the target repository.

---

You are the lead engineer implementing **FedCreditX**, a privacy-aware collaborative credit-risk research prototype. The repository contains `AGENTS.md`, `MASTER_BUILD_BRIEF.md`, and `00_PROJECT_CHARTER.md` through `12_BUILD_PLAN.md`. Read them before changing code, and treat them as the source of truth.

## Objective

Build a genuinely working, locally reproducible end-to-end prototype using this stack:

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: FastAPI + Pydantic
- Federated learning: Flower using a current compatible PyTorch example/API
- Model: PyTorch logistic regression only (single linear layer; **no deep learning**)
- Differential privacy: Opacus, after baseline federated training works
- Explanation: SHAP if the chosen implementation is valid; otherwise model-derived reason codes with honest labelling
- Database: SQLite
- Data: synthetic only
- Flower SecAgg+: attempt only after checking compatibility with the chosen Flower setup; do not fake or overclaim it

## Before coding

1. Inspect the current repository and environment. Do not delete or overwrite existing work without inspection.
2. Read `AGENTS.md`, `MASTER_BUILD_BRIEF.md`, and all numbered specs.
3. Briefly report existing files, detected runtimes, and any blocking issue.
4. Create/maintain `BUILD_LOG.md` with dated decisions, tests actually run, observed outcomes, unresolved issues, and evidence/hypothesis distinctions.
5. Make a checklist mapped to requirement IDs in `05_PRODUCT_REQUIREMENTS.md`.
6. Check current official documentation for Flower, Opacus, Next.js, FastAPI, and SHAP. Pin a compatible set of dependencies only after a clean install and smoke test. Do not guess old API signatures.

## Implementation order — follow this sequence

### Phase A: runnable skeleton and synthetic data
- Create `frontend/` and `backend/` with readable, conventional structure.
- Implement a deterministic synthetic credit dataset generator with three lender partitions and a common feature schema.
- Add a data card documenting generation assumptions, seed, target construction, and limitations.
- Exclude real PII and protected attributes from predictive features.
- Implement and test a PyTorch logistic-regression baseline, centralized synthetic evaluation, and saved model artifact.
- Establish FastAPI health route and basic Next.js dashboard shell.
- Add `.gitignore` and `.env.example`; no secrets or real data.

### Phase B: genuine federated training
- Start from the current official Flower/PyTorch quickstart pattern compatible with your pinned Flower version.
- Make three simulated clients read only their own local partition and train locally.
- Use a documented aggregation method such as FedAvg.
- Complete a real Flower run and persist actual run status, rounds, model version, and metrics.
- Do not simulate training progress with a timer or hard-coded metric. Do not send raw training rows to the coordinator or central database.
- Add a smoke test proving three clients participate and model aggregation completes.

### Phase C: scoring, explanation, and audit
- Add synthetic applicants stored inside the selected lender's local demo-data area; expose synthetic IDs in UI, not personal names or raw features.
- Score a selected case through the simulated lender-local path using the current global model.
- Display **model-estimated default probability** and a clearly defined **demo risk band**; do not call it a real credit score or an approval/decline decision.
- Add SHAP only if its values/semantics are verified for this model. Otherwise add correctly calculated, model-derived reason codes and label them accordingly.
- Show model version, training run ID, explanation method, and an attribution-not-causation disclaimer.
- Add review states: `reviewed`, `need_more_information`, and `escalate_human_review`.
- Persist training, scoring, and review audit events in SQLite. Do not label the log immutable.

### Phase D: privacy mechanisms
- Only after the base FL path passes, add Opacus to the local training loop. Record the exact DP configuration and valid accountant output. Confirm the privacy option really changes training behavior.
- Compare privacy-off and DP-enabled model metrics using comparable synthetic evaluation, and document privacy/utility trade-offs.
- Then inspect the current official Flower SecAgg+ example. Implement it only if it fits this architecture and you can demonstrate a real working protocol run. Otherwise keep SecAgg+ marked “not implemented” and document the blocker.
- Federated learning alone is not a complete privacy guarantee. Never show DP/SecAgg+ as enabled unless the implementation is tested.

### Phase E: product UI
Implement the smallest coherent dashboard supporting these pages or equivalent views:
1. Overview and synthetic-data banner
2. Federation runs/status
3. Applicant Lab and explanation
4. Experiment metrics
5. Audit trail
6. About/limitations

Every action must show honest loading, success, empty, or failure states. UI metrics must come from backend run results, not constants. Do not add authentication complexity, LLM chat, blockchain, live lender integrations, or deep learning to the MVP.

### Phase F: verification and handoff
- Run the tests described in `11_VALIDATION_AND_TEST_PLAN.md`.
- Test an empty input, oversized/malformed input, missing model artifact, client/federation failure, and database/API error handling.
- Verify audit/logs contain no raw training rows, personal data, secrets, or raw feature values.
- Execute an end-to-end run from the README instructions.
- If any requirement is incomplete, mark it honestly; do not hide it behind UI.
- Update `README.md` with exact installation, seed-data generation, training, running frontend/backend, and test commands.
- Update `BUILD_LOG.md` with actual test outcomes, model metrics, privacy status (tested/experimental/not implemented), limitations, and the evidence-vs-hypothesis position.

## Definition of done

At minimum, a fresh local run must generate three synthetic lender partitions, train through a genuine Flower federation, display actual metrics, score one synthetic applicant using the current global model, show matching model-derived explanatory output, and save/retrieve a human-review audit event. P0 tests must pass. The UI must visibly state that this is a synthetic research demo, not a real lending system.

## Working style

Do not ask me to reconfirm requirements already written in the files. If a non-blocking detail is unspecified, make the simplest defensible decision, document it, and continue. If a critical conflict or blocker exists, explain the conflict and implement the safest smaller scope. Work incrementally, run tests, and report only results that you actually observed. Do not claim completion merely because files were generated.

Start now by inspecting the repository and returning a brief plan/checklist, then implement Phase A.

---
