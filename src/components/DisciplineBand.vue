<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import profile from '../profile.js'

const disciplines = profile.disciplines
const label = `Disciplines: ${disciplines.map(({ name, detail }) => `${name} - ${detail}`).join('. ')}.`

const band = ref(null)
const armed = ref(false)
const active = ref(false)
let intersectionObserver
let forcedColorsMedia
let reducedMotionMedia
let supportedLayoutMedia

function syncEnvironment() {
  if (
    supportedLayoutMedia.matches
    && !reducedMotionMedia.matches
    && !forcedColorsMedia.matches
  ) return

  intersectionObserver?.disconnect()
  intersectionObserver = undefined
  armed.value = false
  active.value = false
}

onMounted(() => {
  supportedLayoutMedia = window.matchMedia('(min-width: 1000px) and (min-height: 641px)')
  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  forcedColorsMedia = window.matchMedia('(forced-colors: active)')
  supportedLayoutMedia.addEventListener('change', syncEnvironment)
  reducedMotionMedia.addEventListener('change', syncEnvironment)
  forcedColorsMedia.addEventListener('change', syncEnvironment)

  if (
    !supportedLayoutMedia.matches
    || reducedMotionMedia.matches
    || forcedColorsMedia.matches
    || !('IntersectionObserver' in window)
  ) return

  armed.value = true
  intersectionObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return

    active.value = true
    intersectionObserver.disconnect()
    intersectionObserver = undefined
  }, { threshold: 0.05 })
  intersectionObserver.observe(band.value)
})

onBeforeUnmount(() => {
  intersectionObserver?.disconnect()
  supportedLayoutMedia?.removeEventListener('change', syncEnvironment)
  reducedMotionMedia?.removeEventListener('change', syncEnvironment)
  forcedColorsMedia?.removeEventListener('change', syncEnvironment)
})
</script>

<template>
  <figure
    ref="band"
    :class="['discipline-band', { 'discipline-band--armed': armed, 'discipline-band--active': active }]"
    :data-band-state="active ? 'shown' : armed ? 'armed' : 'static'"
    role="img"
    :aria-label="label"
  >
    <figcaption class="discipline-band__topline" aria-hidden="true">
      <span>Practice</span>
      <b>/ {{ String(disciplines.length).padStart(2, '0') }}</b>
    </figcaption>

    <ol class="discipline-band__list" aria-hidden="true">
      <li
        v-for="(discipline, index) in disciplines"
        :key="discipline.abbr"
        class="discipline-band__cell"
        :style="{ '--cell-index': index }"
      >
        <strong class="discipline-band__abbr">{{ discipline.abbr }}</strong>
        <span class="discipline-band__rule"></span>
        <span class="discipline-band__name">{{ discipline.name }}</span>
        <span class="discipline-band__detail">{{ discipline.detail }}</span>
      </li>
    </ol>
  </figure>
</template>
