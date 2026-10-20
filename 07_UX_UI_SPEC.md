# 07 — UX/UI Specification

## Design intent

Build a calm, credible fintech analytics dashboard. Prefer clarity and traceability over decorative animations. The UI must make clear that this is a synthetic research demo, not a real lending decision product.

## Information architecture

1. **Overview** — project purpose, demo-data banner, latest run, clients, main actions.
2. **Federation Runs** — start run, status, clients, rounds, model version, metrics, configuration.
3. **Applicant Lab** — choose lender, choose synthetic applicant, run model estimate, inspect explanation, record review.
4. **Experiment Metrics** — centralized vs federated comparison and (only when available) DP mode comparison.
5. **Audit Trail** — run, score, explanation, and review events.
6. **About & Limitations** — short research question, synthetic-only note, FL/DP/SecAgg definitions, non-production disclaimer.

The first implementation may use a shared shell and fewer pages if it still completes the main flow clearly.

## Global elements

- Product name: FedCreditX.
- Persistent banner: **SYNTHETIC DATA DEMO — NOT FOR REAL CREDIT DECISIONS**.
- Navigation with clear active state.
- Status labels that include text/icon, not colour alone.
- Small footer or About link to limitations and methodology.
- “Last updated” timestamp for metrics and audit views.

## Page specifications

### Overview

Show:
- One-sentence project description.
- 3 simulated lender cards (A, B, C), with honest state: Ready / Not started / Error.
- Last training run status and completed rounds.
- Latest measured AUC/F1 only when real metrics exist; otherwise show “No run yet,” never sample fake performance.
- Primary CTA: “Run federated training”.
- Secondary CTA: “Score a synthetic case”.

### Federation Runs

Show:
- Run ID, created/started/completed timestamps, status.
- Participating clients and round progress.
- Configuration: model type, number of rounds, DP state, SecAgg+ state.
- Model version/artifact identifier.
- Evaluation metrics with short definitions/help text.
- Clear run failure message and optional expandable developer details hidden from nontechnical summary.
- A note that local processes on one machine simulate the institution boundary.

### Applicant Lab

- Lender selector: Simulated Lender A/B/C.
- Applicant selector with synthetic IDs only (e.g. DEMO-A-001); no personal names.
- Button: “Run model estimate”.
- Result card heading: “Model-estimated default probability”.
- Show probability as a percentage only if the model output is a probability; label calibration status honestly.
- Show “Demo risk band” with the threshold mapping visible in help text.
- Show model version, training run ID, scoring time.
- Feature contribution chart/table with feature name, contribution direction, and magnitude. Do not display fake SHAP values; if using reason codes, label them as reason codes rather than SHAP.
- Explanation note: feature contribution is an attribution, not causation or a guarantee of fairness.
- Review actions: Reviewed, Need more information, Escalate for human review.
- Confirmation message includes audit event ID.

### Experiment Metrics

- Centralized baseline vs federated test metrics, sharing the same defined synthetic holdout where appropriate.
- Metrics: ROC-AUC, precision, recall, F1, confusion matrix; include threshold and class prevalence.
- If DP is implemented, compare with DP off/on runs and show actual privacy settings/accountant output.
- Explain that a higher score on a synthetic test set does not prove real-world generalization or commercial impact.
- Use no invented baseline numbers. Empty state before experiments are run.

### Audit Trail

- Table columns: time, event type, run/case reference, status, model version, privacy mode, safe metadata.
- Filters may include event type/run ID.
- Do not expose raw feature vectors, training rows, identifiers, prompts, tokens, or secrets.
- Call it “Audit trail” or “Demo audit events,” not “immutable blockchain ledger.”

## Interaction states

For every action, implement:
- Idle / ready
- Loading / in progress
- Success
- Empty state
- Recoverable error
- Invalid input / disabled action where appropriate

Prevent duplicate run-start clicks. Disable scoring until a compatible model is available. Never show a green success state before the backend confirms success.

## Visual guidance

- Professional, low-noise interface; off-white/light neutral surfaces with dark navy/charcoal text and one restrained accent colour.
- Cards and charts should support the task rather than crowd the page.
- Use consistent spacing and typography; readable body text.
- Chart legends include labels and units.
- Avoid red/green as the only distinction between risk or direction.
- Make risk label thresholds discoverable and clearly “demo-defined.”
- Keyboard-accessible controls, visible focus, descriptive labels, semantic headings, and responsive layout.

## Microcopy

**Privacy banner:** “Synthetic-data demonstration. No real lender systems or customer records are connected.”

**Federated learning:** “Each simulated lender trains on its own local training partition. The coordinator aggregates model updates; it does not combine the raw training rows.”

**Limitation:** “Federated learning alone does not guarantee privacy. DP/Secure Aggregation status shown here reflects the actual tested configuration.”

**Prediction disclaimer:** “This is a model estimate on synthetic data, not a real credit score or an approval/decline decision.”
