import { describe, expect, it } from 'vitest';
import { validateWorkSource, validateWriteupSource } from '../scripts/lib/content-validator.mjs';

function validate(source: string, relativePath = 'valid-post.md') {
  return validateWriteupSource({
    displayPath: `src/content/writeups/${relativePath}`,
    relativePath,
    source,
  }).failures;
}

function validateWork(source: string, relativePath = 'exploitrank.md') {
  return validateWorkSource({
    displayPath: `src/content/work/${relativePath}`,
    relativePath,
    source,
  }).failures;
}

const published = `---
title: A valid post
date: 2026-07-15
snapshotDate: 2026-07-15
summary: This summary is long enough for publication.
tags: [Detection Engineering]
sources:
  - label: Primary evidence
    url: https://example.com/evidence.json
    accessed: 2026-07-15
draft: false
---

Body with a [safe link](https://example.com) and inline \`<code>\`.
`;

const publishedWork = `---
kind: project
sourceId: exploitrank
published: 2026-07-16
snapshotDate: 2026-07-16
heroImage: ../../assets/work/exploitrank/hero.png
heroAlt: ExploitRank dashboard showing an inspectable review queue
evidence:
  - label: Decision model
    detail: Signals resolve into a bounded and inspectable review decision.
  - label: Offline path
    detail: The static dashboard remains useful without runtime services.
draft: false
---

Body with a [safe source](https://example.com).
`;

describe('writeup content policy', () => {
  it('accepts valid published Markdown', () => {
    expect(validate(published)).toEqual([]);
  });

  it('allows an empty summary while a post is a draft', () => {
    expect(
      validate(`---
title: Draft post
date: 2026-07-15
snapshotDate: 2026-07-15
summary: ''
tags: []
sources: []
draft: true
---

Work in progress.
`)
    ).toEqual([]);
  });

  it('rejects unknown frontmatter and duplicate tags', () => {
    const failures = validate(published.replace('draft: false', 'draft: false\ntags_extra: nope').replace(
      'tags: [Detection Engineering]',
      'tags: [Detection Engineering, detection engineering]'
    ));
    expect(failures.join('\n')).toContain('Unrecognized key');
    expect(failures.join('\n')).toContain('Tags must be unique');
  });

  it('requires published provenance and consistent HTTPS source dates', () => {
    const missingSources = validate(
      published.replace(
        `sources:
  - label: Primary evidence
    url: https://example.com/evidence.json
    accessed: 2026-07-15`,
        'sources: []',
      ),
    );
    expect(missingSources.join('\n')).toContain('at least one evidence source');

    const contradictory = validate(
      published
        .replace('snapshotDate: 2026-07-15', 'snapshotDate: 2026-07-16')
        .replace('https://example.com/evidence.json', 'http://example.com/evidence.json'),
    );
    expect(contradictory.join('\n')).toContain('Evidence snapshot cannot be newer');
    expect(contradictory.join('\n')).toContain('Source URLs must use HTTPS');
  });

  it('rejects raw HTML and unsafe URLs', () => {
    const failures = validate(
      published.replace(
        'Body with a [safe link](https://example.com) and inline `<code>`.',
        '<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))'
      )
    );
    expect(failures.join('\n')).toContain('raw HTML is not allowed');
    expect(failures.join('\n')).toContain('unsafe link URL');
  });

  it('rejects noncanonical slugs and empty bodies', () => {
    const failures = validate(published.slice(0, published.indexOf('---', 4) + 3), 'Bad Slug.md');
    expect(failures.join('\n')).toContain('slug must contain only lowercase letters');
    expect(failures.join('\n')).toContain('writeup body cannot be empty');
  });
});

describe('work content policy', () => {
  it('accepts safe work Markdown linked to a canonical registry record', () => {
    expect(validateWork(publishedWork)).toEqual([]);
  });

  it('rejects unknown registry IDs and unsafe body content', () => {
    const failures = validateWork(
      publishedWork
        .replace('sourceId: exploitrank', 'sourceId: missing-project')
        .replace('Body with a [safe source](https://example.com).', '<iframe></iframe>'),
    );
    expect(failures.join('\n')).toContain('unknown project sourceId');
    expect(failures.join('\n')).toContain('raw HTML is not allowed');
  });

  it('rejects an empty work body', () => {
    const frontmatterEnd = publishedWork.indexOf('---', 4) + 3;
    expect(validateWork(publishedWork.slice(0, frontmatterEnd)).join('\n')).toContain(
      'work entry body cannot be empty',
    );
  });
});