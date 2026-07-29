<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AchievementArtwork from './components/AchievementArtwork.vue'
import AchievementVines from './components/AchievementVines.vue'
import CursorFollower from './components/CursorFollower.vue'
import HireHint from './components/HireHint.vue'
import IdentityAvatar from './components/IdentityAvatar.vue'
import DisciplineBand from './components/DisciplineBand.vue'
import CompanyMark from './components/CompanyMark.vue'
import StickyNote from './components/StickyNote.vue'
import { glide, impulseFor } from './motion.js'
import profile from './profile.js'

const loadAchievementInstrument = () => import('./components/AchievementInstrument.vue')
const AchievementInstrument = defineAsyncComponent(loadAchievementInstrument)
const achievementEntrancePlaybackRate = 2.4

document.title = `${profile.name} — ${profile.position}`

const quoteOptions = profile.quotes
const achievementInstruments = profile.achievements.map(({ instrument }) => instrument)
const activeQuoteIndex = ref(0)

// Split into words of letters so each character can drop on its own delay while
// words stay unbreakable, keeping narrow layouts wrapping between words.
const activeQuoteWords = computed(() => {
  let index = 0
  return quoteOptions[activeQuoteIndex.value].split(' ').map((word) => (
    [...word].map((character) => ({ character, index: index++ }))
  ))
})
const dossierOpen = ref(false)
const dossierToggle = ref(null)
const experienceRail = ref(null)

// profile lists roles newest first; the rail runs forward through time
const careerOrder = computed(() => [...profile.experience].reverse())

const careerYears = computed(() => {
  const years = careerOrder.value.map((role) => Number(role.start.slice(0, 4)))
  const first = Math.min(...years)
  const last = new Date().getFullYear()
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
})

const careerSpan = computed(() => {
  const first = careerYears.value[0]
  const years = careerYears.value.at(-1) - first
  return years <= 1 ? 'a year' : `${years} years`
})

// The rail carries momentum: a wheel notch or an arrow press is an impulse, and
// friction spends it over the next half second or so. RAIL_FRICTION keeps 88% of
// the speed per frame, so an impulse reaches roughly eight times its value.
const RAIL_FRICTION = 0.88

const railGlide = glide({
  friction: RAIL_FRICTION,
  // a fast repeated wheel should not be able to launch the rail across the page
  max: 70,
  step(vx) {
    const rail = experienceRail.value
    if (!rail) return false

    const before = rail.scrollLeft
    rail.scrollLeft += vx
    // grinding against either end is not motion, so spend the rest of the energy
    return rail.scrollLeft !== before
  },
})

function handleRailKeydown(event) {
  const rail = experienceRail.value
  if (!rail) return

  const ends = { Home: 0, End: rail.scrollWidth }
  const steps = { ArrowLeft: -320, ArrowRight: 320 }
  if (!(event.key in ends) && !(event.key in steps)) return

  // the rail is focusable, so arrows have to drive it or keyboard users are stuck
  event.preventDefault()
  const still = reducedMotionMedia?.matches

  if (event.key in ends) {
    railGlide.stop()
    rail.scrollTo({ left: ends[event.key], behavior: still ? 'auto' : 'smooth' })
    return
  }

  if (still) {
    rail.scrollLeft += steps[event.key]
    return
  }

  // an arrow is the same kind of shove as a wheel notch, so it travels the same way
  railGlide.push(impulseFor(steps[event.key], RAIL_FRICTION))
}

function handleRailWheel(event) {
  // a vertical wheel over the rail should move it sideways, but only while it
  // still has somewhere to go, so the page keeps scrolling at either end
  if (event.deltaX !== 0 || event.shiftKey) return

  const rail = experienceRail.value
  const atStart = rail.scrollLeft <= 0 && event.deltaY < 0
  const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1 && event.deltaY > 0
  if (atStart || atEnd) return

  event.preventDefault()
  if (reducedMotionMedia?.matches) {
    rail.scrollLeft += event.deltaY
    return
  }

  // 0.3 of the notch as an impulse lands near twice the notch as distance, so a
  // flick still covers ground without the rail feeling like it is on ice
  railGlide.push(event.deltaY * 0.3)
}

// how much of the rail has been revealed, so the axis under it can say where you are
const railSeen = ref(0)
const railProgress = computed(() => ({
  width: `${Math.min(1, railSeen.value || 0.001) * 100}%`,
}))

function handleRailScroll(event) {
  const rail = event.currentTarget
  railSeen.value =
    rail.scrollWidth <= rail.clientWidth ? 1 : (rail.scrollLeft + rail.clientWidth) / rail.scrollWidth
}

onMounted(() => {
  if (experienceRail.value) handleRailScroll({ currentTarget: experienceRail.value })
})

// Weight on the vertical axis. Scrolling stays entirely the browser's, and this
// only reads how fast it moved: the cluster falls behind a quick scroll and a
// spring pulls it back, which is the part a scroll-position animation cannot do
// because position mapping has no memory of speed.
const experienceSection = ref(null)
let lagFrame = 0
let lagOffset = 0
let lagSpeed = 0
let lastY = 0
let railVisibleObserver = null

function lagTick() {
  const y = window.scrollY
  const moved = y - lastY
  lastY = y

  // how far behind the cards would like to be, capped so a flung scroll cannot
  // pull them off their own cluster
  const target = Math.max(-30, Math.min(30, -moved * 0.75))
  lagSpeed = (lagSpeed + (target - lagOffset) * 0.22) * 0.74
  lagOffset += lagSpeed

  experienceSection.value?.style.setProperty('--lag', `${lagOffset.toFixed(2)}px`)

  // idle costs nothing: the loop only survives while something is still settling
  if (moved === 0 && Math.abs(lagOffset) < 0.05 && Math.abs(lagSpeed) < 0.05) {
    experienceSection.value?.style.setProperty('--lag', '0px')
    lagFrame = 0
    return
  }
  lagFrame = requestAnimationFrame(lagTick)
}

function startLag() {
  // lastY is deliberately not reset here. A scroll event fires after the page
  // has already moved, so re-reading the position on wake would throw away the
  // very delta this is trying to measure and the spring would never fire.
  if (lagFrame || reducedMotionMedia?.matches) return
  lagFrame = requestAnimationFrame(lagTick)
}

function watchLag() {
  // the loop parks itself once everything has settled, so a scroll has to be
  // what wakes it again; passive, because it never blocks or cancels scrolling
  lastY = window.scrollY
  window.addEventListener('scroll', startLag, { passive: true })
  startLag()
}

function stopLag() {
  window.removeEventListener('scroll', startLag)
  if (lagFrame) cancelAnimationFrame(lagFrame)
  lagFrame = 0
  lagOffset = 0
  lagSpeed = 0
  experienceSection.value?.style.setProperty('--lag', '0px')
}

onMounted(() => {
  if (!experienceSection.value) return

  // the spring only runs while the rail is on screen, so scrolling the rest of
  // the page costs no frames at all
  railVisibleObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) watchLag()
    else stopLag()
  })
  railVisibleObserver.observe(experienceSection.value)
})

onBeforeUnmount(() => {
  railVisibleObserver?.disconnect()
  stopLag()
})

const achievementDeck = ref(null)
const achievementWindow = ref(null)
const achievementActive = ref(false)
const instrumentsUnavailable = ref(false)
const instrumentStatuses = ref([])
const instrumentsVisible = ref(false)
const achievementInView = ref(false)
const landscapeVideo = ref(null)
const siteFooter = ref(null)
const footerGrown = ref(false)
let achievementObserver
let achievementVisibilityObserver
let footerObserver
let achievementIntersecting = false
let quoteRotationTimer
let reducedMotionMedia
let forcedColorsMedia
let landscapeVideoStopping = false
let landscapeVideoArmed = false
let startLandscapeVideo

function stopQuoteRotation() {
  window.clearInterval(quoteRotationTimer)
  quoteRotationTimer = undefined
}

function startQuoteRotation() {
  if (document.hidden || reducedMotionMedia?.matches || quoteRotationTimer) return

  quoteRotationTimer = window.setInterval(() => {
    activeQuoteIndex.value = (activeQuoteIndex.value + 1) % quoteOptions.length
  }, 5000)
}

function syncLandscapeVideo() {
  const video = landscapeVideo.value
  if (!video) return

  if (landscapeVideoStopping || reducedMotionMedia.matches || forcedColorsMedia.matches) {
    video.pause()
  } else if (landscapeVideoArmed) {
    // calling play() before this would start the download regardless of
    // preload="none", putting the loop back in the critical window
    void video.play().catch(() => {})
  }
}

function syncPageState() {
  if (document.hidden || reducedMotionMedia?.matches) stopQuoteRotation()
  else startQuoteRotation()
  achievementInView.value = achievementIntersecting && !document.hidden && !reducedMotionMedia?.matches
  syncLandscapeVideo()
}

function closeDossier() {
  if (!dossierOpen.value) return

  dossierOpen.value = false
  dossierToggle.value?.focus()
}

function toggleDossier() {
  dossierOpen.value = !dossierOpen.value
}

function handleDossierKeydown(event) {
  if (event.key === 'Escape') closeDossier()
}

function artworkVisible(index) {
  return instrumentsUnavailable.value || instrumentStatuses.value[index] === 'failed'
}

function prefersReducedData() {
  return Boolean(navigator.connection?.saveData)
    || window.matchMedia('(prefers-reduced-data: reduce)').matches
}

async function activateAchievementWindow() {
  achievementActive.value = true

  if (prefersReducedData()) {
    instrumentsUnavailable.value = true
    return
  }

  const instrumentModule = loadAchievementInstrument()
  await nextTick()

  const entryAnimations = achievementWindow.value.getAnimations({ subtree: true }).filter((animation) => (
    Number.isFinite(animation.effect.getComputedTiming().endTime)
  ))
  entryAnimations.forEach((animation) => {
    animation.playbackRate = achievementEntrancePlaybackRate
  })
  const [instrumentResult] = await Promise.allSettled([
    instrumentModule,
    ...entryAnimations.map((animation) => animation.finished),
  ])

  if (instrumentResult.status === 'rejected') {
    instrumentsUnavailable.value = true
    return
  }

  instrumentsVisible.value = true
}

// The brush webfont is a 9-glyph subset (U+5C45 591C 5F71 6708 708E 98A8 9B3C
// 9B42 9CE5). Any other kanji silently falls back to a serif face, so these
// pools may only draw from that set.
const singleKanjiOptions = ['影', '鬼', '夜', '鳥', '炎', '風', '魂']
const kanjiOptions = ['鳥居', ...singleKanjiOptions, '炎鳥', '夜風', '鬼影', '炎魂', '風魂', '夜魂', '鳥影']
const kanjiSlots = ['left', 'right', 'bottom']
const activeKanji = ref([
  // delays are a third of the cycle apart, so they must track the duration in
  // .scene__kanji or the three fade together instead of taking turns
  { text: singleKanjiOptions[0], slot: kanjiSlots[0], rotation: '-7deg', delay: '0s' },
  { text: singleKanjiOptions[1], slot: kanjiSlots[1], rotation: '5deg', delay: '-3s' },
  { text: kanjiOptions[0], slot: kanjiSlots[2], rotation: '-2deg', delay: '-6s' },
])

function randomizeKanji(index) {
  const current = activeKanji.value[index]
  const slotOptions = current.slot === 'bottom' ? kanjiOptions : singleKanjiOptions
  const candidates = slotOptions.filter((option) => (
    option !== current.text && !activeKanji.value.some((kanji, activeIndex) => activeIndex !== index && kanji.text === option)
  ))

  activeKanji.value[index] = {
    text: candidates[Math.floor(Math.random() * candidates.length)],
    slot: current.slot,
    rotation: `${-10 + Math.random() * 20}deg`,
    delay: current.delay,
  }
}

activeKanji.value.forEach((_, index) => randomizeKanji(index))

onMounted(() => {
  landscapeVideoStopping = false
  landscapeVideoArmed = false
  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  forcedColorsMedia = window.matchMedia('(forced-colors: active)')
  document.addEventListener('visibilitychange', syncPageState)
  reducedMotionMedia.addEventListener('change', syncPageState)
  forcedColorsMedia.addEventListener('change', syncLandscapeVideo)
  achievementObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return

    void activateAchievementWindow()
    achievementObserver.disconnect()
  }, { rootMargin: '400px' })
  achievementObserver.observe(achievementDeck.value)
  achievementVisibilityObserver = new IntersectionObserver(([entry]) => {
    achievementIntersecting = entry.isIntersecting
    syncPageState()
  }, { threshold: 0.01 })
  achievementVisibilityObserver.observe(achievementWindow.value)
  // The footer vines only read as growth if they start when the footer is
  // reached, so they wait rather than running out of sight during the scroll.
  footerObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return

    footerGrown.value = true
    footerObserver.disconnect()
  }, { rootMargin: '80px' })
  footerObserver.observe(siteFooter.value)
  syncPageState()

  // The loop is decoration. preload="none" keeps its 633 kB out of the critical
  // window; start it once the poster and avatar have landed so it never competes.
  startLandscapeVideo = () => {
    if (landscapeVideoStopping) return
    landscapeVideoArmed = true
    landscapeVideo.value?.load()
    syncLandscapeVideo()
  }
  if (document.readyState === 'complete') startLandscapeVideo()
  else window.addEventListener('load', startLandscapeVideo, { once: true })
})

onBeforeUnmount(() => {
  landscapeVideoStopping = true
  railGlide.stop()
  document.removeEventListener('visibilitychange', syncPageState)
  if (startLandscapeVideo) window.removeEventListener('load', startLandscapeVideo)
  reducedMotionMedia?.removeEventListener('change', syncPageState)
  forcedColorsMedia?.removeEventListener('change', syncLandscapeVideo)
  achievementObserver?.disconnect()
  achievementVisibilityObserver?.disconnect()
  footerObserver?.disconnect()
  stopQuoteRotation()
  landscapeVideo.value?.pause()
})
</script>

<template>
  <CursorFollower />

  <main class="portfolio" aria-label="Portfolio">
    <section class="scene" aria-labelledby="portfolio-name">
      <svg class="scene__texture" aria-hidden="true">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="5" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

    <div class="scene__window" aria-hidden="true">
      <div class="scene__media">
        <span class="scene__landscape"></span>
        <video
          ref="landscapeVideo"
          class="scene__landscape-video"
          muted
          loop
          playsinline
          preload="none"
          poster="/background-study-wide-still.webp"
          tabindex="-1"
          disablepictureinpicture
          disableremoteplayback
          @canplay="syncLandscapeVideo"
          @pause="syncLandscapeVideo"
        >
          <source src="/background-study-loop-wide.mp4" type="video/mp4" media="(min-width: 701px)" />
          <source src="/background-study-loop-hd.mp4" type="video/mp4" />
        </video>
      </div>

    </div>

    <div class="scene__kanji-layer" aria-hidden="true">
      <span
        v-for="(kanji, index) in activeKanji"
        :key="kanji.slot"
        :class="['scene__kanji', `scene__kanji--${kanji.slot}`]"
        :style="{
          '--kanji-rotation': kanji.rotation,
          '--kanji-delay': kanji.delay,
        }"
        @animationiteration="randomizeKanji(index)"
      >{{ kanji.text }}</span>
    </div>

    <div
      :class="['scene__content', { 'scene__content--dossier-open': dossierOpen }]"
      @keydown="handleDossierKeydown"
    >
      <div class="credential-card">
        <div class="identity-card credential-card__front">
          <p class="availability" :data-open="profile.availability.open">
            <span class="availability__switch" aria-hidden="true"></span>
            <span>{{ profile.availability.open ? profile.availability.openLabel : profile.availability.employedLabel }}</span>
          </p>

          <IdentityAvatar />

          <div class="identity-card__copy">
            <p class="identity-card__eyebrow">
              <svg class="identity-card__sigil" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M6 2H2v4m10-4h4v4m0 6v4h-4m-6 0H2v-4" />
                <path class="identity-card__sigil-core" d="m9 5.75 3.25 3.25L9 12.25 5.75 9Z" />
              </svg>
              {{ profile.eyebrow }}
            </p>
            <h1 id="portfolio-name">{{ profile.name }}</h1>
            <p class="identity-card__role">
              {{ profile.position }}
              <span v-if="profile.company" class="identity-card__separator" aria-hidden="true">·</span>
              <span v-if="profile.company" class="identity-card__company">
                <span v-if="profile.company.mark" class="company-mark" aria-hidden="true">
                  <i
                    v-for="color in profile.company.mark"
                    :key="color"
                    :style="{ backgroundColor: color }"
                  ></i>
                </span>
                {{ profile.company.name }}
              </span>
            </p>
            <DisciplineBand />
          </div>

          <p class="identity-card__statement">
            <span class="identity-card__quote-measure" aria-hidden="true">
              <q v-for="quote in quoteOptions" :key="quote">{{ quote }}</q>
            </span>
            <Transition name="quote-page" mode="out-in" :duration="{ enter: 900, leave: 520 }">
              <q :key="activeQuoteIndex" class="identity-card__quote">
                <template v-for="(word, wordIndex) in activeQuoteWords" :key="wordIndex"><span class="identity-card__quote-word"><span
                  v-for="letter in word"
                  :key="letter.index"
                  class="identity-card__quote-letter"
                  :style="{ '--letter': letter.index }"
                >{{ letter.character }}</span></span>{{ ' ' }}</template>
              </q>
            </Transition>
            <Transition name="quote-page" mode="out-in" :duration="{ enter: 900, leave: 520 }">
              <span
                :key="activeQuoteIndex"
                class="identity-card__quote-shine"
                aria-hidden="true"
              ><template v-for="(word, wordIndex) in activeQuoteWords" :key="wordIndex"><span class="identity-card__quote-word"><span
                  v-for="letter in word"
                  :key="letter.index"
                  class="identity-card__quote-letter"
                  :style="{ '--letter': letter.index }"
                >{{ letter.character }}</span></span>{{ ' ' }}</template></span>
            </Transition>
          </p>
        </div>

        <button
          ref="dossierToggle"
          class="credential-card__turn"
          type="button"
          aria-controls="profile-dossier"
          :aria-expanded="dossierOpen"
          :aria-label="dossierOpen ? 'Press back: close profile dossier' : 'Press start: open profile dossier'"
          @click="toggleDossier"
        >
          <span>{{ dossierOpen ? 'Press back' : 'Press start' }}</span>
        </button>

        <HireHint v-if="!dossierOpen" />

        <section
          id="profile-dossier"
          class="credential-card__drawer"
          aria-label="Profile dossier"
          :aria-hidden="!dossierOpen"
          :inert="!dossierOpen"
        >
          <nav
            class="credential-card__records"
            aria-label="Profile records"
          >
            <ol>
              <li
                v-for="(link, index) in profile.links"
                :key="link.label"
              >
                <a
                  :href="link.href"
                  :target="link.external ? '_blank' : undefined"
                  :rel="link.external ? 'noreferrer' : undefined"
                  :tabindex="dossierOpen ? 0 : -1"
                >
                  <small>{{ String(index + 1).padStart(2, '0') }}</small>
                  <span>
                    <strong>{{ link.label }}</strong>
                    <em>{{ link.detail }}</em>
                  </span>
                  <b aria-hidden="true">↗</b>
                </a>
              </li>
            </ol>
          </nav>
        </section>
      </div>
    </div>
    </section>

    <section ref="achievementDeck" class="achievement-deck" aria-labelledby="achievement-deck-title">
      <div class="achievement-deck__inner">
        <header class="achievement-deck__header">
          <div>
            <p>Proof / {{ String(profile.achievements.length).padStart(2, '0') }}</p>
            <h2 id="achievement-deck-title">Selected outcomes</h2>
          </div>
          <p>Research · controls · detection · response</p>
        </header>

        <div
          ref="achievementWindow"
          :class="[
            'achievement-window',
            {
              'achievement-window--active': achievementActive,
              'achievement-window--ambient': achievementInView,
            },
          ]"
        >
          <span class="achievement-window__frame" aria-hidden="true"></span>
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

          <AchievementVines />

          <component
            :is="instrumentsVisible ? AchievementInstrument : 'div'"
            class="achievement-grid"
            v-bind="instrumentsVisible ? { instruments: achievementInstruments } : {}"
            @resolve="instrumentStatuses = $event"
          >
            <article
              v-for="(achievement, index) in profile.achievements"
              :key="achievement.title"
              class="achievement-card"
              :style="{ '--tile-accent': achievement.accent }"
            >
              <span class="achievement-card__effects" aria-hidden="true">
                <i class="achievement-card__foil"></i>
                <i class="achievement-card__edge"></i>
              </span>

              <span class="achievement-card__vines" aria-hidden="true">
              <svg class="achievement-card__vine achievement-card__vine--crown" viewBox="0 0 92 54" preserveAspectRatio="xMidYMid meet">
                <path class="achievement-card__vine-shadow" pathLength="1" d="M3 48C22 43 20 28 39 29c18 1 19-15 36-13 7 1 10-3 14-10" />
                <path class="achievement-card__vine-stem" pathLength="1" d="M3 48C22 43 20 28 39 29c18 1 19-15 36-13 7 1 10-3 14-10" />
                <path class="achievement-card__vine-tendril" pathLength="1" d="M39 29c-3 12 10 12 7 20-3 7-13 3-10-3M75 16c3 8 12 7 11 15" />
                <g class="achievement-card__vine-leaves">
                  <path style="--sprout-delay: 260ms" d="m20 37 10-5-2 9-7 5-5-2Z" />
                  <path style="--sprout-delay: 350ms" d="m42 24 5-9 5 8-2 8-5 1Z" />
                  <path style="--sprout-delay: 440ms" d="m66 14 9-6-1 9-6 5-5-2Z" />
                </g>
              </svg>
              <svg class="achievement-card__vine achievement-card__vine--climb" viewBox="0 0 48 116" preserveAspectRatio="xMidYMid meet">
                <path class="achievement-card__vine-shadow" pathLength="1" d="M8 113c17-17-2-31 13-47 15-16-2-29 12-43 7-7 7-14 3-20" />
                <path class="achievement-card__vine-stem" pathLength="1" d="M8 113c17-17-2-31 13-47 15-16-2-29 12-43 7-7 7-14 3-20" />
                <path class="achievement-card__vine-tendril" pathLength="1" d="M20 67c14 1 17-10 11-16-5-5-11 2-7 6" />
                <g class="achievement-card__vine-leaves">
                  <path style="--sprout-delay: 330ms" d="m13 89 9-5-1 9-6 5-5-2Z" />
                  <path style="--sprout-delay: 430ms" d="m25 48 5-9 5 8-2 8-5 1Z" />
                </g>
              </svg>
              </span>

              <header class="achievement-card__topline">
                <strong aria-hidden="true">{{ achievement.glyph }}</strong>
                <small>{{ String(index + 1).padStart(2, '0') }}</small>
              </header>

              <div
                class="achievement-card__visual"
                :data-instrument-index="index"
                data-model-state="loading"
                aria-hidden="true"
              >
                <AchievementArtwork v-if="artworkVisible(index)" :motif="achievement.motif" />
              </div>

              <div class="achievement-card__copy">
                <b>{{ achievement.metric }}</b>
                <h3>{{ achievement.title }}</h3>
                <small>{{ achievement.detail }}</small>
              </div>
            </article>
          </component>
        </div>
      </div>
    </section>

    <section ref="experienceSection" class="experience" aria-labelledby="experience-title">
      <div class="experience__head">
        <div>
          <p>Career / {{ String(profile.experience.length).padStart(2, '0') }}</p>
          <h2 id="experience-title">Where I've worked</h2>
        </div>
        <p class="experience__hint">
          <span aria-hidden="true">←</span>
          Scroll sideways through {{ careerSpan }}
          <span aria-hidden="true">→</span>
        </p>
      </div>

      <!-- one horizontal rail: the axis is time, oldest role on the left -->
      <div
        ref="experienceRail"
        class="experience__rail"
        tabindex="0"
        role="group"
        aria-label="Career timeline, scrollable sideways"
        @keydown="handleRailKeydown"
        @wheel="handleRailWheel"
        @scroll="handleRailScroll"
      >
        <figure class="experience__frontispiece">
          <span class="photo-frame">
            <img
              src="/ms-portrait.webp"
              :alt="`Portrait of ${profile.name}`"
              :style="{ '--photo-position': '50% 32%' }"
              width="525"
              height="1000"
              decoding="async"
            />
          </span>
          <figcaption>
            <span class="experience__plate">00</span>
            {{ profile.name }}
          </figcaption>
        </figure>

        <ol class="experience__chapters">
          <li
            v-for="(role, index) in careerOrder"
            :key="`${role.company}-${role.start}`"
            class="chapter"
            :style="{ '--chapter-index': index }"
          >
            <article class="chapter__marquee">
              <CompanyMark :mark="role.mark" />
              <p class="chapter__period">
                <span class="chapter__dates">{{ role.period }}</span>
                <span class="chapter__index">{{ String(index + 1).padStart(2, '0') }}</span>
              </p>
              <h3 class="chapter__company">{{ role.company }}</h3>
              <p class="chapter__role">
                {{ role.role }}
                <span aria-hidden="true">·</span>
                <em>{{ role.kind }}</em>
              </p>
              <p class="chapter__team">{{ role.team }}</p>
              <p class="chapter__place">{{ role.place }}</p>
            </article>

            <article class="chapter__notable">
              <h4>Notable work</h4>
              <ul>
                <li
                  v-for="(item, chip) in role.notable"
                  :key="item"
                  :style="{ '--i': chip }"
                >
                  {{ item }}
                </li>
              </ul>
            </article>

            <article class="chapter__outcome">
              <p>{{ role.outcome }}</p>
            </article>

            <article v-if="role.learnt" class="chapter__learnt">
              <h4>Learnt</h4>
              <p>{{ role.learnt }}</p>
            </article>

            <figure v-if="role.photo" class="chapter__photo">
              <span class="photo-frame">
                <img
                  :src="role.photo.src"
                  :alt="role.photo.alt"
                  :style="{ '--photo-position': role.photo.position }"
                  :width="role.photo.w"
                  :height="role.photo.h"
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <figcaption>{{ role.photo.caption }}</figcaption>
            </figure>

            <figure v-if="role.scene" class="chapter__scene">
              <span class="photo-frame">
                <img
                  :src="role.scene.src"
                  :alt="role.scene.alt"
                  :style="{ '--photo-position': role.scene.position }"
                  :width="role.scene.w"
                  :height="role.scene.h"
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <figcaption>{{ role.scene.caption }}</figcaption>
            </figure>
          </li>
        </ol>

        <StickyNote :front="profile.note.front" :back="profile.note.back" />
      </div>

      <p class="experience__axis" aria-hidden="true">
        <span>{{ careerYears[0] }}</span>
        <span class="experience__axis-track">
          <span class="experience__axis-thumb" :style="railProgress" />
        </span>
        <span>Now</span>
      </p>
    </section>
  </main>

  <footer
    ref="siteFooter"
    class="site-footer"
    :class="{ 'site-footer--grown': footerGrown }"
  >
    <AchievementVines />

    <p class="font-credit">
      Danviska by <a href="https://pixesia.com/danviska/" rel="author external">Pixesia&nbsp;Studio</a>
      <span aria-hidden="true">·</span>
      Webfont via <a href="https://www.onlinewebfonts.com" rel="external">OnlineWebFonts</a>
      <span aria-hidden="true">·</span>
      Mackie&nbsp;Pixel by rinzler
      <span aria-hidden="true">·</span>
      <a href="https://fonts.google.com/specimen/Pixelify+Sans" rel="external">Pixelify&nbsp;Sans</a> under the SIL&nbsp;Open&nbsp;Font&nbsp;License
    </p>
  </footer>
</template>