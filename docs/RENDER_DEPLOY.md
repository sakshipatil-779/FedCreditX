# Render Deployment & Architecture Guide for FedCreditX

## Architecture on Render

FedCreditX is deployed on Render as two connected web services defined in `render.yaml`:
1. **`fedcreditx-api`**: FastAPI Python backend running Uvicorn.
2. **`fedcreditx-ui`**: Next.js React frontend deployed on Node 20.

---

## Free-Tier Memory Advisory (Important)

> [!WARNING]
> **Render Free Tier RAM Limitation (512 MB):**
> Render's free tier provides approximately **512 MB of RAM**.
> In full multi-process gRPC mode (`--mode grpc`), Flower launches **1 coordinator server process** plus **3 independent client processes** (one for each simulated lender), along with PyTorch and Opacus runtime overhead.
>
> Spawning four simultaneous Python processes with PyTorch and gRPC channels may exceed the 512 MB RAM limit, triggering an Out-Of-Memory (`out_of_memory`) process kill or 502 gateway error.

### Recommendations:
1. **Production / Demonstrations:**
   - Run the multi-process gRPC orchestration (`run_genuine_flower_grpc`) on a machine with **at least 2 GB RAM**, or upgrade the Render web service instance to **Starter (1 GB) or Standard (2 GB)**.
2. **Resource-Constrained Environments (512 MB):**
   - Use the browser-side edge training workflow (**"Train on my data"**), where local SGD and gradient updates execute entirely in the user's browser, transmitting only compressed weight vectors to the backend.
   - For server-side demonstrations on 512 MB instances, reduce concurrent clients (`--min-clients 1` or `--min-clients 2`), or use the in-memory federated simulation mode (`run_federated_simulation`).

---

## Environment Variables Configuration

Set these environment variables on the Render Dashboard:

### 1. `fedcreditx-api` (Backend)
| Variable | Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port assigned by Render |
| `AUDITOR_EMAILS` | `your.email@gmail.com,auditor@fedcreditx.com,compliance@fedcreditx.com` | Comma-separated allowlist of Google accounts authorized for Auditor role |
| `OFFICER_EMAILS` | *(Optional)* | Comma-separated allowlist of Google accounts authorized for Officer role (default: all authenticated Google users) |

### 2. `fedcreditx-ui` (Frontend)
| Variable | Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port assigned by Render |
| `NODE_VERSION` | `20.20.2` | Node.js runtime version |
| `NEXT_PUBLIC_API_URL` | `https://fedcreditx-api.onrender.com` | Live backend URL pointing to `fedcreditx-api` |

---

## Manual Sync & Deployment Steps

1. Push latest commits to the `main` branch:
   ```bash
   git push origin main
   ```
2. In the Render Dashboard:
   - Navigate to **`fedcreditx-api`** → click **Manual Deploy** → **Deploy latest commit**.
   - Navigate to **`fedcreditx-ui`** → click **Manual Deploy** → **Clear build cache & deploy**.
3. Verify backend health at `https://fedcreditx-api.onrender.com/api/overview` or `/health`.
