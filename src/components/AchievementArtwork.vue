<script setup>
import { computed } from 'vue'

const props = defineProps({
  motif: {
    type: String,
    required: true,
  },
})

const dotsId = computed(() => `achievement-dots-${props.motif}`)
const denseDotsId = computed(() => `achievement-dense-dots-${props.motif}`)
const fadeId = computed(() => `achievement-fade-${props.motif}`)
</script>

<template>
  <svg class="achievement-art" viewBox="0 0 240 220" focusable="false" aria-hidden="true">
    <defs>
      <pattern :id="dotsId" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.25" fill="currentColor" />
        <circle cx="5.5" cy="5.5" r="0.7" fill="currentColor" opacity="0.7" />
      </pattern>
      <pattern :id="denseDotsId" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.85" fill="currentColor" />
        <circle cx="3.7" cy="3.7" r="0.45" fill="currentColor" opacity="0.78" />
      </pattern>
      <linearGradient :id="fadeId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.98" />
        <stop offset="0.52" stop-color="#bfc3c4" stop-opacity="0.9" />
        <stop offset="1" stop-color="#666b6e" stop-opacity="0.58" />
      </linearGradient>
    </defs>

    <g v-if="motif === 'orbit'">
      <circle class="achievement-art__ghost" cx="153" cy="63" r="42" />
      <circle class="achievement-art__dots" cx="153" cy="63" r="35" :fill="`url(#${denseDotsId})`" />
      <ellipse class="achievement-art__wire" cx="153" cy="63" rx="40" ry="22" transform="rotate(-12 153 63)" />
      <path class="achievement-art__solid" d="M125 91 94 126l11 10 32-36Z" :fill="`url(#${fadeId})`" />
      <path class="achievement-art__dots" d="M22 202c12-32 28-57 51-74 7-5 16-4 21 2 5 7 3 15-4 20l-15 11 20-10c8-4 16-1 20 5 4 7 1 15-6 19l-24 13 18-4c7-2 14 2 16 9l2 9Z" :fill="`url(#${dotsId})`" />
      <path class="achievement-art__wire" d="m42 181 33-20m-19 29 39-19m-22 27 30-14" />
      <circle class="achievement-art__accent" cx="153" cy="63" r="5" />
      <path class="achievement-art__spark" d="M187 33h13m-6-7v14M111 49h9m-4-5v10" />
    </g>

    <g v-else-if="motif === 'stack'">
      <rect class="achievement-art__solid" x="84" y="44" width="80" height="101" rx="5" :fill="`url(#${fadeId})`" />
      <rect class="achievement-art__cutout" x="92" y="53" width="64" height="83" rx="2" />
      <path class="achievement-art__wire" d="M101 68h46M101 82h33M101 96h46M101 110h25" />
      <path class="achievement-art__dots" d="M4 118c25-28 48-47 69-58 10-5 20 2 19 12-1 5-5 9-10 12L64 95l16-5c9-3 17 4 15 13-1 5-5 8-10 10l-20 7 18-2c9-1 16 7 12 16-2 4-6 7-11 7l-35 2-25 31Z" :fill="`url(#${dotsId})`" />
      <path class="achievement-art__dots" d="M236 131c-18-20-35-34-52-43-9-5-19 0-19 11 0 5 3 9 8 12l14 8-13-3c-8-2-15 5-12 13 2 5 6 8 11 9l21 4-16 1c-8 1-13 9-9 16 2 4 6 6 11 6l30-3 20 31Z" :fill="`url(#${denseDotsId})`" />
      <path class="achievement-art__wire" d="m24 120 34-26m139 25-23-21M43 138l36-18m101 23 27 4" />
      <circle class="achievement-art__accent" cx="124" cy="124" r="6" />
    </g>

    <g v-else-if="motif === 'prism'">
      <g transform="rotate(34 126 91)">
        <rect class="achievement-art__solid" x="99" y="23" width="54" height="140" rx="18" :fill="`url(#${fadeId})`" />
        <path class="achievement-art__dots" d="M99 49h54v64H99z" :fill="`url(#${denseDotsId})`" />
        <path class="achievement-art__wire" d="M108 35h36m-36 99h36M107 67h38M107 84h38" />
      </g>
      <path class="achievement-art__dots" d="M65 213c4-35 10-61 19-77 4-7 12-10 19-7 6 3 9 10 6 17l-6 14 9-20c3-8 12-11 19-7 6 4 8 11 5 18l-7 16 9-14c4-7 13-8 19-3 5 5 6 12 2 18l-26 39Z" :fill="`url(#${dotsId})`" />
      <path class="achievement-art__wire" d="m86 185 18-32m-6 43 22-42m-4 47 25-37" />
      <path class="achievement-art__spark" d="M181 48h15m-8-8v16M62 72h10m-5-5v10" />
    </g>

    <g v-else>
      <ellipse class="achievement-art__ghost" cx="142" cy="83" rx="54" ry="24" />
      <ellipse class="achievement-art__solid" cx="142" cy="81" rx="45" ry="18" :fill="`url(#${fadeId})`" />
      <ellipse class="achievement-art__dots" cx="142" cy="78" rx="38" ry="13" :fill="`url(#${denseDotsId})`" />
      <path class="achievement-art__wire" d="M110 78c16-10 48-10 64 0m-52 4c11-5 29-5 40 0" />
      <path class="achievement-art__dots" d="M9 174c22-7 42-18 60-34l22-20c7-7 18-7 25 0 4 5 4 12 0 17l-9 10 22-9c13-5 27-3 39 5l27 20c8 6 10 17 4 25-5 7-15 10-23 6l-25-12c-7-3-15-4-22-1l-48 18c-18 7-39 6-56-4Z" :fill="`url(#${dotsId})`" />
      <path class="achievement-art__wire" d="m35 172 43-18m-25 31 48-21m35 2 36 17" />
      <circle class="achievement-art__accent" cx="142" cy="78" r="4" />
      <circle class="achievement-art__wire" cx="142" cy="78" r="29" />
      <circle class="achievement-art__wire" cx="142" cy="78" r="19" />
    </g>
  </svg>
</template>

<style scoped>
.achievement-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  color: #f0ede7;
  filter: grayscale(1) contrast(1.18) drop-shadow(0 0.7rem 1rem rgba(0, 0, 0, 0.72));
  transition:
    filter 360ms ease,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.achievement-art__solid,
.achievement-art__dots {
  stroke: rgba(244, 242, 236, 0.76);
  stroke-width: 1;
}

.achievement-art__wire,
.achievement-art__spark {
  fill: none;
  stroke: rgba(244, 242, 236, 0.9);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.35;
}

.achievement-art__spark {
  stroke-width: 1;
}

.achievement-art__ghost {
  fill: rgba(240, 237, 231, 0.035);
  stroke: rgba(240, 237, 231, 0.15);
}

.achievement-art__cutout {
  fill: #020303;
  stroke: rgba(240, 237, 231, 0.5);
}

.achievement-art__accent {
  fill: var(--tile-accent);
  stroke: rgba(255, 255, 255, 0.72);
  stroke-width: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .achievement-art {
    transition: none;
  }
}
</style>