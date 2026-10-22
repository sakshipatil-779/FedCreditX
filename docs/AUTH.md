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
