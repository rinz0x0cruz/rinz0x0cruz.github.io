<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const cursorElement = ref(null)
const clickBursts = ref([])

const stiffness = 650
const damping = 60
const mass = 0.1
const activeCursorClass = 'cursor-follower-active'
const discriminant = Math.sqrt(damping ** 2 - 4 * mass * stiffness)
const slowRoot = (-damping + discriminant) / (2 * mass)
const fastRoot = (-damping - discriminant) / (2 * mass)

let cursorMedia
let reducedMotionMedia
let animationFrame = 0
let lastFrameTime = 0
let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0
let velocityX = 0
let velocityY = 0
let initialized = false
let visible = false
let nextClickBurstId = 0

function advanceSpring(position, velocity, target, elapsed) {
  const displacement = position - target
  const slowCoefficient = (velocity - fastRoot * displacement) / (slowRoot - fastRoot)
  const fastCoefficient = displacement - slowCoefficient
  const slowDecay = Math.exp(slowRoot * elapsed)
  const fastDecay = Math.exp(fastRoot * elapsed)

  return {
    position: target + slowCoefficient * slowDecay + fastCoefficient * fastDecay,
    velocity: slowRoot * slowCoefficient * slowDecay + fastRoot * fastCoefficient * fastDecay,
  }
}

function paintCursor() {
  cursorElement.value?.style.setProperty('--cursor-x', `${currentX}px`)
  cursorElement.value?.style.setProperty('--cursor-y', `${currentY}px`)
}

function animateCursor(time) {
  animationFrame = 0
  if (!visible || !cursorElement.value) return

  const elapsed = Math.min((time - lastFrameTime) / 1000, 0.05)
  lastFrameTime = time

  if (reducedMotionMedia.matches) {
    currentX = targetX
    currentY = targetY
    velocityX = 0
    velocityY = 0
  } else {
    const horizontal = advanceSpring(currentX, velocityX, targetX, elapsed)
    const vertical = advanceSpring(currentY, velocityY, targetY, elapsed)
    currentX = horizontal.position
    currentY = vertical.position
    velocityX = horizontal.velocity
    velocityY = vertical.velocity
  }

  paintCursor()

  const distance = Math.hypot(targetX - currentX, targetY - currentY)
  const speed = Math.hypot(velocityX, velocityY)
  if (distance > 0.05 || speed > 0.05) animationFrame = requestAnimationFrame(animateCursor)
}

function scheduleAnimation() {
  if (animationFrame) return
  lastFrameTime = performance.now()
  animationFrame = requestAnimationFrame(animateCursor)
}

function showCursor(event) {
  if (!cursorMedia.matches || event.pointerType !== 'mouse') {
    if (visible) hideCursor()
    return
  }

  targetX = event.clientX
  targetY = event.clientY

  if (!initialized) {
    currentX = targetX
    currentY = targetY
    velocityX = 0
    velocityY = 0
    initialized = true
    paintCursor()
  }

  visible = true
  document.documentElement.classList.add(activeCursorClass)
  cursorElement.value?.classList.add('cursor-follower--visible')
  cursorElement.value?.classList.toggle(
    'cursor-follower--interactive',
    event.target instanceof Element && Boolean(event.target.closest('button, a, [role="button"]')),
  )

  if (reducedMotionMedia.matches) {
    currentX = targetX
    currentY = targetY
    velocityX = 0
    velocityY = 0
    paintCursor()
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
    return
  }

  scheduleAnimation()
}

function hideCursor() {
  visible = false
  initialized = false
  velocityX = 0
  velocityY = 0
  document.documentElement.classList.remove(activeCursorClass)
  cursorElement.value?.classList.remove(
    'cursor-follower--visible',
    'cursor-follower--interactive',
    'cursor-follower--pressed',
  )
  cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function pressCursor(event) {
  if (!cursorMedia.matches || event.pointerType !== 'mouse') return

  cursorElement.value?.classList.add('cursor-follower--pressed')
  if (event.button !== 0 || reducedMotionMedia.matches) return

  clickBursts.value.push({
    id: nextClickBurstId++,
    x: event.clientX,
    y: event.clientY,
  })
}

function releaseCursor() {
  cursorElement.value?.classList.remove('cursor-follower--pressed')
}

function removeClickBurst(id) {
  clickBursts.value = clickBursts.value.filter((burst) => burst.id !== id)
}

function resetMotion() {
  velocityX = 0
  velocityY = 0
  if (reducedMotionMedia.matches) clickBursts.value = []
  if (!cursorMedia.matches) hideCursor()
}

onMounted(() => {
  cursorMedia = window.matchMedia('(hover: hover) and (pointer: fine) and (forced-colors: none)')
  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  document.addEventListener('pointermove', showCursor, { passive: true })
  document.addEventListener('pointerdown', pressCursor, { passive: true })
  document.addEventListener('pointerup', releaseCursor, { passive: true })
  document.addEventListener('pointercancel', releaseCursor, { passive: true })
  document.documentElement.addEventListener('pointerleave', hideCursor)
  window.addEventListener('blur', hideCursor)
  cursorMedia.addEventListener('change', resetMotion)
  reducedMotionMedia.addEventListener('change', resetMotion)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', showCursor)
  document.removeEventListener('pointerdown', pressCursor)
  document.removeEventListener('pointerup', releaseCursor)
  document.removeEventListener('pointercancel', releaseCursor)
  document.documentElement.removeEventListener('pointerleave', hideCursor)
  window.removeEventListener('blur', hideCursor)
  cursorMedia?.removeEventListener('change', resetMotion)
  reducedMotionMedia?.removeEventListener('change', resetMotion)
  document.documentElement.classList.remove(activeCursorClass)
  cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <span ref="cursorElement" class="cursor-follower" aria-hidden="true">
    <svg class="cursor-follower__arrow" viewBox="0 0 48 48">
      <path d="M3.8 3.9c-1.5-.7-3 .8-2.4 2.4l14.2 36.1c1.3 3.4 6.1 3.7 7.8.4l5.9-11.3 11.3-5.6c3.6-1.7 3.5-6.8-.1-8.4L3.8 3.9Z" />
    </svg>
  </span>

  <span
    v-for="burst in clickBursts"
    :key="burst.id"
    class="click-burst"
    :style="{ left: `${burst.x}px`, top: `${burst.y}px` }"
    aria-hidden="true"
    @animationend.self="removeClickBurst(burst.id)"
  >
    <svg viewBox="0 0 88 72">
      <path d="M31 29c-3-2-4-5-2-7 2-3-1-5-4-7" />
      <path d="M45 24c-1-4 2-5 1-8-1-2 1-4 2-6" />
      <path d="M57 29c3-3 5 0 7-2 2-3 4-1 7-3" />
      <path d="M30 47c-4 0-4-3-7-3-3 1-4-2-8-1" />
    </svg>
  </span>
</template>

<style scoped>
.cursor-follower {
  --cursor-scale: 1;
  --cursor-x: -100px;
  --cursor-y: -100px;
  position: fixed;
  z-index: 2147483647;
  top: 0;
  left: 0;
  display: none;
  width: 23px;
  height: 23px;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(var(--cursor-x), var(--cursor-y), 0) translate(-1px, -1px);
  transition: opacity 140ms ease;
  will-change: transform;
}

.cursor-follower__arrow {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: #fff;
  stroke: #050505;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3.5;
  transform: scale(var(--cursor-scale));
  transform-origin: 1px 1px;
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}

.cursor-follower--visible {
  opacity: 1;
}

.cursor-follower--interactive {
  --cursor-scale: 1.12;
}

.cursor-follower--pressed {
  --cursor-scale: 0.9;
}

.cursor-follower--interactive.cursor-follower--pressed {
  --cursor-scale: 0.98;
}

.click-burst {
  position: fixed;
  z-index: 2147483646;
  width: 88px;
  height: 72px;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0.55);
  animation: click-burst-life 440ms cubic-bezier(0.16, 0.8, 0.25, 1) both;
}

.click-burst svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  filter:
    drop-shadow(0 0 2px rgba(255, 235, 198, 0.95))
    drop-shadow(0 0 7px rgba(209, 163, 95, 0.88));
  stroke: #f1d3a0;
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
  animation: click-burst-draw 260ms ease-out forwards;
}

@keyframes click-burst-life {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.55);
  }

  18% {
    opacity: 1;
  }

  62% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(1.05);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.18);
  }
}

@keyframes click-burst-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (hover: hover) and (pointer: fine) and (forced-colors: none) {
  .cursor-follower {
    display: block;
  }

  :global(html.cursor-follower-active),
  :global(html.cursor-follower-active body),
  :global(html.cursor-follower-active body *) {
    cursor: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .click-burst {
    display: none;
  }

  .cursor-follower,
  .cursor-follower__arrow {
    transition: none;
  }
}
</style>