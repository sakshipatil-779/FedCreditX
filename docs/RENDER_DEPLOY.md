# Render Deployment & Architecture Guide for FedCreditX

## Architecture on Render

FedCreditX is deployed on Render as two connected services defined in `render.yaml`:
1. **`fedcreditx-api`**: FastAPI Python backend running Uvicorn (`runtime: python`).
2. **`fedcreditx` (or `fedcreditx-ui`)**: Next.js React frontend running as a **Next.js Node service** (`runtime: node`, `next start`).

> [!NOTE]
> **Next.js Node Service Architecture vs Static Export:**
> The frontend is **NOT a static export**. It runs as a dynamic Node.js service using `next start`.
> Same-origin API routing is achieved via Next.js `rewrites()` in `frontend/next.config.js`:
> ```javascript
> async rewrites() {
>   const isProd = process.env.NODE_ENV === "production";
>   const backendUrl = process.env.BACKEND_URL || (isProd ? "" : "http://127.0.0.1:8000");
>   return [
>     {
>       source: "/api/:path*",
>       destination: `${backendUrl}/api/:path*`,
>     },
>   ];
> }
> ```
> In production, `frontend/next.config.js` validates that `BACKEND_URL` is set; if missing, the build fails immediately with an actionable error directing the developer to configure `BACKEND_URL` in the Render dashboard.
> 
> **Alternative Static Site Rewrite Rule (if ever deployed as static export):**
> If the frontend were ever switched from dynamic Next.js Node to a Render Static Site:
> - **Source**: `/api/*`
> - **Destination**: `https://fedcreditx-api.onrender.com/api/*`
> - **Action**: `Rewrite` (NOT `Redirect`)
>
> **Cookie and Header Forwarding:**
> Because all browser requests target relative same-origin paths (`/api/*`), Next.js rewrites forward incoming `Cookie` headers to the FastAPI backend and pass `Set-Cookie` headers back to the browser. Furthermore, `frontend/src/lib/api.ts` attaches `credentials: 'same-origin'` and forwards local session tokens in `Authorization: Bearer <token>` and `X-Session-Token` headers. This guarantees robust authentication even in cross-subdomain or proxied environments.

---

## Deploy Traceability & Commit Verification

Every deployment can be verified through the public health endpoint:
```bash
curl.exe -i https://fedcreditx-api.onrender.com/api/health
```

The response includes:
- `ok`: boolean status indicator (`true`)
- `service`: service identifier (`fedcreditx-api`)
- `version`: backend application version (`0.2.0`)
- `git_commit`: git commit SHA injected automatically by Render (`RENDER_GIT_COMMIT`), or `"unknown"` in local development
- `fl_routes_loaded`: list of registered Federated Learning endpoint paths:
  - `/api/fl/config`
  - `/api/fl/rounds`
  - `/api/fl/sample-partner`
  - `/api/fl/update`
  - `/api/fl/model`
  - `/api/fl/preprocessor`

### Post-Push Verification Step
After every `git push origin main`:
1. Check the local commit hash:
   ```bash
   git rev-parse HEAD
   ```
2. Call `/api/health` and verify `git_commit`:
   ```bash
   curl.exe -s https://fedcreditx-api.onrender.com/api/health | jq .git_commit
   ```
3. Once the Render deploy finishes, `git_commit` will match the latest GitHub commit SHA, guaranteeing that the running build includes the latest code.

---

## Environment Variables Configuration

Configure these environment variables on the Render Dashboard:

### 1. `fedcreditx-api` (FastAPI Backend)
| Variable | Default / Recommended | Description |
| :--- | :--- | :--- |
| `ALLOWED_ORIGINS` | `https://fedcreditx.onrender.com,http://localhost:3000` | Comma-separated list of permitted CORS origins (strict, no wildcard with credentials) |
| `MAX_UPDATE_NORM` | `15.0` | Maximum allowable L2 norm bound for client parameter updates `\\|w - w_{global}\\|_2` |
| `FL_MIN_CLIENTS` | `3` | Minimum updates required in an open round before triggering weighted FedAvg aggregation |
| `DEMO_AUDITOR_ENABLED` | `true` | Allows evaluator demo-auditor login via email/password |
| `DEMO_AUDITOR_EMAIL` | `fedcreditx@hackfront.com` | Demo auditor authorized email |
| `DEMO_AUDITOR_PASSWORD_HASH` | *(Salted bcrypt hash)* | Hashed password for demo auditor |
| `AUDITOR_EMAILS` | `auditor@fedcreditx.org,fedcreditx@hackfront.com` | Google sign-in auditor email allowlist |

### 2. `fedcreditx` (Next.js Frontend)
| Variable | Value | Description |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://fedcreditx-api.onrender.com` | Backend URL used by Next.js `rewrites()` proxy |
| `NODE_VERSION` | `20.20.2` | Node.js engine version |
| `PORT` | `3000` | Port assigned by Render |

---

## Session Cookie Configuration

The session cookie (`session_token`) is set on successful authentication with the following attributes:
- `HttpOnly`: Prevents client-side script access (mitigating XSS extraction)
- `Secure`: Transmitted only over HTTPS connections
- `SameSite=Lax`: Defends against CSRF while allowing top-level cross-site navigations
- `Path=/`: Valid across all application routes

Because browser requests target the same-origin relative path (`/api/*`), Next.js proxies forward the `Cookie` header upstream to FastAPI and pass `Set-Cookie` headers back to the browser.
