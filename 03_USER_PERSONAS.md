# 03 — User Personas

> These personas are **hypotheses**, not researched facts. Do not invent names, interview quotations, demographics, or validated needs. Replace these with evidence after interviews.

## Primary persona — Lending-risk analyst / underwriter

**Role:** Reviews model outputs and application cases for a lending organisation.

**Situation:** Wants to understand how a model arrived at a risk estimate and what information drove it, without treating a score as an unexplained instruction.

**Likely jobs to be done:**
- Inspect the estimated default probability for a synthetic case.
- See which model features pushed the estimate higher or lower.
- Compare current model version and evaluation metrics.
- Record a manual review outcome and later understand what the demo showed.

**Potential pain (hypothesis):** risk scores without transparent supporting factors can be hard to inspect or discuss with stakeholders.

**What success looks like in the prototype:** can correctly describe the score as a model estimate, identify two top contributing features, and record a review outcome without assistance.

**What we must not assume:** that a real underwriter currently lacks explanation tools, wants federated learning, or would make decisions from our demo.

## Secondary persona — FinTech ML / engineering lead

**Role:** Evaluates data/model architecture and experimentation feasibility.

**Likely jobs to be done:**
- Check that raw training partitions stay with simulated clients.
- Verify that training is genuinely federated, not a central model disguised by UI.
- Compare centralized baseline metrics with FL metrics.
- Understand DP and secure-aggregation configuration, limitations, and performance trade-offs.

**Success:** can inspect a training run and reproduce the reported metrics from the repo.

**Potential pain (hypothesis):** privacy-aware collaboration can be hard to demonstrate to nontechnical stakeholders in a coherent user-facing flow.

## Secondary persona — Federation administrator

**Role:** Monitors the simulated federation and experiment state.

**Likely jobs to be done:**
- See which clients joined each run and how many rounds completed.
- See errors, incomplete clients, and aggregated metrics.
- Review privacy configuration and the current global model version.

**Success:** can identify whether a run completed, partially failed, or was configured with DP/SecAgg+.

## Who is not a persona for this MVP

- A live loan applicant whose real credit eligibility is determined by this app.
- A real bank/NBFC onboarding an institution.
- A customer requesting a real credit bureau score.
- A fraud victim or fraud operations analyst.
- A regulator seeking a compliance-certified deployment.

## Interview / stranger-test prompts

1. “Tell me about the last time you had to understand or explain a credit-risk model result. What did you actually inspect?”
2. “How are model training datasets currently governed and separated across organisations in your work?”
3. “Which current tools or workaround would you use instead of this workflow?”
4. “What evidence would you need before trusting a federated model's score or explanation?”
5. “Using this demo, explain in your own words what stays local, what is aggregated, and what the output does not prove.”

Record answers as notes with consent; do not claim that synthetic personas validate product-market fit.
