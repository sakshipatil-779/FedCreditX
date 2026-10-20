# 08 — Technical Architecture

## Architecture principle

Keep the web product separate from the ML/federation runtime. Use three simulated lender clients and one Flower coordinator. The UI/API may display metadata and output, but central persistence must not store local training rows.

## Logical architecture

```text
Next.js + TypeScript + Tailwind
        |
        | typed HTTP requests
        v
FastAPI (Pydantic validation)
        |----------------------------- SQLite
        |                              run metadata / case result / audit events
        |
        | start/status/result orchestration
        v
Flower coordinator / simulation runtime
        |           |            |
        v           v            v
   Client A     Client B      Client C
   local data   local data    local data
   local train  local train   local train
        \           |           /
         \---- protected/ordinary model updates ----/
                         |
                  Aggregated global model
                         |
               saved model + metrics/version

Selected simulated lender's local case
        |
        v
Local inference with global model
        |
        v
probability + feature attribution/reason codes
        |
        v
FastAPI persists result metadata and review event
```

**Boundary note:** in the hackathon run, all simulated clients may execute on one machine. That demonstrates code/data-flow boundaries, not independent institutional isolation or production network security.

## Component responsibilities

### Frontend — Next.js App Router
- Dashboard, training status, metrics, synthetic applicant lab, audit history.
- API calls only; no ML/federation business logic in components.
- No real PII fields or file uploads.
- Use typed response objects and clear error states.

### Backend — FastAPI
- Validate request/response models using Pydantic.
- Expose endpoints for health, run start/status/history, metrics, sample synthetic applicants, scoring, review events, and audit events.
- Start/monitor the training runner in a way that does not block the API process for the whole training duration.
- Persist metadata/results, not central raw training data.
- Keep CORS limited to local frontend origin during development.

### ML model — PyTorch Logistic Regression
- One linear layer outputs a logit; use binary cross-entropy with logits for training.
- Use a deterministic feature order and preprocessing transformer shared by every client.
- Save preprocessing metadata and model version with weights.
- Validate finite tensors/weights and fail safely on schema mismatch.
- Avoid protected/sensitive features as model inputs. Use only explicit synthetic behavior/financial features.

### Federated runtime — Flower
- Build on the current official Flower + PyTorch quickstart compatible with the installed Flower version; do not copy an obsolete API blindly.
- Simulate three client apps/processes with isolated local data partitions.
- Use FedAvg or a comparable documented aggregator for baseline federation.
- Keep client code responsible for loading only its local partition, training locally, evaluating where configured, and returning the allowed model update/metrics.
- Coordinator records aggregate metadata and resulting model artifact.
- Do not upload raw training rows to the server or expose per-client sensitive metrics in the user-facing dashboard.

### Differential privacy — Opacus
- Add only after basic Flower training is reproducible.
- Apply to each local client training loop using the supported PrivacyEngine workflow.
- Record delta, noise multiplier, max gradient norm, sample/steps assumptions, privacy accountant output, and any relevant warning.
- Do not claim an epsilon guarantee unless the accountant result is correctly computed under the actual training configuration.
- Be aware DP can degrade model utility and small datasets can behave poorly.

### Secure aggregation — Flower SecAgg+
- Treat as a separate mechanism from DP.
- Inspect the official SecAgg+ example for the same current Flower app/runtime style.
- Integrate only when the chosen API pattern supports the intended model-update flow.
- A real test must demonstrate that the secure-aggregation workflow executes; a UI label or mock status is not sufficient.
- If not completed, show “not enabled/not implemented” and document why.

### Explainability — SHAP or reason-code fallback
- Explain the specific current model prediction, not a fabricated generic story.
- Use a SHAP explainer compatible with the selected model/output and verify its output shape/semantics.
- For a PyTorch linear model, verify whether the chosen SHAP explainer can be used consistently; if not, use a validated coefficient/contribution calculation and label it “model reason codes,” not SHAP.
- Define what positive/negative attribution means relative to the probability/logit. Do not conflate attribution magnitude with a causal effect.

### Persistence — SQLite
- Store runs, model metadata, synthetic scoring results, human review statuses, and audit events.
- No raw training partition central table.
- Persist safe metadata only.
- Use migrations/schema creation and tests for initialization.

## API contract (suggested)

All routes live under `/api` and return JSON. Exact route design may vary as long as acceptance criteria remain true.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Dependency/service health. |
| GET | `/api/overview` | Client simulation state and latest run summary. |
| POST | `/api/runs` | Start a real training run with validated configuration. |
| GET | `/api/runs` | List historical runs. |
| GET | `/api/runs/{run_id}` | Status, rounds, metrics, privacy settings and model version. |
| GET | `/api/cases?lender_id=...` | List synthetic local demo applicant IDs only. |
| POST | `/api/cases/{case_id}/score` | Score through selected lender-local simulation; return safe result and explanation. |
| POST | `/api/cases/{case_id}/review` | Save human-review outcome. |
| GET | `/api/audit` | List safe audit events. |

These are suggested contracts, not permission to centralize raw training rows. If a case feature vector is necessary for inference, load it within the selected simulated lender workflow rather than persist it in central SQLite.

## State management and training process

- Training is a long-running operation; the API should start a subprocess/job or other verified compatible runner and return a run ID promptly.
- Persist `queued`, `running`, `completed`, and `failed` states.
- Write logs/status to a controlled run directory, with raw data values excluded.
- Frontend polls the run endpoint at a conservative interval while a run is active; stop polling on terminal state.
- Prevent duplicate starts or clearly version each concurrent run. Simplest MVP: allow one run at a time.

## Repository layout (suggested)

```text
fedcreditx/
  AGENTS.md
  README.md
  BUILD_LOG.md
  docs/                         # these numbered specs
  frontend/
    app/
    components/
    lib/api.ts
    types/
  backend/
    app/main.py
    app/api/
    app/schemas/
    app/services/
    ml/model.py
    ml/preprocessing.py
    ml/explain.py
    federation/client_app.py
    federation/server_app.py
    federation/task.py
    data/generate_synthetic.py
    local_data/lender_a/         # generated; gitignored
    local_data/lender_b/         # generated; gitignored
    local_data/lender_c/         # generated; gitignored
    tests/
  scripts/
  .env.example
  .gitignore
```

Do not copy the documents into `docs/` at the expense of leaving the required root-level `AGENTS.md`; keep the root copy and optionally copy numbered specs into `docs/`.

## Technical setup references

- Flower/PyTorch: https://flower.ai/docs/examples/quickstart-pytorch.html
- Flower SecAgg+: https://flower.ai/docs/examples/flower-secure-aggregation.html
- Opacus: https://opacus.ai/api/privacy_engine.html
- Next.js: https://nextjs.org/docs/app/getting-started
- FastAPI: https://fastapi.tiangolo.com/tutorial/
- SHAP: https://shap.readthedocs.io/en/latest/
