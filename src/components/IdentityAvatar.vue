<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import defaultMaskSource from '../assets/avatar-yokai-mask.svg?url'

const defaultMaskMarkup = ref('')

const props = defineProps({
  frameSrc: {
    type: String,
    default: '/avatar-interactive-frame.webp',
  },
  personSrc: {
    type: String,
    default: '/avatar-interactive-person.webp',
  },
  winkSrc: {
    type: String,
    default: '/avatar-interactive-wink-patch.png',
  },
  width: {
    type: Number,
    default: 698,
  },
  height: {
    type: Number,
    default: 932,
  },
  winkRect: {
    type: Object,
    default: () => ({ x: 291, y: 248, width: 40, height: 20 }),
  },
  maskSrc: {
    type: String,
    default: defaultMaskSource,
  },
  maskRect: {
    type: Object,
    default: () => ({ x: 195, y: 118, width: 308, height: 308 }),
  },
  maskLabel: {
    type: String,
    default: 'Dismiss yokai mask',
  },
  maskRestoreLabel: {
    type: String,
    default: 'Restore yokai mask',
  },
  label: {
    type: String,
    default: '01',
  },
})

const usesInlineMask = computed(
  () => props.maskSrc === defaultMaskSource && Boolean(defaultMaskMarkup.value),
)

onMounted(async () => {
  try {
    const response = await fetch(defaultMaskSource)
    if (!response.ok) return

    defaultMaskMarkup.value = (await response.text()).replace(/^<\?xml[^>]*>\s*/, '')
  } catch {
    defaultMaskMarkup.value = ''
  }
})

const avatarStyle = computed(() => ({
  '--avatar-ratio': `${props.width} / ${props.height}`,
  '--wink-left': `${(props.winkRect.x / props.width) * 100}%`,
  '--wink-top': `${(props.winkRect.y / props.height) * 100}%`,
  '--wink-width': `${(props.winkRect.width / props.width) * 100}%`,
  '--wink-height': `${(props.winkRect.height / props.height) * 100}%`,
  '--mask-left': `${(props.maskRect.x / props.width) * 100}%`,
  '--mask-top': `${(props.maskRect.y / props.height) * 100}%`,
  '--mask-width': `${(props.maskRect.width / props.width) * 100}%`,
  '--mask-height': `${(props.maskRect.height / props.height) * 100}%`,
  '--mask-image': `url("${props.maskSrc}")`,
}))

const maskState = ref('visible')
let maskAnimationTimer

const settleMaskAnimation = () => {
  window.clearTimeout(maskAnimationTimer)
  maskAnimationTimer = undefined

  if (maskState.value === 'dismissing') maskState.value = 'hidden'
  if (maskState.value === 'appearing') maskState.value = 'visible'
}

const toggleMask = () => {
  if (maskState.value === 'dismissing' || maskState.value === 'appearing') return

  if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    maskState.value = maskState.value === 'visible' ? 'hidden' : 'visible'
    return
  }

  maskState.value = maskState.value === 'visible' ? 'dismissing' : 'appearing'
  maskAnimationTimer = window.setTimeout(settleMaskAnimation, 650)
}

const finishMaskAnimation = (event) => {
  if (event.target !== event.currentTarget) return
  if (event.animationName === 'mask-fizzle' || event.animationName === 'mask-fade-in') {
    settleMaskAnimation()
  }
}

onBeforeUnmount(() => window.clearTimeout(maskAnimationTimer))
</script>

<template>
  <div class="identity-avatar" :style="avatarStyle">
    <img class="identity-avatar__frame" :src="frameSrc" alt="" :width="width" :height="height" fetchpriority="high" />
    <span class="identity-avatar__character">
      <img class="identity-avatar__person" :src="personSrc" alt="" :width="width" :height="height" fetchpriority="high" />
      <img
        class="identity-avatar__wink"
        :src="winkSrc"
        alt=""
        :width="winkRect.width"
        :height="winkRect.height"
      />
      <button
        class="identity-avatar__mask"
        :class="`identity-avatar__mask--${maskState}`"
        type="button"
        :aria-label="maskState === 'hidden' ? maskRestoreLabel : maskLabel"
        :aria-disabled="maskState === 'dismissing' || maskState === 'appearing'"
        @click="toggleMask"
        @animationend="finishMaskAnimation"
      >
        <span
          v-if="usesInlineMask"
          class="identity-avatar__mask-art"
          aria-hidden="true"
          v-html="defaultMaskMarkup"
        ></span>
        <img v-else :src="maskSrc" alt="" />
        <i v-for="fragment in 4" :key="fragment" aria-hidden="true"></i>
      </button>
      <span class="identity-avatar__prompt" aria-hidden="true">
        <strong>Brave enough?</strong>
        <span>Click to unmask.</span>
      </span>
    </span>
    <small>{{ label }}</small>
  </div>
</template>

<style scoped>
.identity-avatar {
  position: relative;
  display: grid;
  width: 11.5rem;
  height: 17rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid #3c3a35;
  border-radius: 4px;
  background: #0d0d0c;
  box-shadow: inset 0 0 0 0.75rem #090909, inset 0 0 0 calc(0.75rem + 1px) #292824;
  color: var(--text);
  animation: avatar-frame 4.8s ease-in-out infinite;
  isolation: isolate;
}

.identity-avatar::after {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 0.45rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 1rem rgba(209, 163, 95, 0.45);
  content: '';
  animation: avatar-beacon 2.4s ease-in-out infinite;
}

.identity-avatar__frame,
.identity-avatar__character {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: calc(100% - 1rem);
  aspect-ratio: var(--avatar-ratio);
  transform: translate(-50%, -50%);
}

.identity-avatar__frame {
  z-index: 2;
  height: auto;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.identity-avatar__character {
  z-index: 3;
  transform-origin: 50% 78.9%;
  animation: avatar-sway 4.8s ease-in-out infinite;
}

.identity-avatar__character:has(.identity-avatar__mask:hover),
.identity-avatar__character:has(.identity-avatar__mask:focus-visible) {
  animation-play-state: paused;
}

.identity-avatar__person {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(0 0 1rem rgba(209, 163, 95, 0.08));
}

.identity-avatar__wink {
  position: absolute;
  top: var(--wink-top);
  left: var(--wink-left);
  width: var(--wink-width);
  height: var(--wink-height);
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  opacity: 0;
  animation: avatar-wink 5.6s steps(1, end) infinite;
}

.identity-avatar__mask {
  position: absolute;
  z-index: 2;
  top: var(--mask-top);
  left: var(--mask-left);
  width: var(--mask-width);
  height: var(--mask-height);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  appearance: none;
}

.identity-avatar__mask::before {
  position: absolute;
  inset: -0.8rem;
  border: 2px solid transparent;
  content: '';
}

.identity-avatar__mask::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    112deg,
    transparent 48.67%,
    rgba(255, 244, 199, 0.2) 49.33%,
    rgba(255, 250, 224, 0.95) 50%,
    rgba(209, 163, 95, 0.8) 50.67%,
    transparent 51.33%
  );
  background-position: 100% 0;
  background-size: 300% 100%;
  content: '';
  mix-blend-mode: screen;
  pointer-events: none;
  -webkit-mask: var(--mask-image) center / 100% 100% no-repeat;
  mask: var(--mask-image) center / 100% 100% no-repeat;
  animation: mask-reflective-shine 4.6s steps(14, end) infinite;
}

.identity-avatar__mask:focus-visible {
  outline: none;
}

.identity-avatar__mask:focus-visible::before {
  border-color: var(--accent);
}

.identity-avatar__mask-art,
.identity-avatar__mask img,
.identity-avatar__mask i {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.identity-avatar__mask-art :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.identity-avatar__mask i {
  background: var(--mask-image) center / 100% 100% no-repeat;
  opacity: 0;
}

.identity-avatar__mask--dismissing {
  pointer-events: none;
  animation: mask-fizzle 520ms steps(7, end) forwards;
}

.identity-avatar__mask--dismissing::after {
  opacity: 0;
  animation: none;
}

.identity-avatar__mask--dismissing .identity-avatar__mask-art,
.identity-avatar__mask--dismissing img {
  animation: mask-core-fizzle 520ms steps(7, end) forwards;
}

.identity-avatar__mask--dismissing i {
  opacity: 1;
  animation: mask-fragment-fizzle 520ms steps(7, end) forwards;
}

.identity-avatar__mask--dismissing i:nth-of-type(1) {
  --fizzle-x: 0.35rem;
  --fizzle-y: -0.5rem;
}

.identity-avatar__mask--hidden {
  opacity: 0;
}

.identity-avatar__mask--appearing {
  animation: mask-fade-in 420ms ease-out both;
}

.identity-avatar__mask--dismissing i:nth-of-type(2) {
  --fizzle-x: -0.45rem;
  --fizzle-y: -0.1rem;
  animation-delay: 40ms;
}

.identity-avatar__mask--dismissing i:nth-of-type(3) {
  --fizzle-x: 0.5rem;
  --fizzle-y: 0.25rem;
  animation-delay: 80ms;
}

.identity-avatar__mask--dismissing i:nth-of-type(4) {
  --fizzle-x: -0.25rem;
  --fizzle-y: 0.55rem;
  animation-delay: 120ms;
}

.identity-avatar__prompt {
  position: absolute;
  z-index: 4;
  top: calc(var(--mask-top) + var(--mask-height) - 0.75rem);
  left: 50%;
  width: max-content;
  max-width: calc(100% - 0.75rem);
  padding: 0.52rem 0.7rem 0.48rem;
  border-left: 1px solid var(--accent);
  background: linear-gradient(90deg, rgba(8, 8, 8, 0.95), rgba(8, 8, 8, 0.72));
  box-shadow: 0 0.45rem 1rem rgba(0, 0, 0, 0.42);
  color: #b8b3aa;
  font-family: 'Kiona', sans-serif;
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.3;
  text-align: left;
  text-transform: uppercase;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 3rem);
  transition:
    opacity 240ms ease-out,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.identity-avatar__prompt strong,
.identity-avatar__prompt > span {
  display: block;
}

.identity-avatar__prompt strong {
  color: var(--accent);
  font-weight: 400;
}

.identity-avatar__prompt > span {
  margin-top: 0.12rem;
}

.identity-avatar__character:has(.identity-avatar__mask--visible:hover) .identity-avatar__prompt,
.identity-avatar__character:has(.identity-avatar__mask--visible:focus-visible) .identity-avatar__prompt {
  opacity: 1;
  transform: translate(-50%, 0);
}

.identity-avatar small {
  position: absolute;
  z-index: 1;
  right: 1rem;
  bottom: 0.85rem;
  color: #716e67;
  font-size: 0.65rem;
  font-weight: 650;
}

@keyframes avatar-frame {
  0%,
  100% {
    border-color: #3c3a35;
  }

  52% {
    border-color: #5c4b35;
  }
}

@keyframes avatar-beacon {
  0%,
  100% {
    opacity: 0.55;
    box-shadow: 0 0 0.35rem rgba(209, 163, 95, 0.25);
  }

  50% {
    opacity: 1;
    box-shadow: 0 0 1rem rgba(209, 163, 95, 0.58);
  }
}

@keyframes avatar-sway {
  0%,
  100% {
    transform: translate(-50%, -50%) rotate(-1.25deg);
  }

  50% {
    transform: translate(-50%, -50%) rotate(1.25deg);
  }
}

@keyframes avatar-wink {
  0%,
  62%,
  70%,
  100% {
    opacity: 0;
  }

  63%,
  69% {
    opacity: 1;
  }
}

@keyframes mask-fizzle {
  0% {
    filter: none;
  }

  45% {
    filter: contrast(1.6) brightness(1.2);
  }

  100% {
    filter: contrast(2) brightness(1.5);
  }
}

@keyframes mask-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes mask-reflective-shine {
  0%,
  58% {
    background-position: 100% 0;
    opacity: 0;
  }

  62% {
    opacity: 0.9;
  }

  78% {
    opacity: 0.9;
  }

  82%,
  100% {
    background-position: 0 0;
    opacity: 0;
  }
}

@keyframes mask-core-fizzle {
  0%,
  25% {
    clip-path: inset(0);
    opacity: 1;
  }

  50% {
    clip-path: polygon(0 0, 100% 0, 100% 22%, 74% 22%, 74% 50%, 48% 50%, 48% 75%, 20% 75%, 20% 100%, 0 100%);
  }

  100% {
    clip-path: polygon(0 0, 0 0, 0 0);
    opacity: 0;
  }
}

@keyframes mask-fragment-fizzle {
  0% {
    clip-path: inset(35% 35% 35% 35%);
    opacity: 0.85;
    transform: translate(0);
  }

  100% {
    clip-path: inset(42% 42% 42% 42%);
    opacity: 0;
    transform: translate(var(--fizzle-x, 0.2rem), var(--fizzle-y, -0.35rem)) scale(0.55);
  }
}

@media (max-width: 700px), (max-height: 640px) {
  .identity-avatar {
    width: 6.4rem;
    height: 9.6rem;
    box-shadow: inset 0 0 0 0.45rem #090909, inset 0 0 0 calc(0.45rem + 1px) #292824;
  }

  .identity-avatar::after {
    top: 0.65rem;
    right: 0.65rem;
    width: 0.35rem;
  }

  .identity-avatar__frame,
  .identity-avatar__character {
    width: calc(100% - 0.5rem);
  }

  .identity-avatar small {
    right: 0.65rem;
    bottom: 0.55rem;
    font-size: 0.55rem;
  }

  .identity-avatar__prompt {
    max-width: calc(100% - 0.75rem);
    padding: 0.4rem 0.5rem 0.37rem;
    font-size: 0.62rem;
    transform: translate(-50%, 2rem);
  }

  .identity-avatar__character:has(.identity-avatar__mask--visible:hover) .identity-avatar__prompt,
  .identity-avatar__character:has(.identity-avatar__mask--visible:focus-visible) .identity-avatar__prompt {
    transform: translate(-50%, 0);
  }
}

@media (max-width: 350px) {
  .identity-avatar {
    width: 5.5rem;
    height: 8.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .identity-avatar,
  .identity-avatar::after,
  .identity-avatar__character,
  .identity-avatar__wink,
  .identity-avatar__mask,
  .identity-avatar__mask::after,
  .identity-avatar__mask-art,
  .identity-avatar__mask img,
  .identity-avatar__mask i {
    animation: none;
  }

  .identity-avatar__prompt {
    transition: none;
  }

}
</style>
