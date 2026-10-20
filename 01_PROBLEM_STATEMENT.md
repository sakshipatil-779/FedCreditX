# 01 — Problem Statement

## Primary problem statement

**Lending-risk teams at separate financial institutions may have different local datasets that contain useful historical repayment patterns, but pooling raw customer-level records into one central dataset can raise privacy, governance, trust, and competitive concerns. This limits the practicality of experimenting with collaborative model learning across those datasets. At the same time, a model-estimated default risk can be difficult for a human reviewer to interpret if the workflow provides only a number or risk label. We will prototype and evaluate a workflow in which three simulated lenders train a shared simple credit-risk model through federated learning, retain local training partitions in their client environments, and produce a prediction with understandable feature contributions for human review.**

## One-sentence version

Can simulated lenders train a shared credit-risk model without centralising their raw training records, while providing a clear explanation of each model estimate?

## Scope of the problem

- **Domain:** collaborative credit-risk modelling.
- **Primary user:** lending-risk analyst/underwriter evaluating model outputs.
- **Technical co-user:** ML/engineering lead evaluating federated training and privacy controls.
- **Trigger:** a team wants to experiment with learning from multiple distributed datasets without building one central raw-data repository.
- **Current alternative to investigate:** separate local models, a centrally pooled training dataset, or manual feature/risk review. These alternatives are plausible, not validated user research.
- **Desired outcome:** demonstrate a repeatable local-training/aggregation/scoring/explanation workflow and measure its trade-offs.

## Problem mechanism

1. Different simulated lenders hold different partitions of historical synthetic records.
2. A common feature schema and target definition are required for collaborative training.
3. Each client trains locally; the server coordinates rounds and aggregates permitted model updates.
4. The updated global model can be used for inference at a selected simulated lender.
5. A feature-attribution method or documented reason-code fallback explains the model's prediction.
6. A human records a review outcome; the prototype does not make a binding real credit decision.

## What we are **not** claiming

- That all actual lenders face the same problem or are unable to collaborate.
- That federated learning guarantees privacy.
- That the federated model is more accurate than a centralized model.
- That the output is a real credit score or that a high/low band should drive an actual loan decision.
- That the three papers establish a complete absence of market products.
- That feature attribution is a causal explanation, proof of fairness, or a regulatory-compliance guarantee.

## Why this can be investigated in a hackathon

A small prototype can generate synthetic records, divide them among three simulated clients, train a centralized baseline and a Flower federated model, compare held-out metrics, inspect model explanations, and demonstrate what changes when a tested privacy mechanism is enabled. The experiment can produce observable results in a few days and has clear failure criteria.

## Validation question

Does the proposed workflow make the trade-off among local data retention, model performance, implementation complexity, and understandable output clear enough to be useful to a lending-risk or ML practitioner?

## Falsification conditions

Reframe or reduce the project if any of these happen:

1. The Flower path cannot complete real local training and aggregation reproducibly.
2. Federated performance is materially worse or unstable on the chosen synthetic partitions, and the project cannot explain why.
3. The UI's explanations are misleading or do not faithfully reflect model outputs.
4. The only working demo is a mock animation rather than real training and inference.
5. Practitioner feedback suggests the problem is not a priority or existing tools fully cover the specific workflow under study.
