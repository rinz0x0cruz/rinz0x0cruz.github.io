<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { glide } from '../motion.js'

const props = defineProps({
  front: { type: String, required: true },
  back: { type: String, required: true },
})

const flipped = ref(false)
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })
// below this the gesture is still a click, above it the note is being carried
const DRAG_SLOP = 4
// a thrown note may travel this far from where it was pinned and no further, so
// it can always be found again
const TETHER = 260
let origin = null
let press = null
let pointerId = null
let moved = 0
// the last pointer step, normalised to one frame, which becomes the throw
let lastStep = { x: 0, y: 0 }
let lastAt = 0

const held = (value, limit) => Math.max(-limit, Math.min(limit, value))

const throwGlide = glide({
  friction: 0.9,
  step(vx, vy) {
    const next = {
      x: held(offset.value.x + vx, TETHER),
      y: held(offset.value.y + vy, TETHER),
    }
    // pressed against the tether it is no longer travelling, so spend the throw
    const stalled = next.x === offset.value.x && next.y === offset.value.y
    offset.value = next
    return !stalled
  },
})

function onPointerDown(event) {
  // drag only starts on the note itself, so the rail keeps its own gesture
  if (event.button !== undefined && event.button !== 0) return

  // catching a note in flight stops it dead, the way a hand would
  throwGlide.stop()
  pointerId = event.pointerId
  press = { x: event.clientX, y: event.clientY }
  origin = { x: event.clientX - offset.value.x, y: event.clientY - offset.value.y }
  moved = 0
  lastStep = { x: 0, y: 0 }
  lastAt = event.timeStamp
}

function onPointerMove(event) {
  if (origin === null || event.pointerId !== pointerId) return

  // total displacement from the press, not the sum of steps: a slow drag covers
  // ground in increments too small to trip a per-move threshold
  moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)

  if (!dragging.value) {
    if (moved <= DRAG_SLOP) return
    // capture only once it is really a drag; capturing on press would retarget
    // the click to this wrapper and the face button would never flip
    dragging.value = true
    event.currentTarget.setPointerCapture(pointerId)
  }

  const next = { x: event.clientX - origin.x, y: event.clientY - origin.y }
  // per frame, not per event: a high polling rate reports smaller steps more
  // often, and an unnormalised delta would make the same gesture throw weaker
  const frames = Math.min(4, Math.max(0.25, (event.timeStamp - lastAt) / 16.7))
  lastStep = {
    x: (next.x - offset.value.x) / frames,
    y: (next.y - offset.value.y) / frames,
  }
  lastAt = event.timeStamp
  offset.value = next
}

function onPointerUp(event) {
  if (event.pointerId !== pointerId) return

  const thrown = dragging.value
  if (thrown) event.currentTarget.releasePointerCapture?.(pointerId)
  dragging.value = false
  origin = null
  press = null
  pointerId = null

  // let go while still moving and the note keeps going, then settles. A note let
  // go from rest simply stays put, and reduced motion never throws at all.
  if (!thrown || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (Math.hypot(lastStep.x, lastStep.y) > 1) throwGlide.push(lastStep.x, lastStep.y)
}

// a drag that ends where it started is a click, so flipping never fires mid-drag
function onClick() {
  if (moved > DRAG_SLOP) return

  flipped.value = !flipped.value
}

function onKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  flipped.value = !flipped.value
}

onBeforeUnmount(() => {
  throwGlide.stop()
  dragging.value = false
})
</script>

<template>
  <div
    :class="['sticky-note', { 'sticky-note--flipped': flipped, 'sticky-note--dragging': dragging }]"
    :style="{ '--note-x': `${offset.x}px`, '--note-y': `${offset.y}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <button
      class="sticky-note__face sticky-note__face--front"
      type="button"
      :aria-pressed="flipped"
      :tabindex="flipped ? -1 : 0"
      @click="onClick"
      @keydown="onKeydown"
    >
      <span class="sticky-note__hand">{{ props.front }}</span>
      <span class="sticky-note__hint" aria-hidden="true">turn over</span>
    </button>

    <div class="sticky-note__face sticky-note__face--back" :aria-hidden="!flipped">
      <button
        class="sticky-note__reply"
        type="button"
        :tabindex="flipped ? 0 : -1"
        @click="onClick"
        @keydown="onKeydown"
      >
        <span class="sticky-note__hand">{{ props.back }}</span>

        <svg class="sticky-note__shake" viewBox="0 0 64 30" aria-hidden="true" focusable="false">
          <path d="M4 17c4-3 7-5 10-4l6 3" />
          <path d="M60 17c-4-3-7-5-10-4l-6 3" />
          <path d="M20 16c3-2 6-4 9-2l4 3c2 1 4 1 6-1l5-4c2-2 4-1 6 1" />
          <path d="M26 21c2 2 5 3 8 2M30 25c2 1 4 1 6 0" />
        </svg>

        <span class="sticky-note__hint" aria-hidden="true">turn back</span>
      </button>
    </div>
  </div>
</template>
