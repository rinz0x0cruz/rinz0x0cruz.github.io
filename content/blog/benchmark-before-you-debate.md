---
title: Benchmark before you debate
summary: How Quorum separates offline orchestration checks, deterministic correctness, and model-based judging before comparing expensive deliberation strategies.
published: 2026-08-03
tags:
  - AI evaluation
  - Benchmarking
  - LLM
  - Reproducibility
---

## The decision

When is a multi-model debate worth more calls than a single-model refinement or ensemble?

The answer cannot be “whenever the judge score rises.” [Should we be going MAD?](https://arxiv.org/abs/2311.17371) found that multi-agent debate did not reliably outperform cheaper prompting strategies and was sensitive to hyperparameter choices. Quorum therefore treats strategy choice as an evaluation problem, not a feature hierarchy.

## Separate three kinds of proof

Quorum keeps three claims distinct:

```text
offline mechanics -> objective correctness -> live-model comparison
```

1. **Offline mechanics:** the built-in mock provider exercises rounds, critique, judging, stopping, persistence, rendering, token accounting, and failure paths. Its 145 self-checks prove that the workflow behaves deterministically; mock scores do not prove answer quality.
2. **Objective correctness:** numeric, multiple-choice, Boolean, exact, contains, and regular-expression tasks use [deterministic matchers](https://github.com/rinz0x0cruz/quorum/blob/main/quorum/grade.py). No grader model is called when one of those checks applies.
3. **Live-model comparison:** strategies must run on the models, prompts, and task distribution that matter to the user. Score, accuracy, rounds, tokens, cost, latency, and errors remain separate outputs rather than one invented quality number.

## Make the task set inspectable

The public repository ships [six versioned evaluation packs](https://github.com/rinz0x0cruz/quorum/tree/main/evals/packs) covering reasoning, extraction, security analysis, static coding, research synthesis, and writing. Each pack records its license, source revision, source-file checksum, and fingerprints for train, validation, and promotion-test splits. Promotion-test is marked as a sealed split rather than training material.

```text
source revision + checksum -> split fingerprint -> benchmark result
```

`quorum packs verify` checks those fingerprints offline. That makes an evaluation repeatable, but not automatically representative: a small public pack can catch regressions without predicting every production task.

## Use model judges as evidence, not truth

Open-ended answers still need judgment. [Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) documents position, verbosity, self-enhancement, and reasoning biases. Quorum deterministically shuffles candidate order from a content hash before judging, which reduces one known source of position bias while preserving replay.

That mitigation does not turn an LLM judge into ground truth. Judge scores remain model-dependent evidence and should be read alongside deterministic matches, cost, latency, error rates, and human review. This follows the broader [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) principle that trustworthiness belongs in the design, use, and evaluation of an AI system.

## Stop rules are cost controls

Debate, council, and refine strategies stop when a target is reached, progress plateaus, the round cap is hit, or the cost budget is exhausted. Those controls prevent an open-ended loop. They do not prove that the target score means “good enough” for every domain.

There is no universal winning strategy in this artifact. The mock provider validates mechanics, not answer quality; deterministic gold matches cover only tasks with checkable outputs; model judges retain bias; and a benchmark result is scoped to its models, configuration, task pack, and run conditions.

Inspect the [Quorum repository](https://github.com/rinz0x0cruz/quorum) and its CI-backed offline review path. The portfolio claim is not that debate wins. It is that the strategy can be measured against cheaper alternatives without hiding the evaluator, data lineage, cost, or limits.