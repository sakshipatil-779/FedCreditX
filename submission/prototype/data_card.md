# Synthetic Credit Risk Dataset Card — FedCreditX

## 1. Dataset Overview

- **Name:** FedCreditX Synthetic Multi-Lender Credit Benchmark
- **Domain:** Retail & Consumer Credit Default Modeling (Illustrative Prototype)
- **Generator Script:** `backend/data/generate_synthetic.py`
- **Default Seed:** `42` (PCG64 PRNG)
- **Partitions:**
  - `lender_a/train.csv`: 1,200 records (Prime lending profile: higher income, conservative DTI, seasoned accounts)
  - `lender_b/train.csv`: 1,200 records (Near-prime profile: moderate income, higher credit utilization)
  - `lender_c/train.csv`: 1,200 records (FinTech / Thin-file profile: variable gig income, shorter credit tenure)
  - `holdout_test/test.csv`: 900 records (Balanced representative cross-lender holdout)
  - Demo interactive cases: 10 preloaded synthetic cases per lender (`demo_cases.json`) with deterministic IDs (`DEMO-A-001`, `DEMO-B-001`, `DEMO-C-001`)

## 2. Feature Schema & Types

| Feature Name | Storage Type | Description | Valid Range | Model Input |
|---|---|---|---|---|
| `monthly_income_band_value` | Float64 | Synthetic gross monthly income proxy ($) | [1,000.0, 50,000.0] | Yes |
| `debt_to_income_ratio` | Float64 | Ratio of debt obligations to monthly income | [0.01, 1.50] | Yes |
| `late_payment_count_12m` | Int64 | Number of delinquent payment cycles in past year | [0, 12] | Yes |
| `credit_utilization_ratio` | Float64 | Proportion of revolving credit lines drawn | [0.00, 1.50] | Yes |
| `income_variability` | Float64 | Monthly income coefficient of variation | [0.00, 1.00] | Yes |
| `loan_amount_to_income` | Float64 | Requested loan principal over annual income | [0.10, 15.00] | Yes |
| `account_history_months` | Int64 | Age of oldest active financial trade line | [1, 360] | Yes |
| `utility_payment_consistency` | Float64 | Synthetic index of non-credit bill timeliness | [0.00, 1.00] | Yes |
| `defaulted` | Int64 (0/1) | Target indicator: 1 = default in 24-mo window | {0, 1} | Target |

## 3. Privacy & Governance Guarantees

- **No Real Customer Data:** All values are synthetically sampled using statistical distributions (Log-normal, Beta, Gamma, Poisson-like choice).
- **No Protected Attributes:** Demographics, gender, race, religion, geographic location, age, marital status, and national identity numbers (e.g. SSN, PAN, Aadhaar) are **strictly excluded**.
- **Data Minimization:** Raw partition files reside only within `backend/local_data/lender_*` folders. The central database and API store only aggregate metrics, run metadata, case identifiers, and audit events.
- **Strictly Non-Production:** Synthetic risk probabilities and risk bands are demo artifacts and do not reflect real-world credit bureau scores or underwriting criteria.
