# 10 — Security, Privacy, and Trust

## Security posture

FedCreditX is a local synthetic-data demo. It demonstrates architectural patterns; it does not certify privacy, secure multi-party deployment, legal compliance, or suitability for actual credit decisions.

## Threats considered

- Accidental central storage of local lender training records.
- Sensitive values leaking through logs, exception messages, or audit metadata.
- Model updates leaking information despite raw data remaining local.
- Misleading claims that federated learning equals privacy.
- Incorrectly configured DP resulting in a false privacy claim.
- Broken or mocked secure aggregation being presented as real.
- Explanation text claiming causality/fairness when only feature attribution was computed.
- Out-of-date/stale model artifacts being used for inference.
- Invalid/malformed inputs causing a crash or unsafe output.
- Externally supplied secrets accidentally committed to Git.

## Required controls

### Data minimization
- Generate synthetic records only.
- No real personal identifiers, records, or uploads.
- Keep local training partitions in client-local folders/processes.
- Central API/database stores run metadata, aggregate metrics, synthetic case IDs, model version, score results, reason codes, and review events—not raw training data.
- Do not put row values, full tensors, tokens, environment variables, or raw prompts in logs.

### Federated-learning limitations
- Explain that local data retention does not alone ensure confidentiality: updates can reveal information in some threat models.
- Never equate “model update sent” with “no information can leak.”
- Use secure aggregation only when the real protocol is integrated and tested.
- The demo's one-machine client setup is not equivalent to independently administered organisations.

### Differential privacy
- DP settings must correspond to actual Opacus training code.
- Record the implemented configuration and accountant output (where valid).
- Explain the utility/privacy trade-off; added noise can degrade results, and a DP mode may not converge on a small synthetic dataset.
- If correct accounting cannot be established, label the implementation experimental/unverified and do not claim a formal guarantee.

### Secure aggregation
- Treat separately from DP.
- Confirm the current Flower API supports the chosen client/server workflow.
- Add tests or a reproducible log demonstrating the protocol actually executes.
- If unavailable, show “not enabled” rather than a fake success status.

### API/frontend hygiene
- Restrict CORS to the development frontend origin.
- Validate schemas and reject unknown/oversized payloads where practical.
- Do not return traceback or server file paths to the UI.
- Avoid file upload endpoints for raw data.
- Use local-only development defaults unless the team explicitly reviews hosting/network implications.

### Secrets and repository
- Commit `.env.example`, never `.env`.
- Ignore API keys, credentials, generated datasets, model artifacts, DB files, logs, cache/build artifacts, `node_modules`, Python virtual environments.
- No Gemini API key is required for the MVP.

## Explanation and decision trust

- Every prediction is labelled as a **model estimate on synthetic data**.
- Use “feature contribution” or “reason code,” not “the real reason” or “causes the applicant to default.”
- The demo risk band is a presentation-only mapping documented in code/UI; it is not a validated lender policy.
- A human review action is mandatory; the app does not perform real approvals or declines.
- Do not use sensitive/protected attributes as model features.
- Do not claim a score is fair, unbiased, calibrated, compliant, or suitable for underwriting without separate evaluation.
- Keep the explanation method and current model version attached to each result.

## Audit trail

Record event type, timestamp, run/case reference, model version, status, and safe metadata. Make sure the audit payload contains no raw features or training rows. Do not describe SQLite storage as immutable or tamper-proof. A cryptographic hash can help detect accidental change if deliberately implemented and tested, but does not by itself make a system production-secure.

## Privacy statement for the UI

> “This local prototype uses synthetic records and simulated lender clients. Training partitions stay in their client data paths during the demo. Federated learning alone does not guarantee privacy. DP and Secure Aggregation are shown as enabled only when the corresponding implementation and tests pass. This is not a production lending system.”

## Incident / failure handling

If data leakage into the central DB or logs is found: stop the demo, delete generated contaminated artifacts, fix the code, add a regression test, and update `BUILD_LOG.md`. If privacy code is not verifiable, turn the corresponding status off and document the limitation.
