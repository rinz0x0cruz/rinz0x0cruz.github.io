import { describe, expect, it } from 'vitest';
import { validateWriteupSource } from '../scripts/lib/content-validator.mjs';

function validate(source: string, relativePath = 'valid-post.md') {
  return validateWriteupSource({
    displayPath: `src/content/writeups/${relativePath}`,
    relativePath,
    source,
  }).failures;
}

const published = `---
title: A valid post
date: 2026-07-15
summary: This summary is long enough for publication.
tags: [Detection Engineering]
draft: false
---

Body with a [safe link](https://example.com) and inline \`<code>\`.
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
summary: ''
tags: []
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