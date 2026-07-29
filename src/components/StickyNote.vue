<script setup>
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  front: { type: String, required: true },
  back: { type: String, required: true },
})

const flipped = ref(false)
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })
// below this the gesture is still a click, above it the note is being carried
const DRAG_SLOP = 4
let origin = null
let press = null
let pointerId = null
let moved = 0

function onPointerDown(event) {
  // drag only starts on the note itself, so the rail keeps its own gesture
  if (event.button !== undefined && event.button !== 0) return

  pointerId = event.pointerId
  press = { x: event.clientX, y: event.clientY }
  origin = { x: event.clientX - offset.value.x, y: event.clientY - offset.value.y }
  moved = 0
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

  offset.value = { x: event.clientX - origin.x, y: event.clientY - origin.y }
}

function onPointerUp(event) {
  if (event.pointerId !== pointerId) return

  if (dragging.value) event.currentTarget.releasePointerCapture?.(pointerId)
  dragging.value = false
  origin = null
  press = null
  pointerId = null
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
