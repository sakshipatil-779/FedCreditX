# 12 — Build Plan (4–5 Focused Days)

## Operating rule

Build in vertical slices and keep a working branch at each stage. Do not postpone all integration to the final day. If a feature jeopardizes the core flow, narrow scope and record why.

## Day 1 — Foundations and baseline

**Objectives**
- Inspect repository/environment and choose compatible library versions.
- Create project structure, frontend/backend shells, and documented setup.
- Implement deterministic synthetic data generation and common feature schema.
- Implement PyTorch logistic-regression baseline and centralized synthetic benchmark.

**Deliverables**
- Data generator and data card.
- Baseline training script and metrics output.
- Backend `/api/health` endpoint.
- Next.js shell with the synthetic-data warning.
- Initial unit tests.

**Exit check**
- Fresh data generation works; model trains; metrics are finite and reproducible; feature schema is documented.

## Day 2 — Real Flower federation

**Objectives**
- Start from the official Flower/PyTorch example matching the current installed Flower API.
- Define one Flower client per simulated lender with local partition access.
- Complete FedAvg training and save the global model/metrics.
- Track run IDs/status; do not fake progress.

**Deliverables**
- Three-client Flower simulation.
- Saved global model artifact and model version.
- Real run result persisted/displayable.
- Smoke test and federated-training logs.

**Exit check**
- Three clients complete at least one true training/aggregation round. No raw training records are sent to central API/database.

## Day 3 — Scoring, explanation, and optional DP

**Objectives**
- Add local synthetic applicant cases per lender and score through selected lender workflow.
- Add SHAP or validated reason-code computation.
- Persist scoring and review audit events.
- Add Opacus DP path if the base FL path is stable.

**Deliverables**
- Working Applicant Lab.
- Model estimate, demo risk band, explanation, and disclaimer.
- Audit event writes/retrieval.
- If DP is done: configured settings and privacy accountant output, plus DP vs non-DP metrics.

**Exit check**
- Same case/model produces reproducible score/reasons; a review action creates a database record. DP is either genuinely verified or explicitly off.

## Day 4 — UI/API integration and test hardening

**Objectives**
- Complete overview, federation runs, metrics, applicant lab, audit trail.
- Add loading/empty/failure states.
- Test malformed data, missing model, failed clients, and sanitized errors.
- Try Flower SecAgg+ using the official current example if it does not threaten the core.

**Deliverables**
- Coherent dashboard flow.
- API/frontend integration tests or manual smoke checklist.
- SecAgg+ result: implemented and tested, or explicitly not implemented.

**Exit check**
- End-to-end flow works from a clean local run. No fake metric, fake privacy status, or hard-coded prediction.

## Day 5 — Reproducibility, stranger test, and pitch

**Objectives**
- Re-run setup from README in a clean environment.
- Fix critical defects and test UX with a person unfamiliar with the prototype.
- Record what users misunderstood and what changed.
- Finalize `BUILD_LOG.md`, research evidence tags, limitations, and a one-page build summary if required by HackFront.

**Deliverables**
- Reproducible setup/run/test instructions.
- Test outcomes and known issues.
- One short demo script.
- Evidence vs inference vs hypothesis vs assumption update.

**Exit check**
- A reviewer can reproduce the core flow and understand what is real, what is simulated, and what is unverified.

## Suggested daily rhythm

1. Define the one deliverable and acceptance test.
2. Implement only that slice.
3. Run tests and manually inspect behavior.
4. Ask an agent to critique the implementation against the relevant requirement IDs.
5. Fix critical mismatches.
6. Update `BUILD_LOG.md` with exact test results and unresolved risks.

## Risk register

| Risk | Likelihood/impact | Mitigation |
|---|---|---|
| Flower API/version mismatch | Medium/high | Start from current official example; pin the tested versions on Day 1. |
| Opacus integration slows training/convergence | Medium/high | Make DP P1; keep baseline FL path passing first. |
| SecAgg+ integration incompatible with chosen pattern | Medium/high | Treat as P2/stretch; use current official example; don't fake success. |
| SHAP explainer incompatible or confusing for selected model | Medium/medium | Validate shape/semantics early; use honest, model-derived reason-code fallback. |
| Frontend progress is fake or out of sync | Medium/high | Poll actual run status and persisted backend results. |
| Demo model performs poorly | Medium/medium | Keep synthetic target generation and metrics transparent; don't tune the test set or hard-code results. |
| Scope expands into product features | High/high | Enforce P0/P1/P2 and exclude auth, blockchain, live APIs, LLM chat. |

## Final reporting template

- Implemented requirements: IDs and evidence.
- Tests run: command, pass/fail, result summary.
- Privacy capabilities: each labelled implemented/tested, experimental, or not implemented.
- Model metrics: actual configuration and results.
- User test: task, observations, changes.
- Known limitations and assumptions.
- Next experiment worth doing only if a listed assumption is validated.
