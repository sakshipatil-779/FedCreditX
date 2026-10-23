# FedCreditX Authentication & Role-Based Access Control (RBAC) Architecture

## Overview

FedCreditX implements a defense-in-depth, 5-checkpoint authentication and role-governance architecture. The platform enforces strict operational segregation between **Bank Underwriting Officers** and **Compliance Risk Auditors**.

---

## 1. Google Sign-In & Role Selection Flow

1. **Google Identity Authentication:**
   The user signs in using their Google account via the Firebase Authentication SDK or one-click institutional Google profiles.
2. **Interactive Role Selection Modal:**
   After every successful sign-in, the application presents a modal titled **"Select your role"** with two explicit options:
   - **Bank Underwriting Officer:** *"Review applicants and record decisions."*
   - **Auditor:** *"Read-only access to audit trail and model governance."*
   The "Continue" button remains disabled until an option is selected.
   *Note:* The modal appears on every sign-in and never persists a default role silently. Dismissing or canceling the modal signs the user out completely.
3. **Server-Side Token Exchange & RBAC Verification:**
   The client transmits the Google ID token and the requested role to `POST /api/auth/select-role`.

---

## 2. The Five Server-Side Checkpoints

The backend strictly enforces five checkpoints in sequence:

| Checkpoint | Mechanism | Description |
|---|---|---|
| **1. Token Verification** | `verify_id_token(id_token)` | Validates the integrity, claims, and verified email of the Google/Firebase ID token. Never trusts client-supplied emails or claims. |
| **2. Role Allowlist Matching** | `is_email_approved_for_role(email, role)` | Checks the authenticated email against role allowlists (`AUDITOR_EMAILS` and `OFFICER_EMAILS`). |
| **3. Rejection of Unapproved Roles** | HTTP 403 Forbidden | If an account requests the Auditor role without allowlist approval, the server returns HTTP 403 with: `"Your account is not approved as Auditor. Contact the administrator."` No session token is issued. |
| **4. Server-Side Role Storage** | `server_sessions` Table in SQLite | Granted roles are stored server-side against an opaque session token (`sess_...`). All downstream protected endpoints (`/api/audit`, `/api/audit/export`, `/api/metrics`) verify the session token directly from the database, ignoring client headers. |
| **5. Audit Logging** | `audit_events` Table in SQLite | Every sign-in and role selection attempt is logged with actor email, requested role, timestamp, and status (`AUTH_ROLE_GRANTED` or `AUTH_ROLE_DENIED`). Secrets and tokens are never logged. |

---

## 3. Allowlist Configuration Rules

### Bank Underwriting Officer
- **Default Policy:** Any authenticated Google user is permitted to act as a Bank Underwriting Officer by default.
- **Optional Restriction:** Set the `OFFICER_EMAILS` environment variable as a comma-separated list of approved Google emails.

### Compliance Risk Auditor
- **Strict Allowlist:** Access to the Auditor role requires the account email to match the allowlist.
- **Environment Variable:** `AUDITOR_EMAILS` (comma-separated list).
- **Default Seed Accounts:**
  - `vikram.malhotra@risk-auditor.google.com`
  - `auditor@fedcreditx.com`
  - `auditor@fedcreditx.org`
  - `compliance@fedcreditx.com`
  - `admin@fedcreditx.com`

---

## 4. How to Add an Approved Auditor Account on Render

To authorize a new Google account for the Auditor role in production on Render:

1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Select the **`fedcreditx-api`** Web Service.
3. In the left navigation, click **Environment**.
4. Locate or create the environment variable:
   ```env
   AUDITOR_EMAILS=auditor@fedcreditx.com,your-google-email@gmail.com,auditor@partnerbank.org
   ```
5. Click **Save Changes**. Render will automatically redeploy the service with the updated allowlist.
6. The user can now sign in with Google, select **Auditor**, and access the audit trail and holdout benchmark.

---

## 5. Controlled Demo Auditor Login (Evaluator Access)

For external evaluators who need direct access to compliance audit trails and holdout benchmark metrics without signing in through personal Google accounts, FedCreditX provides an isolated, rate-limited **Demo Auditor** authentication mechanism.

### Key Security Guardrails
1. **Disabled by Default:** The demo login endpoint (`POST /api/auth/demo-login`) returns HTTP 404 and the UI entry point remains hidden unless `DEMO_AUDITOR_ENABLED=true`.
2. **Zero Plaintext Credentials:** Plain passwords and hashes are never stored in source code, commit history, logs, or test fixtures. Credentials are read entirely from environment variables at runtime.
3. **Bcrypt Constant-Time Verification:** Passwords are verified against a salted bcrypt hash using constant-time comparison (`bcrypt.checkpw`).
4. **Strict Role Isolation:** Demo sessions are assigned strictly to the `auditor` role. Officer-only endpoints (such as `POST /api/fl/update`) return HTTP 403 Forbidden.
5. **Time-Bound Access Window:** Logins are rejected with HTTP 403 (`"Demo access has ended."`) if the current UTC time exceeds `DEMO_AUDITOR_EXPIRES_AT`.
6. **Brute-Force Rate Limiting:** Restricted to 5 login attempts per IP per 15-minute rolling window; the 6th attempt receives HTTP 429.
7. **Comprehensive Audit Logging:** Every attempt records an audit event (`timestamp`, `email`, `result`, `ip_address`) in the SQLite audit trail. Passwords and hashes are strictly excluded from logs.

---

### Step-by-Step Evaluator Setup on Render

#### Step 1: Generate the Bcrypt Password Hash Locally
Run the zero-disk-write generator script in your terminal:
```bash
python scripts/hash_demo_password.py
```
When prompted:
```text
Enter demo auditor password: <your-chosen-evaluator-password>
Confirm demo auditor password: <your-chosen-evaluator-password>
```
The script will output **only** the bcrypt hash to stdout:
```text
$2b$12$e8YkYk4Ue1n...
```
*(Copy this hash for the Render dashboard).*

#### Step 2: Configure Environment Variables on Render
1. Open the [Render Dashboard](https://dashboard.render.com).
2. Select the **`fedcreditx-api`** Web Service.
3. Navigate to **Environment** in the left sidebar.
4. Add the following environment variables:
   | Key | Example Value | Description |
   |---|---|---|
   | `DEMO_AUDITOR_ENABLED` | `true` | Enables the demo login endpoint and UI toggle |
   | `DEMO_AUDITOR_EMAIL` | `evaluator@fedcreditx.demo` | Case-insensitive demo auditor email |
   | `DEMO_AUDITOR_PASSWORD_HASH` | `$2b$12$...` | Bcrypt hash generated in Step 1 |
   | `DEMO_AUDITOR_EXPIRES_AT` | `2026-11-01T00:00:00Z` | UTC ISO expiration timestamp |
5. Click **Save Changes**. Render will automatically trigger a rolling deployment.

#### Step 3: Accessing Auditor Pages as Evaluator
1. Open the FedCreditX application URL: `https://fedcreditx.onrender.com/`.
2. Below the "Sign In with Google" button, click **"Demo auditor login"**.
3. Enter the configured email and password.
4. You will be routed directly to the **Audit Trail & Holdout Benchmark** landing views.
5. A persistent amber banner will confirm: `"Demo auditor session. Read-only access."`

#### Step 4: Disabling Demo Access After Evaluation
To immediately revoke evaluator access:
1. In the **`fedcreditx-api`** Web Service on Render, set:
   ```env
   DEMO_AUDITOR_ENABLED=false
   ```
2. Click **Save Changes** and redeploy. The endpoint will return HTTP 404 and the UI button will be completely removed.
