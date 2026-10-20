# 00 — Project Charter

## Working title

**FedCreditX: Privacy-Aware Collaborative Credit-Risk Modelling with Explainable Outputs**

## Purpose

Build a testable research prototype that makes the mechanics of collaborative credit-risk learning visible to a non-specialist: local lender training, aggregation of model updates, an estimated default probability, explanation of contributing features, and a recorded human review.

## Product definition

FedCreditX is a demo and learning artifact. It is not a real lending service, credit bureau, credit score provider, fraud detector, financial-data aggregator, or regulatory compliance product.

## Innovation question

Could a small workflow help a lending-risk analyst inspect the potential value and limitations of collaborative model training without pooling raw training records into a central dataset—and understand why the resulting model estimate was produced?

## Goals

1. Demonstrate actual Flower federated training across three simulated lenders.
2. Use a transparent, non-deep-learning model.
3. Compare aggregate model metrics with a centralized synthetic-data baseline where technically fair.
4. Provide a prediction-level explanation or well-labelled reason codes.
5. Record training and review events for traceability.
6. Evaluate the impact of adding differential privacy on model performance, if the privacy-enabled workflow is implemented correctly.
7. Deliver reproducible setup instructions, tests, limitations, and evidence tags.

## Non-goals

- Proving that collaborative training always improves model quality.
- Proving that no existing market product combines similar capabilities.
- Processing actual customer data or connecting actual lenders.
- Giving binding loan approvals or rejections.
- Providing certified privacy guarantees from a classroom demo.
- Building blockchain, fraud detection, chat, micro-frontends, or deep neural networks.

## Constraints

- Build window: roughly 4–5 focused days.
- Data: fully synthetic and reproducibly generated.
- Environment: local development machine, with separate simulated client processes/folders.
- Stack: Next.js + TypeScript + Tailwind, FastAPI, Flower, PyTorch logistic regression, Opacus, SHAP, SQLite.
- Optional feature: Flower SecAgg+ only when compatible, integrated, and tested.
- User prefers no deep learning.

## Key definitions

- **Federated learning (FL):** training happens on client-local data; model updates/parameters are aggregated to create a shared model. It is not a raw-data merge.
- **Differential privacy (DP):** a mathematically defined way to bound the influence of an individual record on an output, under specified assumptions and a correctly configured mechanism.
- **Secure aggregation:** a protocol intended to prevent the coordinator from seeing each participant's individual update in plaintext, while allowing an aggregate to be computed.
- **Explainability:** a description of model features contributing to a specific prediction. It does not prove causal reasons or guarantee that a decision is correct or fair.
- **Demo risk band:** a predefined presentation label mapped from the model's estimated default probability; not a real lender's credit-grade scale.

## Decision log

| Decision | Rationale | Revisit when |
|---|---|---|
| Use synthetic datasets | Avoid data access/privacy and licensing complications; keep run reproducible. | A later research phase obtains lawful, consented, appropriately governed data. |
| Use logistic regression in PyTorch | Simple baseline; compatible with no-deep-learning constraint and Opacus exploration. | A test demonstrates a need for another simple model. |
| No LLM in the core path | Explanations can be deterministic and auditable without external data transfer. | Core flow is stable and privacy review approves a strictly minimized prompt. |
| SecAgg+ is P2/stretch | It adds valuable privacy protection but has integration/configuration complexity. | The chosen Flower API pattern is confirmed compatible and a test can be added. |
| Human review, no automatic action | Credit decisions are consequential and the demo is not validated for real lending. | Not a goal of this prototype. |

## Definition of done

See `06_MVP_SCOPE.md` and `11_VALIDATION_AND_TEST_PLAN.md`. The central criterion is one working end-to-end path, not feature quantity.
