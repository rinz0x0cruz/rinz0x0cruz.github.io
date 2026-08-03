---
title: The benchmark said 85. Accuracy said zero.
summary: A mock Quorum run produced a handsome judge score and no correct answers. That contradiction became the evaluation design.
published: 2026-08-03
tags:
  - AI evaluation
  - Benchmarking
  - LLM
  - Reproducibility
---

## A beautiful score for a wrong answer

I ran Quorum's built-in mock provider against the reasoning pack. The judge liked what it saw. The gold-answer matcher did not.

```text
strategy    match   acc%   score   rounds   tokens
refine        0.0    0.0    85.0     2.00     1390
debate        0.0    0.0    85.0     2.00     2460
```

There it was: two respectable-looking 85s, zero correct answers, and debate spending roughly a thousand more tokens to be equally wrong.

This was not a model-quality experiment. The mock provider emits deterministic placeholder answers so the engine can test rounds, critique, judging, stopping, storage, rendering, and accounting without a model key. Its mock judge also returns predictable scores. The result was supposed to look internally consistent.

It exposed something better than a winner: two metrics making different claims in the same row. If I had charted only `score`, I could have congratulated the system for a failure.

> A judge score is an opinion with a number attached. Correctness needs its own receipt.

## Three proofs walk into a benchmark

I now read a Quorum result as three separate layers:

1. **Did the machinery work?** The mock provider and 145 offline self-checks exercise orchestration, replay, persistence, cost accounting, and failure paths. Mock scores prove plumbing, not answer quality.
2. **Was the answer objectively right?** Numeric, multiple-choice, Boolean, exact, contains, and regular-expression tasks use [deterministic matchers](https://github.com/rinz0x0cruz/quorum/blob/main/quorum/grade.py). When one applies, no grader model gets a vote.
3. **How did live systems compare?** Real strategies must run on the models, prompts, and task distribution that matter. Accuracy, judge score, rounds, tokens, cost, latency, and errors stay in separate columns.

Collapsing those layers into one “quality” number would be tidy. It would also hide exactly the disagreement that made this run useful.

## Give the task set a passport

A result is not reproducible because the command happens to be in shell history. The task set needs identity too.

Quorum ships [six versioned evaluation packs](https://github.com/rinz0x0cruz/quorum/tree/main/evals/packs) covering reasoning, extraction, security analysis, static coding, research synthesis, and writing. Each manifest records a license, source revision, source-file checksum, and fingerprints for train, validation, and promotion-test splits. Promotion-test is sealed rather than treated as tuning material.

```text
source revision + checksum -> split fingerprint -> benchmark result
```

`quorum packs verify` checks those fingerprints offline. I can tell whether two runs used the same bytes before arguing about the models.

That still does not make a small public pack representative. It can catch a regression. It cannot impersonate every production task, user, language, or failure mode. A fingerprint proves identity, not relevance.

## Judges have tells

Open-ended work eventually needs judgment. It also needs skepticism about the judge.

[Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) documents position, verbosity, self-enhancement, and reasoning biases. Quorum hides candidate identities and deterministically shuffles candidate order from a content hash. That reduces one known source of position bias while keeping replay stable.

It does not turn the judge into ground truth. A shuffled biased judge is still a biased judge; it is simply biased in a less convenient order. Judge scores belong beside deterministic matches, human review, cost, latency, and error rates—not above them on a throne.

The broader [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) puts evaluation inside the system lifecycle. That framing matters here: the evaluator is part of the system under test, not an oracle lowered from the ceiling.

## Stopping is not winning

Quorum's iterative strategies stop when a target is reached, progress plateaus, the round cap is hit, or the cost budget is exhausted. Those are valuable controls. Without them, “let the models debate” is less a strategy and more a subscription-cancellation problem.

But a stop reason is not a correctness proof. `reached target score 85` means the configured judge crossed a configured line. It does not mean the answer is safe, useful, or even right. My mock run made that distinction impossible to ignore.

[Should we be going MAD?](https://arxiv.org/abs/2311.17371) found that multi-agent debate did not reliably outperform cheaper prompting strategies and was sensitive to hyperparameters. There is no universal winning strategy here. Debate earns its extra calls only when it beats a cheaper baseline on the task distribution and constraints that actually matter.

Inspect the [Quorum repository](https://github.com/rinz0x0cruz/quorum) and its CI-backed offline review path. The portfolio claim is not that debate wins. It is that an attractive score can be challenged before anyone mistakes it for truth.