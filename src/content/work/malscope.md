---
kind: project
sourceId: malscope-dashboard
published: 2026-07-16
snapshotDate: 2026-07-16
heroImage: ../../assets/work/malscope-dashboard/hero.png
heroAlt: Malscope dashboard presenting redacted malware relationships, indicators, and generated detection coverage
evidence:
  - label: Shareable boundary
    detail: The public dashboard renders redacted report manifests while the analysis engine and malware samples remain private.
  - label: Safe indicators
    detail: Network indicators are defanged and samples are represented by hashes, preserving investigative value without live payloads.
  - label: Detection handoff
    detail: Similarity clusters and extracted behavior flow into reviewable YARA and Sigma coverage instead of ending as a static report.
draft: false
---

## The result

Malscope separates malware analysis from publication. The private pipeline can
process sensitive samples while a static dashboard exposes only the evidence a
defender can safely inspect: hashes, defanged indicators, similarity clusters,
configuration intelligence, and generated detection artifacts.

## The constraint

The public surface could not contain a retrievable sample, a live network
indicator, or private analysis infrastructure. Redaction therefore belongs to
the export boundary rather than a visual filter that could be bypassed in the
browser.

## The architecture

The analysis pipeline produces a constrained report manifest. The dashboard
validates and renders that manifest as a static application, keeping publication
independent from the analysis runtime and making the deployable artifact easy to
audit.

## The tradeoff

Redaction removes some reproduction detail. The dashboard compensates by
preserving provenance, stable feature relationships, and detection outputs so a
reviewer can still understand how the conclusion was reached.