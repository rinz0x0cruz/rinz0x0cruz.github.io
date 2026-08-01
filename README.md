# Portfolio v2

Vue portfolio, built with Vite.

## Features

- Identity-first hero with an interactive portrait, availability state, rotating field notes, and security-discipline band.
- Expandable profile links for the résumé preview, GitHub, LinkedIn, and Gmail compose.
- Verified outcome cards with lazy-loaded Three.js instruments and static fallbacks.
- Keyboard-, wheel-, and drag-accessible career rail with reversible evidence cards.
- Sortable and shuffleable project stamp album with project details and public links.
- Independent, data-driven language and certification sections.
- Responsive layouts with reduced-motion, reduced-data, forced-colors, and no-JavaScript support.
- Search and social metadata with a branded preview card.
- Tested GitHub Pages deployment with a post-deploy live smoke check.

Portfolio content is maintained in `src/profile.js`.

## Development

```sh
npm ci
npm run dev
```

Create a production build with `npm run build`.

Run the production browser checks with:

```sh
npx playwright install chromium
npm test
```
