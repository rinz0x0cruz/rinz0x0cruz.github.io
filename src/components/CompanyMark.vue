<script setup>
import { isCompanyMark } from '../content/contracts.js'

// Marks are drawn rather than imported: every other graphic on this site is
// hand-built SVG, a pasted-in brand raster would read as foreign, and drawing
// them keeps this to nominative use of each company's shapes rather than
// redistributing their artwork.
defineProps({
  mark: { type: String, required: true, validator: isCompanyMark },
})
</script>

<template>
  <span class="company-mark-glyph" aria-hidden="true">
    <!-- Microsoft: the four-square arrangement, already the site's own token -->
    <svg v-if="mark === 'microsoft'" viewBox="0 0 24 24" focusable="false">
      <rect x="2" y="2" width="9" height="9" fill="#f25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7fba00" />
      <rect x="2" y="13" width="9" height="9" fill="#00a4ef" />
      <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
    </svg>

    <!-- Hacker4Justice: scales, drawn as a balance over a terminal caret -->
    <svg v-else-if="mark === 'justice'" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3v16M6 19h12" />
      <path d="M12 6 5 10M12 6l7 4" />
      <path d="M2.5 10.5h5L5 15.5ZM16.5 10.5h5L19 15.5Z" />
    </svg>

    <!-- Black Hills: their badge, drawn in this site's stroke idiom rather than
         pasted in - the hills in a hex, behind a crossed pick and cable -->
    <svg v-else-if="mark === 'bhis'" viewBox="0 0 24 24" focusable="false">
      <path d="M3.4 4.6 8.6 9.8M20.6 4.6 15.4 9.8" />
      <path d="M2.2 5.8a3 3 0 0 1 3.6-2.4" />
      <path d="M19.6 3.2h3v3h-3z" />
      <path d="M7.6 3.4h8.8l4.2 8.6-4.2 8.6H7.6L3.4 12z" />
      <path d="M7.2 15.6 10.1 10l2 2.7 2.4-4 2.5 6.9" />
      <path d="M7.2 17.6h9.6" />
    </svg>

    <!-- IndussianAssist: a crosshair over a panel, for white-box testing -->
    <svg v-else-if="mark === 'probe'" viewBox="0 0 24 24" focusable="false">
      <path d="M3 4h18v16H3z" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3" />
    </svg>

    <!-- fallback: a plain plate so an unknown company still renders -->
    <svg v-else viewBox="0 0 24 24" focusable="false">
      <path d="M3 5h18v14H3z" />
    </svg>
  </span>
</template>
