# Portfolio content modules

Add, remove, or reorder records in the matching file. `profile.js` assembles
them for the existing components; it should not need to change when content is
added.

| Feature | File | Required fields |
| --- | --- | --- |
| Identity, quotes, links | `identity.js` | Links: `id`, `label`, `detail`, `href` |
| Skills / disciplines | `skills.js` | `id`, `abbr`, `name`, `detail` |
| Job experience | `experience.js` | `id`, `company`, `role`, `kind`, `start`, `period`, `place`, `outcome`; non-empty `notable` |
| Languages | `languages.js` | `id`, `name`, `native`, `lang`, `level`, `detail`, `accent` |
| Certifications | `certifications.js` | `id`, `issuer`, `code`, `name`, `status`, `detail`, `accent`; non-empty `links` |
| Projects | `projects.js` | `id`, `name`, `field`, `language`, `issued`, `blurb`, `glyph`, `accent`; non-empty `points`, `flow` |
| Achievements | `achievements.js` | `id`, `metric`, `title`, `detail`, `motif`, `glyph`, `accent` |

Every `id` must be unique, stable, and use lowercase letters, numbers, and
single hyphens. Reordering records is safe. Experience
is displayed in file order, newest first. Projects can be sorted in the UI.
Languages and certifications keep the first record selected initially.

The responsive fixtures verify eight skills, links, languages, and
certifications; ten achievements; and twelve experience/project records.
Skills wrap after four columns. Achievements wrap after five desktop columns
and two mobile columns. Profile links balance into rows, then become a
keyboard-reachable horizontal strip on short screens. Language choices become
a keyboard-reachable horizontal strip after four records. Experience remains a
horizontal timeline; projects and certifications use their existing local
scroll/auto-placement surfaces. None of these collections creates page-level
horizontal overflow at a 320 CSS-pixel viewport.

Achievement `instrument` is optional. Without one, the existing static motif
is used; with one, keep the model path and rotation beside the achievement:

```js
{
  id: 'new-outcome',
  metric: '42',
  title: 'Outcome title',
  detail: 'Evidence summary',
  motif: 'signal',
  glyph: '⌁',
  accent: '#d1a35f',
  instrument: {
    src: '/models/example/model.glb',
    rotation: [0, 0, 0],
  },
}
```

Run `npm run test:profile` after editing content, then `npm test` before
publishing. The profile test rejects empty collections, missing required fields,
and duplicate IDs.