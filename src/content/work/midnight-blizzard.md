---
kind: case-study
sourceId: midnight-blizzard
published: 2026-07-16
snapshotDate: 2026-07-16
heroImage: ../../assets/work/midnight-blizzard/timeline.svg
heroAlt: Redacted intrusion timeline connecting identity access, endpoint execution, exfiltration, and containment
confidentialityNote: Client-identifying details, raw telemetry, account names, infrastructure, and exact timestamps are intentionally omitted.
evidence:
  - label: Unified timeline
    detail: Identity and endpoint events were normalized into one operator sequence with confirmed behavior separated from hypotheses.
  - label: Cross-system pivots
    detail: Credential use, process ancestry, network activity, and identity changes connected the on-premises and Entra evidence.
  - label: Operational handoff
    detail: The reconstructed chain produced containment-ready indicators and a defensible narrative for the active response team.
draft: false
---

## The decision

The investigation needed to answer one operational question: which observed
actions belonged to the same intrusion, and what should containment interrupt
next? A single timeline connected the identity pivot, endpoint execution,
command-and-control activity, ransomware staging, and hands-on exfiltration.

## The evidence path

Events from identity and endpoint systems were normalized before correlation.
The analysis then pivoted through credential use, process ancestry, network
activity, and account changes. Every link in the narrative was marked as
confirmed behavior or a bounded hypothesis.

## The constraint

Evidence was fragmented across systems while containment was already active.
The result had to remain useful without overclaiming attribution or waiting for
perfect telemetry. Client-identifying values and raw records are not reproduced
on this site.

## The outcome

The response team received a coherent intrusion narrative and containment-ready
indicators rather than separate identity and endpoint summaries. That shared
frame made the remaining investigative gaps explicit and actionable.