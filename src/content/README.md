# Portfolio content modules

Add, remove, or reorder records in the matching file. `profile.js` assembles
them for the existing components; it should not need to change when content is
added. The content layer is plain JavaScript data and requires no AI service or
content-management system.

| Feature | File | Required fields |
| --- | --- | --- |
| Identity, quotes, links | `identity.js` | Links: `id`, `label`, `detail`, `href` |
| Skills / disciplines | `skills.js` | `id`, `abbr`, `name`, `detail` |
| Job experience | `experience.js` | `id`, `company`, `mark`, `role`, `kind`, `start`, `period`, `place`, `outcome`; non-empty `notable` |
| Languages | `languages.js` | `id`, `name`, `native`, `lang`, `level`, `detail`, `accent` |
| Certifications | `certifications.js` | `id`, `issuer`, `code`, `name`, `status`, `detail`, `accent`; non-empty `links` |
| Projects | `projects.js` | `id`, `name`, `field`, `language`, `issued`, `blurb`, `glyph`, `accent`; non-empty `points`, `flow` |
| Achievements | `achievements.js` | `id`, `metric`, `title`, `detail`, `motif`, `glyph`, `accent` |

Every `id` must be unique, stable, and use lowercase letters, numbers, and
single hyphens. Reordering records is safe. Experience
is displayed in file order, newest first. Projects can be sorted in the UI.
Languages and certifications keep the first record selected initially.

Project `links` are optional `{ label, href }` records. Destinations must be
unique HTTPS URLs on `github.com` or `rinz0x0cruz.github.io`; private projects
use `note` instead of inventing a public source.

Images referenced by a content record belong under `public/` and use a
root-relative URL such as `/experience/example.webp`. Supply intrinsic `w` and
`h` values, meaningful `alt` text, a stable focal `position`, and source/licence
metadata when the image is not original work. Keep public photo attribution in
`public/PHOTO-NOTICE.md` and in the record's `credit` object.

The responsive fixtures verify eight skills, links, languages, and
certifications; ten achievements; and twelve experience/project records.
Skills wrap after four columns. Achievements wrap after five desktop columns
and two mobile columns. Profile links balance into rows, then become a
keyboard-reachable horizontal strip on short screens. Language choices become
a keyboard-reachable horizontal strip after four records. Experience remains a
horizontal timeline; projects and certifications use their existing local
scroll/auto-placement surfaces. None of these collections creates page-level
horizontal overflow at a 320 CSS-pixel viewport.

Accents use six-digit hex colors. Experience `mark` must be one of
`microsoft`, `justice`, `bhis`, or `probe`. Achievement `motif` must be one of
`orbit`, `stack`, `prism`, or `signal`.

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

Instrument paths are root-relative `.glb` URLs and `rotation` must contain
exactly three finite numbers.

Run `npm run test:profile` after editing content, then `npm test` before
publishing. The profile test rejects empty collections, missing required fields,
and duplicate IDs. The browser suite also exercises larger synthetic collections,
so do not hard-code layout dimensions to today's record count.

## Human editing workflow

1. Edit only the matching module in this directory.
2. Put any new public asset and its provenance notice under `public/`.
3. Run `npm run test:profile`.
4. Run `npm run dev` and inspect the affected desktop and mobile section.
5. Run `npm run test:smoke` for a bounded browser check.
6. Run `npm test` before opening or merging the final pull request.

If validation reports a duplicate ID, missing field, unsupported link, or page
overflow, correct the content or responsive layout rather than weakening the
validator. Generated `dist/` files are never the editing source.