<script setup>
// Marks are drawn rather than imported: every other graphic on this site is
// hand-built SVG, a pasted-in brand raster would read as foreign, and drawing
// them avoids Microsoft's brand guidelines and BHIS's trademark entirely.
defineProps({
  mark: { type: String, required: true },
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

    <!-- Black Hills: a ridgeline, with the honeynet cell it guards beneath -->
    <svg v-else-if="mark === 'ridge'" viewBox="0 0 24 24" focusable="false">
      <path d="M2 14 7 7l4 5 4-6 7 8" />
      <path d="M2 14h20v7H2z" />
      <path d="M9 21v-4h6v4" />
    </svg>

    <!-- IndussianAssist: a crosshair over a panel, for white-box testing -->
    <svg v-else-if="mark === 'probe'" viewBox="0 0 24 24" focusable="false">
      <path d="M3 4h18v16H3z" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 5.5v3M12 15.5v3M5.5 12h3M15.5 12h3" />
    </svg>

    <!-- IndussianAssist: a crosshair over a form, for white-box testing -->
    <svg v-else-if="mark === 'probe'" viewBox="0 0 24 24" focusable="false">
      <path d="M4 4h11v16H4z" />
      <path d="M7 8h5M7 11h5M7 14h3" />
      <circle cx="17" cy="9" r="4" />
      <path d="M17 4v10M12 9h10" />
    </svg>

    <!-- fallback: a plain plate so an unknown company still renders -->
    <svg v-else viewBox="0 0 24 24" focusable="false">
      <path d="M3 5h18v14H3z" />
    </svg>
  </span>
</template>
