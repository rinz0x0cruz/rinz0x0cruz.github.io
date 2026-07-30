<script setup>
// Extracted from the achievement window so the charcoal portrait can wear the
// same filigree. Class names are unchanged: the styling and its animation
// triggers are established, and renaming them would churn 58 CSS rules and
// twenty assertions for no visual gain. Whoever mounts this positions it.
</script>

<template>
  <span class="achievement-filigree" aria-hidden="true">
    <svg
      class="achievement-filigree__corner achievement-filigree__corner--primary achievement-filigree__corner--top-left"
      style="--filigree-delay: 120ms"
      viewBox="0 0 72 72"
    >
      <path class="achievement-filigree__path achievement-filigree__path--shadow" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--stem" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--thread" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--branch" pathLength="1" d="M24 13L31 21L23 29L32 38M12 26L20 34L13 43" />
      <g class="achievement-filigree__leaves">
        <path style="--leaf-delay: 0ms" d="m29 18 8-1-3 7-6 2Z" />
        <path style="--leaf-delay: 70ms" d="m23 27-8 2 4 6 7-1Z" />
        <path style="--leaf-delay: 140ms" d="m30 36 8 2-5 6-7-2Z" />
        <path style="--leaf-delay: 210ms" d="m18 34-7 1 3 6 6-2Z" />
      </g>
    </svg>

    <svg
      class="achievement-filigree__corner achievement-filigree__corner--secondary achievement-filigree__corner--top-right"
      style="--filigree-delay: 280ms"
      viewBox="0 0 44 44"
    >
      <path class="achievement-filigree__path achievement-filigree__path--shadow" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <path class="achievement-filigree__path achievement-filigree__path--stem" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <path class="achievement-filigree__path achievement-filigree__path--thread" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <g class="achievement-filigree__leaves">
        <path style="--leaf-delay: 40ms" d="m18 9 7-1-3 6-6 1Z" />
        <path style="--leaf-delay: 130ms" d="m10 22-6 2 3 5 5-2Z" />
      </g>
    </svg>

    <svg
      class="achievement-filigree__corner achievement-filigree__corner--primary achievement-filigree__corner--bottom-right"
      style="--filigree-delay: 360ms"
      viewBox="0 0 72 72"
    >
      <path class="achievement-filigree__path achievement-filigree__path--shadow" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--stem" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--thread" pathLength="1" d="M70 5H34L24 13H12V26L5 34V70" />
      <path class="achievement-filigree__path achievement-filigree__path--branch" pathLength="1" d="M24 13L31 21L23 29L32 38M12 26L20 34L13 43" />
      <g class="achievement-filigree__leaves">
        <path style="--leaf-delay: 0ms" d="m29 18 8-1-3 7-6 2Z" />
        <path style="--leaf-delay: 70ms" d="m23 27-8 2 4 6 7-1Z" />
        <path style="--leaf-delay: 140ms" d="m30 36 8 2-5 6-7-2Z" />
        <path style="--leaf-delay: 210ms" d="m18 34-7 1 3 6 6-2Z" />
      </g>
    </svg>

    <svg
      class="achievement-filigree__corner achievement-filigree__corner--secondary achievement-filigree__corner--bottom-left"
      style="--filigree-delay: 500ms"
      viewBox="0 0 44 44"
    >
      <path class="achievement-filigree__path achievement-filigree__path--shadow" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <path class="achievement-filigree__path achievement-filigree__path--stem" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <path class="achievement-filigree__path achievement-filigree__path--thread" pathLength="1" d="M42 4H20l-8 8v10l-8 8v12" />
      <g class="achievement-filigree__leaves">
        <path style="--leaf-delay: 40ms" d="m18 9 7-1-3 6-6 1Z" />
        <path style="--leaf-delay: 130ms" d="m10 22-6 2 3 5 5-2Z" />
      </g>
    </svg>

    <i class="achievement-filigree__stitch"></i>
  </span>
</template>
