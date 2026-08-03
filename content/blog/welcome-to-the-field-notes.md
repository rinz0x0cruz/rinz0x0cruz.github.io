---
title: Field notes, not victory laps
summary: The first version of this blog promised transparent methods in 175 tidy words. The useful version has to show the awkward parts too.
published: 2026-08-02
updated: 2026-08-03
tags:
  - Security research
  - Threat intelligence
  - ATT&CK
---

## The first draft behaved too well

The first version of this page was 175 words long.

It promised sources, assumptions, uncertainty, corrections, and reproducible methods. It had a neat little workflow. It had a respectable blockquote. Every sentence arrived on time and sat up straight.

It also demonstrated none of the things it promised.

That is an easy failure mode for a portfolio. The conclusion gets a polished card; the false starts, rejected designs, and inconvenient evidence disappear backstage. The result looks certain because all the uncertainty was edited out.

I do not want this blog to become a shelf of tiny victory laps. I want field notes: the question I was trying to answer, the artifact that surprised me, the assumption that broke, and the boundary I am still not willing to cross.

## Field notes need fingerprints

The useful version of a technical post leaves marks from the work itself.

For ExploitRank, that means showing why [8,218 eligible CVEs became 411 review seats](/blog/fixed-budget-vulnerability-triage/) and why a queue position must not be repeated as an exploitation probability.

For Malscope, it means admitting that [the article's own TLP claim failed validation](/blog/publishing-malware-analysis-evidence/) before the release boundary actually deserved the sentence.

For Quorum, it means keeping the ugly benchmark where [the judge said 85 and deterministic accuracy said zero](/blog/benchmark-before-you-debate/) instead of charting the flattering column and quietly backing away.

Those moments do more work than another paragraph saying I value rigor. They let the reader inspect what rigor changed.

> If a post has no artifact, rejected idea, changed assumption, or remaining doubt, I probably published the conclusion too early.

My working loop is still simple, but it is no longer decorative:

```text
question -> evidence -> wrong turn -> check -> correction -> remaining doubt
```

## What belongs on the page

I write about vulnerability intelligence, threat hunting, malware analysis, detection engineering, governance, and the systems connecting them. A post might explain a shipped tool, preserve a method, or document a failure that is cheaper to repeat in prose than in production.

The standard is not “publish everything.” It is “show enough to challenge the claim.” That usually means:

- the operational question, not just the feature name;
- one concrete receipt: data, output, diff, test, or timeline;
- the tempting shortcut and why I rejected it;
- observation separated from inference;
- what the result does **not** prove;
- the evidence that would make me revise it.

I will occasionally use [MITRE ATT&CK](https://attack.mitre.org/) or another framework to organize evidence. The framework does not get to replace the evidence. A technique label is not attribution; a control mapping is not implementation; a green test is not proof that the test asked the right question.

## What stays off the page

Transparency is not an excuse to publish secrets, malware bytes, private case history, customer data, credentials, or implementation details that widen an attack surface.

That creates a useful tension: a public artifact should be inspectable without becoming a data leak. Sometimes the most interesting engineering work is the boundary that makes both statements true.

When a project keeps its backend private, I will say so. When a dashboard contains fixtures rather than production data, I will say so. When a result depends on a model judge, a dated snapshot, or a local environment, I will keep that context attached instead of letting the number wander around unsupervised.

## Corrections do not get a trapdoor

New evidence should be allowed to make an old post less comfortable.

I will update the record when a source changes, an assumption fails, or a better test contradicts the first conclusion. The goal is not to preserve the appearance that I was right on the first try. The goal is to make the path from wrong to less wrong visible enough to reuse.

That is why these are field notes. A field note can be revised without pretending the earlier observation never existed.

## Start with the awkward parts

Read the fixed-budget queue if you want a design trade-off, the Malscope boundary if you want a compact security postmortem, or the Quorum benchmark if you enjoy two metrics disagreeing in public.

You can also browse the [public projects](https://github.com/rinz0x0cruz), return to the [portfolio home page](/), follow the [blog index](/blog/), or subscribe through the [RSS feed](/blog/feed.xml).

The first draft told you I would publish my methods. The rest of the blog has to prove it.