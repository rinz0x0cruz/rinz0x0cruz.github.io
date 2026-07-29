<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AchievementArtwork from './components/AchievementArtwork.vue'
import AchievementVines from './components/AchievementVines.vue'
import CursorFollower from './components/CursorFollower.vue'
import HireHint from './components/HireHint.vue'
import IdentityAvatar from './components/IdentityAvatar.vue'
import DisciplineBand from './components/DisciplineBand.vue'
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