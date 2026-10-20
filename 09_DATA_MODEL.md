# 09 — Data Model and Synthetic Schema

## Data policy

All generated records are synthetic. Do not include or solicit real names, PAN, Aadhaar, bank account numbers, phone numbers, addresses, real statements, or any real customer-identifying fields.

## Synthetic model features

Use a compact shared schema with meaningful but synthetic relationships. The exact set can be refined, but every client must have the same feature order and preprocessing.

| Feature | Type | Definition (synthetic only) | Model input? |
|---|---|---|---|
| `monthly_income_band_value` | Float | Synthetic numeric proxy for monthly income range. | Yes |
| `debt_to_income_ratio` | Float | Synthetic ratio of existing monthly debt payments to monthly income, bounded/documented. | Yes |
| `late_payment_count_12m` | Integer | Number of synthetic late payments over the previous 12 months. | Yes |
| `credit_utilization_ratio` | Float | Synthetic fraction of available revolving credit used. | Yes |
| `income_variability` | Float | Synthetic normalized variation in income. | Yes |
| `loan_amount_to_income` | Float | Requested synthetic loan amount relative to annual/monthly income, using a documented denominator. | Yes |
| `account_history_months` | Integer | Synthetic length of financial history. | Yes, only if consistently available |
| `utility_payment_consistency` | Float | Synthetic consistency score derived from simulated payment history. | Yes, optional |
| `defaulted` | Integer 0/1 | Synthetic training target: whether a simulated previous loan defaulted within the generated outcome window. | Target, not input |

Do not add age, gender, ethnicity, religion, caste, disability, or other sensitive/protected characteristics to the predictive feature set. Any fairness audit extension must be carefully designed and is not required for MVP.

## Data split strategy

- Generate a deterministic parent synthetic dataset with a fixed seed.
- Create lender-specific partitions (A/B/C) with either IID-like distribution for the first working run, then optionally a documented non-IID variant to stress-test federation.
- Keep a synthetic holdout test set separate from training. It may be centrally available for demo evaluation only; clearly label this as a synthetic benchmark, not a real deployment architecture.
- Store training partitions under separate local folders/client data paths; do not persist them in the central application database.
- Include a data card explaining generator assumptions and known synthetic bias.

## Database entities

### `training_runs`
- `id` (UUID/text primary key)
- `status` (`queued`, `running`, `completed`, `failed`)
- `created_at`, `started_at`, `completed_at`
- `requested_rounds`, `completed_rounds`
- `participating_client_count`
- `model_type`, `model_version`
- `privacy_mode` and safe configuration summary
- `baseline_metrics_json`, `federated_metrics_json`
- `error_code` and sanitized `error_summary` (nullable)
- `duration_seconds` (nullable)

### `model_artifacts`
- `id` / `version` (primary key)
- `training_run_id` (foreign key)
- `artifact_path` or managed artifact identifier
- `feature_schema_version`
- `created_at`
- `artifact_hash` (integrity check for the demo file)
- Do not store raw datasets here.

### `demo_cases`
- `case_id` (synthetic ID only, e.g. `DEMO-A-001`)
- `lender_id`
- `local_case_ref` or sample filename/reference
- `data_version`
- Do not store the raw feature vector in central SQLite if the intended flow is lender-local inference.

### `scoring_results`
- `id`
- `case_id`
- `lender_id`
- `training_run_id` / `model_version`
- `default_probability_estimate`
- `demo_risk_band`
- `explanation_method` (`SHAP` or `reason_codes`)
- `explanation_json` containing feature names, contribution direction, and values
- `created_at`
- Do not label the probability as a bureau score or calibrated real-world risk unless calibrated and validated.

### `review_records`
- `id`
- `scoring_result_id`
- `review_status` (`reviewed`, `need_more_information`, `escalate_human_review`)
- `reviewer_label` (demo role label only)
- `note_code` (predefined non-sensitive code; no free-form sensitive text in MVP)
- `created_at`

### `audit_events`
- `id`
- `timestamp`
- `event_type`
- `actor_type` (e.g. `demo_user`, `system`, `client_simulation`)
- `entity_type`, `entity_id`
- `status`
- `model_version` (nullable)
- `safe_metadata_json`

SQLite audit events are useful for demo traceability but are not an immutable production ledger.

## API and persistence rules

- Use typed Pydantic models for API input/output.
- Use enums for status and risk-band values.
- Validate and bound numeric features, reject NaN/Infinity, and normalize only with a stored preprocessing configuration.
- Never persist raw training rows or raw per-applicant feature vectors to central SQLite.
- Keep synthetic applicant features in the lender's local demo data partition and score through that client path.
- Record the exact model artifact version with every score.
