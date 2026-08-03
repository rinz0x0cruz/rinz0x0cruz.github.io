<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AchievementArtwork from './components/AchievementArtwork.vue'
import AchievementVines from './components/AchievementVines.vue'
import CursorFollower from './components/CursorFollower.vue'
import HireHint from './components/HireHint.vue'
import IdentityAvatar from './components/IdentityAvatar.vue'
import DisciplineBand from './components/DisciplineBand.vue'
import CompanyMark from './components/CompanyMark.vue'
import GoldFiligree from './components/GoldFiligree.vue'
import StickyNote from './components/StickyNote.vue'
import { glide, impulseFor } from './motion.js'
import profile from './profile.js'

const loadAchievementInstrument = () => import('./components/AchievementInstrument.vue')
const AchievementInstrument = defineAsyncComponent(loadAchievementInstrument)
const achievementEntrancePlaybackRate = 2.4

document.title = `${profile.name} — ${profile.position}`

const quoteOptions = profile.quotes
const disciplineColumns = Math.min(profile.disciplines.length, 4)
const disciplineRows = Math.ceil(profile.disciplines.length / disciplineColumns)
const identityCardMinHeight = `${21 + (disciplineRows - 1) * 6}rem`
const profileLinkColumns = profile.links.length <= 5
  ? profile.links.length
  : Math.ceil(profile.links.length / 2)
const profileLinkRows = Math.ceil(profile.links.length / profileLinkColumns)
const profileLinkMobileRows = Math.ceil(profile.links.length / 3)
const profileDrawerHeight = `${profileLinkRows * 4.75 + 0.5}rem`
const profileDrawerMobileHeight = `${profileLinkMobileRows * 4.75 + 0.5}rem`
const profileDrawerSpace = `${profileLinkRows * 4.75 + 2.75}rem`
const profileDrawerMobileSpace = `${profileLinkMobileRows * 4.75 + 2}rem`
const profileLinksScrollable = profile.links.length > 5
const languageSwitchScrollable = profile.languages.length > 4
const achievementInstruments = profile.achievements.map(({ instrument }) => instrument ?? null)
const achievementColumns = Math.min(profile.achievements.length, 5)
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

// Three cards borrow a photograph of a place. Attribution lives here rather
// than under each picture, where it crowded the caption off the card.
const photoCredits = computed(() =>
  profile.experience.filter((role) => role.photo?.credit).map((role) => role.photo.credit),
)

const activeLanguage = ref(profile.languages[0].id)
const activeCertification = ref(profile.certifications[0].id)
const pageVisible = ref(!document.hidden)
const activeLanguageRecord = computed(() =>
  profile.languages.find(({ id }) => id === activeLanguage.value) ?? profile.languages[0],
)
const activeCertificationRecord = computed(() =>
  profile.certifications.find(({ id }) => id === activeCertification.value) ?? profile.certifications[0],
)
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const activeLanguageLetters = computed(() =>
  [...graphemeSegmenter.segment(activeLanguageRecord.value.native)].map(({ segment }) => segment),
)

// counted from the earliest role rather than written down, so the hint and the
// axis label cannot drift apart or go stale as roles are added
const careerYears = computed(() => {
  const years = profile.experience.map((role) => Number(role.start.slice(0, 4)))
  const first = Math.min(...years)
  const last = new Date().getFullYear()
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
})

// Counted in months from the earliest role, not in calendar years: subtracting
// year numbers would have added a year every New Year's Day rather than on the
// anniversary, overstating the span for eleven months of each year.
const careerSpan = computed(() => {
  const earliest = profile.experience.map((role) => role.start).sort()[0]
  const [year, month] = earliest.split('-').map(Number)
  const now = new Date()
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month)
  const years = Math.floor(months / 12)
  return years <= 1 ? 'a year' : `${years} years`
})

// The rail has weight. A wheel notch is a shove against something heavy, not a
// velocity: RAIL_PICKUP takes it up over roughly eight frames so the rail
// resists, gathers speed, and then runs on. RAIL_DRAG keeps 94% of that speed
// per frame, which is a long enough tail that it thins out rather than stopping.
const RAIL_PICKUP = 0.13
const RAIL_DRAG = 0.94

const railGlide = glide({
  pickup: RAIL_PICKUP,
  drag: RAIL_DRAG,
  // a fast repeated wheel should not be able to launch the rail across the page
  max: 70,
  step(dx) {
    const rail = experienceRail.value
    if (!rail) return false

    const before = rail.scrollLeft
    rail.scrollLeft += dx
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
  railGlide.push(impulseFor(steps[event.key], RAIL_DRAG))
}

// Wheel deltas are not always pixels. Firefox reports lines, so one notch
// arrives as about 3 instead of about 100, and a rail tuned in pixels would be
// almost immovable there. Page mode is rarer but scales by the viewport.
const WHEEL_LINE = 40

function wheelPixels(deltaMode, amount, pageSize) {
  if (deltaMode === 1) return amount * WHEEL_LINE
  if (deltaMode === 2) return amount * pageSize
  return amount
}

function stepRail(direction) {
  const rail = experienceRail.value
  if (!rail) return

  railGlide.stop()
  rail.scrollBy({
    left: direction * Math.round(rail.clientWidth * 0.8),
    behavior: reducedMotionMedia?.matches ? 'auto' : 'smooth',
  })
}

// Drag the rail like a filmstrip. Buttons and arrows already cover the same
// ground, so this never becomes the only way through (WCAG 2.5.7).
const railDragging = ref(false)
let dragFrom = 0
let dragScroll = 0
let dragPointer = null
let dragMoved = 0
let dragStep = 0
let dragAt = 0

function onRailPointerDown(event) {
  if (event.button !== 0 || event.target.closest('.sticky-note, button, a')) return

  railGlide.stop()
  dragPointer = event.pointerId
  dragFrom = event.clientX
  dragScroll = experienceRail.value.scrollLeft
  dragMoved = 0
  dragStep = 0
  dragAt = event.timeStamp
}

function onRailPointerMove(event) {
  if (dragPointer === null || event.pointerId !== dragPointer) return

  const travelled = event.clientX - dragFrom
  dragMoved = Math.abs(travelled)
  if (!railDragging.value) {
    if (dragMoved <= 6) return
    railDragging.value = true
    event.currentTarget.setPointerCapture(dragPointer)
  }

  const rail = experienceRail.value
  const before = rail.scrollLeft
  rail.scrollLeft = dragScroll - travelled
  // per frame, so a high-polling pointer does not report a weaker throw
  const frames = Math.min(4, Math.max(0.25, (event.timeStamp - dragAt) / 16.7))
  dragStep = (rail.scrollLeft - before) / frames
  dragAt = event.timeStamp
}

function onRailPointerUp(event) {
  if (dragPointer === null || event.pointerId !== dragPointer) return

  const flung = railDragging.value
  if (flung) event.currentTarget.releasePointerCapture?.(dragPointer)
  railDragging.value = false
  dragPointer = null

  if (!flung || reducedMotionMedia?.matches) return
  if (Math.abs(dragStep) > 1) railGlide.fling(dragStep)
}

function handleRailWheel(event) {
  // Sideways input always belongs to the rail. A vertical wheel is taken only
  // once the page has come to rest under the pointer: while it is still
  // travelling the reader is passing through, and turning that into sideways
  // travel is what used to put 15 notches of timeline in their way.
  const sideways = event.deltaX !== 0 || event.shiftKey
  if (!sideways && pageGlide.moving) return

  const rail = experienceRail.value
  const amount = event.deltaX !== 0 ? event.deltaX : event.deltaY
  const atStart = rail.scrollLeft <= 0 && amount < 0
  const atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1 && amount > 0
  // spent in this direction, so the wheel goes back to the page
  if (atStart || atEnd) return

  event.preventDefault()
  const pixels = wheelPixels(event.deltaMode, amount, rail.clientWidth)
  if (reducedMotionMedia?.matches) {
    rail.scrollLeft += pixels
    return
  }

  railGlide.push(pixels * 0.16)
}

// The page moved 100px in a single frame per notch, and everything keyed to
// scrolling was being handed that step whole, which is what made the cards jump.
// It now carries the same weight as the rail. Only the wheel is intercepted:
// keyboard, scrollbar, anchors, find-in-page and touch stay entirely native.
let pageCarry = 0

const pageGlide = glide({
  pickup: 0.16,
  drag: 0.91,
  max: 90,
  step(dy) {
    const total = dy + pageCarry
    const whole = Math.trunc(total)
    pageCarry = total - whole
    if (whole === 0) return true

    const before = window.scrollY
    window.scrollBy(0, whole)
    return window.scrollY !== before
  },
})

function handlePageWheel(event) {
  // the rail consumed it, or it is a pinch-zoom, or a sideways trackpad gesture
  if (event.defaultPrevented || event.ctrlKey || event.deltaX !== 0) return
  if (reducedMotionMedia?.matches) return

  const limit = document.documentElement.scrollHeight - window.innerHeight
  const atTop = window.scrollY <= 0 && event.deltaY < 0
  const atEnd = window.scrollY >= limit - 1 && event.deltaY > 0
  if (atTop || atEnd) return

  event.preventDefault()
  pageGlide.push(wheelPixels(event.deltaMode, event.deltaY, window.innerHeight) * 0.13)
}

// how much of the rail has been revealed, so the axis under it can say where you are
const railSeen = ref(0)
// which cards are showing their evidence side
const turned = ref({})
// per-card pointer tilt, so a card reads as an object rather than a picture
const tilt = ref({})

function turn(id) {
  turned.value[id] = !turned.value[id]
}

// which stamp is being held, how the album is arranged, and the loose lean each
// stamp takes when the collection is tipped out rather than laid in rows
const focused = ref(null)
const albumSort = ref('field')
const albumScatter = ref(false)
const scatter = ref({})

const focusedProject = computed(() =>
  profile.projects.find((project) => project.id === focused.value) ?? null,
)

const arrangedProjects = computed(() => {
  if (albumScatter.value) return scatter.value.order ?? profile.projects
  const key = albumSort.value
  return [...profile.projects].sort((a, b) => a[key].localeCompare(b[key]))
})

function holdStamp(id) {
  focused.value = focused.value === id ? null : id
}

function shuffleAlbum() {
  const order = [...profile.projects]
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const next = { order }
  for (const project of order) next[project.id] = (Math.random() * 8 - 4).toFixed(2)
  scatter.value = next
  albumScatter.value = true
}

// where a pointer sits on a surface, and which way that surface should lean
// away from it; shared by the career cards and the stamps
function leanFrom(event, maxDeg) {
  const box = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  const y = (event.clientY - box.top) / box.height
  const dx = x * 2 - 1
  const dy = y * 2 - 1
  return {
    // the lean axis is perpendicular to where the pointer sits
    ax: -dy,
    ay: dx,
    deg: Math.min(1, Math.hypot(dx, dy)) * maxDeg,
    px: `${x * 100}%`,
    py: `${y * 100}%`,
  }
}

function tiltCard(event, id) {
  // touch drives the rail's own drag, and a tilt there would fight the scroll
  if (event.pointerType !== 'mouse') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  tilt.value[id] = leanFrom(event, 7)
}

function restCard(id) {
  tilt.value[id] = null
}

// a stamp is small and being picked up, so it leans further than a card does
const stampTilt = ref({})

function tiltStamp(event, id) {
  if (event.pointerType !== 'mouse') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  stampTilt.value = { ...stampTilt.value, [id]: leanFrom(event, 13) }
}

function restStamp(id) {
  stampTilt.value = { ...stampTilt.value, [id]: null }
}

const certificationTilt = ref({})

function tiltCertification(event, id) {
  if (event.pointerType !== 'mouse') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

  certificationTilt.value = { ...certificationTilt.value, [id]: leanFrom(event, 11) }
}

function restCertification(id) {
  certificationTilt.value = { ...certificationTilt.value, [id]: null }
}

// railSeen counts revealed width, which is never 0 at the start; the controls
// need the actual ends instead
const railAtStart = ref(true)
const railAtEnd = ref(false)
const railProgress = computed(() => ({
  width: `${Math.min(1, railSeen.value || 0.001) * 100}%`,
}))

function handleRailScroll(event) {
  const rail = event.currentTarget
  railSeen.value =
    rail.scrollWidth <= rail.clientWidth ? 1 : (rail.scrollLeft + rail.clientWidth) / rail.scrollWidth
  railAtStart.value = rail.scrollLeft <= 1
  railAtEnd.value = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1
}

onMounted(() => {
  if (experienceRail.value) handleRailScroll({ currentTarget: experienceRail.value })
  // non-passive because it has to be able to take the wheel over
  window.addEventListener('wheel', handlePageWheel, { passive: false })
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
let lagAt = 0
let railVisibleObserver = null

function lagTick(now) {
  // Per 60fps frame, like the rail's own integrator. Fixed per-frame constants
  // would make this stiffer on a 120Hz display and slacker on a slow one, and a
  // motion model that changes with the refresh rate is not a model.
  const frames = lagAt ? Math.min(4, Math.max(0.2, (now - lagAt) / 16.667)) : 1
  lagAt = now

  const y = window.scrollY
  const moved = (y - lastY) / frames
  lastY = y

  // how far behind the cards would like to be, capped so a flung scroll cannot
  // pull them off their own cluster
  const target = Math.max(-30, Math.min(30, -moved * 0.75))
  lagSpeed += (target - lagOffset) * (1 - Math.pow(1 - 0.22, frames))
  lagSpeed *= Math.pow(0.74, frames)
  lagOffset += lagSpeed * frames

  experienceSection.value?.style.setProperty('--lag', `${lagOffset.toFixed(2)}px`)

  // idle costs nothing: the loop only survives while something is still settling
  if (moved === 0 && Math.abs(lagOffset) < 0.05 && Math.abs(lagSpeed) < 0.05) {
    experienceSection.value?.style.setProperty('--lag', '0px')
    lagFrame = 0
    lagAt = 0
    return
  }
  lagFrame = requestAnimationFrame(lagTick)
}

function startLag() {
  // lastY is deliberately not reset here. A scroll event fires after the page
  // has already moved, so re-reading the position on wake would throw away the
  // very delta this is trying to measure and the spring would never fire.
  if (lagFrame || reducedMotionMedia?.matches) return
  lagAt = 0
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
  lagAt = 0
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
  pageVisible.value = !document.hidden
  if (document.hidden || reducedMotionMedia?.matches) stopQuoteRotation()
  else startQuoteRotation()
  achievementInView.value = achievementIntersecting && !document.hidden && !reducedMotionMedia?.matches
  syncLandscapeVideo()
}

function handleReducedMotionChange() {
  syncPageState()
  if (!reducedMotionMedia.matches) startLandscapeVideo?.()
}

function handleForcedColorsChange() {
  if (forcedColorsMedia.matches) syncLandscapeVideo()
  else startLandscapeVideo?.()
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
  return !profile.achievements[index].instrument
    || instrumentsUnavailable.value
    || instrumentStatuses.value[index] === 'failed'
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
  reducedMotionMedia.addEventListener('change', handleReducedMotionChange)
  forcedColorsMedia.addEventListener('change', handleForcedColorsChange)
  achievementObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return

    void activateAchievementWindow()
    achievementObserver.disconnect()
  }, { rootMargin: '0px' })
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

  // The loop is decoration. preload="none" keeps its video payload out of the critical
  // window; start it once the poster and avatar have landed so it never competes.
  startLandscapeVideo = () => {
    if (
      landscapeVideoStopping
      || prefersReducedData()
      || reducedMotionMedia.matches
      || forcedColorsMedia.matches
    ) return
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
  pageGlide.stop()
  window.removeEventListener('wheel', handlePageWheel)
  document.removeEventListener('visibilitychange', syncPageState)
  if (startLandscapeVideo) window.removeEventListener('load', startLandscapeVideo)
  reducedMotionMedia?.removeEventListener('change', handleReducedMotionChange)
  forcedColorsMedia?.removeEventListener('change', handleForcedColorsChange)
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
    <section
      class="scene"
      aria-labelledby="portfolio-name"
      :style="{
        '--discipline-rows': disciplineRows,
        '--identity-card-min-height': identityCardMinHeight,
        '--profile-drawer-height': profileDrawerHeight,
        '--profile-drawer-mobile-height': profileDrawerMobileHeight,
        '--profile-drawer-space': profileDrawerSpace,
        '--profile-drawer-mobile-space': profileDrawerMobileSpace,
      }"
    >
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
            <DisciplineBand :disciplines="profile.disciplines" />
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
          :aria-label="dossierOpen ? 'Close profile links' : 'Open profile links'"
          @click="toggleDossier"
        >
          <span>{{ dossierOpen ? 'Close links' : 'Open links' }}</span>
        </button>

        <HireHint v-if="!dossierOpen" />

        <section
          id="profile-dossier"
          :class="['credential-card__drawer', { 'credential-card__drawer--scrolling': profileLinksScrollable }]"
          :style="{
            '--profile-link-count': profile.links.length,
            '--profile-link-columns': profileLinkColumns,
            '--profile-link-rows': profileLinkRows,
            '--profile-link-mobile-rows': profileLinkMobileRows,
          }"
          aria-label="Profile links panel"
          :aria-hidden="!dossierOpen"
          :inert="!dossierOpen"
        >
          <nav
            class="credential-card__records"
            aria-label="Profile links"
          >
            <ol>
              <li
                v-for="(link, index) in profile.links"
                :key="link.id"
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
            <p>Evidence / {{ String(profile.achievements.length).padStart(2, '0') }}</p>
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
          <GoldFiligree />

          <AchievementVines />

          <component
            :is="instrumentsVisible ? AchievementInstrument : 'div'"
            class="achievement-grid"
            :style="{ '--achievement-columns': achievementColumns }"
            v-bind="instrumentsVisible ? { instruments: achievementInstruments } : {}"
            @resolve="instrumentStatuses = $event"
          >
            <article
              v-for="(achievement, index) in profile.achievements"
              :key="achievement.id"
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
                <AchievementArtwork v-if="artworkVisible(index)" :motif="achievement.motif ?? 'orbit'" />
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
          <p>Experience / {{ String(profile.experience.length).padStart(2, '0') }}</p>
          <h2 id="experience-title">Where I've worked</h2>
        </div>
        <p class="experience__hint">
          Scroll, drag, or use arrow keys to explore {{ careerSpan }}
        </p>
      </div>

      <!-- one horizontal rail: the axis is time, current role on the left -->
      <div class="experience__window">
        <div class="experience__stars" aria-hidden="true"></div>
        <div
          ref="experienceRail"
          class="experience__rail"
          :class="{ 'experience__rail--free': railDragging }"
          tabindex="0"
          role="group"
          aria-label="Work history, scrollable horizontally"
          @keydown="handleRailKeydown"
          @wheel="handleRailWheel"
          @scroll="handleRailScroll"
          @pointerdown="onRailPointerDown"
          @pointermove="onRailPointerMove"
          @pointerup="onRailPointerUp"
          @pointercancel="onRailPointerUp"
        >
        <div class="experience__index">
          <figure class="experience__frontispiece">
            <span
              class="experience__plate-mount"
              :style="{
                '--photo-position': profile.portrait.position,
                '--frame-ratio': `${profile.portrait.w} / ${profile.portrait.h}`,
              }"
            >
              <span class="photo-frame">
                <img
                  :src="profile.portrait.src"
                  :alt="profile.portrait.alt"
                  :width="profile.portrait.w"
                  :height="profile.portrait.h"
                  decoding="async"
                />
                <span class="plate-credit">
                  Drawn by
                  <span class="plate-credit__name"><span
                    v-for="(letter, index) in profile.portrait.artist"
                    :key="index"
                    class="plate-credit__letter"
                    :style="{ '--letter': index }"
                  >{{ letter }}</span></span>
                </span>
              </span>
              <GoldFiligree class="portrait-filigree" />
            </span>
            <figcaption>
              <span class="experience__plate">00</span>
              {{ profile.name }}
            </figcaption>
          </figure>

          <StickyNote :front="profile.note.front" :back="profile.note.back" />
        </div>

        <ol class="experience__chapters">
          <li
            v-for="(role, index) in profile.experience"
            :key="role.id"
            class="chapter"
            :class="{ 'chapter--turned': turned[role.id] }"
            :style="{
              '--chapter-index': index,
              '--year': `'${role.start.slice(0, 4)}'`,
              '--tilt-x': tilt[role.id]?.ax ?? 0,
              '--tilt-y': tilt[role.id]?.ay ?? 1,
              '--tilt-a': `${tilt[role.id]?.deg ?? 0}deg`,
              '--px': tilt[role.id]?.px ?? '50%',
              '--py': tilt[role.id]?.py ?? '0%',
            }"
            @pointermove="tiltCard($event, role.id)"
            @pointerleave="restCard(role.id)"
          >
            <!-- inert rather than aria-hidden: the far face must leave the tab
                 order too, and aria-hidden on something focusable is worse than
                 no marking at all -->
            <div class="chapter__face chapter__face--front" :inert="turned[role.id] || undefined">
              <figure v-if="role.photo" class="chapter__photo">
                <span
                  class="photo-frame"
                  :style="{
                    '--photo-position': role.photo.position,
                    '--frame-ratio': `${role.photo.w} / ${role.photo.h}`,
                  }"
                >
                  <img
                    :src="role.photo.src"
                    :alt="role.photo.alt"
                    :width="role.photo.w"
                    :height="role.photo.h"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <figcaption>
                  <span class="photo-where">{{ role.photo.caption.where }}</span>
                  <span class="photo-what">{{ role.photo.caption.what }}</span>
                </figcaption>
              </figure>

              <figure v-if="role.scene" class="chapter__scene">
                <span
                  class="photo-frame"
                  :style="{
                    '--photo-position': role.scene.position,
                    '--frame-ratio': `${role.scene.w} / ${role.scene.h}`,
                  }"
                >
                  <img
                    :src="role.scene.src"
                    :alt="role.scene.alt"
                    :width="role.scene.w"
                    :height="role.scene.h"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <figcaption>
                  <span class="photo-where">{{ role.scene.caption.where }}</span>
                  <span class="photo-what">{{ role.scene.caption.what }}</span>
                </figcaption>
              </figure>

              <p class="chapter__period">
                <span class="chapter__dates">{{ role.period }}</span>
                <span class="chapter__index">{{ String(index + 1).padStart(2, '0') }}</span>
              </p>

              <article class="chapter__marquee">
                <CompanyMark :mark="role.mark" />
                <h3 class="chapter__company">{{ role.company }}</h3>
                <p class="chapter__role">
                  {{ role.role }}
                  <span aria-hidden="true">·</span>
                  <em>{{ role.kind }}</em>
                </p>
                <p class="chapter__team">{{ role.team }}</p>
                <p class="chapter__place">{{ role.place }}</p>
              </article>

              <button
                type="button"
                class="chapter__turn"
                :aria-expanded="Boolean(turned[role.id])"
                :aria-controls="`chapter-evidence-${role.id}`"
                @click="turn(role.id)"
              >
                What I did at {{ role.company }}
                <span aria-hidden="true">↻</span>
              </button>
            </div>

            <div
              :id="`chapter-evidence-${role.id}`"
              class="chapter__face chapter__face--back"
              :inert="!turned[role.id] || undefined"
            >
              <article class="chapter__outcome">
                <p>{{ role.outcome }}</p>
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

              <article v-if="role.learnt" class="chapter__learnt">
                <h4>What I learned</h4>
                <p>{{ role.learnt }}</p>
              </article>

              <button type="button" class="chapter__turn" @click="turn(role.id)">
                Back to {{ role.company }}
                <span aria-hidden="true">↺</span>
              </button>
            </div>
          </li>
        </ol>
        </div>

        <button
          type="button"
          class="experience__step experience__step--back"
          aria-label="More recent roles"
          :disabled="railAtStart"
          @click="stepRail(-1)"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          class="experience__step experience__step--on"
          aria-label="Earlier roles"
          :disabled="railAtEnd"
          @click="stepRail(1)"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <p class="experience__axis" aria-hidden="true">
        <span>Now</span>
        <span class="experience__axis-track">
          <span class="experience__axis-thumb" :style="railProgress" />
        </span>
        <span>{{ careerYears[0] }}</span>
      </p>
    </section>

    <!-- The tools sit in an album rather than a grid: each one is a small
         issued thing you pick up, and the page next to it is the catalogue. -->
    <section class="album" aria-labelledby="album-title">
      <div class="album__head">
        <div>
          <p>Projects / {{ String(profile.projects.length).padStart(2, '0') }}</p>
          <h2 id="album-title">What I've built</h2>
        </div>

        <div class="album__controls">
          <label class="album__sort">
            <span>Arrange by</span>
            <select v-model="albumSort" @change="albumScatter = false">
              <option value="field">Field</option>
              <option value="language">Language</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button type="button" class="album__shuffle" @click="shuffleAlbum">
            <span aria-hidden="true">⤫</span>
            {{ albumScatter ? 'Reshuffle' : 'Shuffle' }}
          </button>
        </div>
      </div>

      <div class="tarot-hanging" aria-hidden="true">
        <span class="tarot-hanging__card tarot-hanging__card--sun">
          <img
            src="/tarot-sun.webp"
            alt=""
            width="482"
            height="720"
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="tarot-hanging__card tarot-hanging__card--moon">
          <img
            src="/tarot-moon.webp"
            alt=""
            width="432"
            height="720"
            loading="lazy"
            decoding="async"
          />
        </span>
      </div>

      <div class="album__window">
        <div
          class="album__page"
          :class="{ 'album__page--empty': !focusedProject }"
          :style="focusedProject ? { '--accent': focusedProject.accent } : null"
          aria-live="polite"
        >
          <template v-if="focusedProject">
            <p class="album__catalogue">Project record</p>
            <h3 class="album__name">{{ focusedProject.name }}</h3>
            <ol class="album__flow">
              <li v-for="stage in focusedProject.flow" :key="stage">{{ stage }}</li>
            </ol>
            <dl class="album__facts">
              <div><dt>Field</dt><dd>{{ focusedProject.field }}</dd></div>
              <div><dt>Primary language</dt><dd>{{ focusedProject.language }}</dd></div>
              <div><dt>Year</dt><dd>{{ focusedProject.issued }}</dd></div>
            </dl>
            <ul class="album__points">
              <li v-for="point in focusedProject.points" :key="point">{{ point }}</li>
            </ul>
            <p v-if="focusedProject.note" class="album__note">{{ focusedProject.note }}</p>
            <ul v-if="focusedProject.links" class="album__links">
              <li v-for="link in focusedProject.links" :key="link.href">
                <a :href="link.href" rel="external">
                  {{ link.label }}<span aria-hidden="true"> ↗</span>
                </a>
              </li>
            </ul>
          </template>
          <p v-else class="album__prompt">Select a project stamp to inspect its workflow</p>
        </div>

        <ul class="album__field" :class="{ 'album__field--loose': albumScatter }">
          <li
            v-for="(project, index) in arrangedProjects"
            :key="project.id"
            :style="{
              '--accent': project.accent,
              '--lean': albumScatter ? `${scatter[project.id] ?? 0}deg` : '0deg',
              '--stamp-index': index,
            }"
          >
            <button
              type="button"
              class="stamp"
              :class="{ 'stamp--held': focused === project.id }"
              :style="{
                '--tilt-x': stampTilt[project.id]?.ax ?? 0,
                '--tilt-y': stampTilt[project.id]?.ay ?? 0,
                '--tilt-a': `${stampTilt[project.id]?.deg ?? 0}deg`,
                '--px': stampTilt[project.id]?.px ?? '50%',
                '--py': stampTilt[project.id]?.py ?? '50%',
              }"
              :aria-pressed="focused === project.id"
              @click="holdStamp(project.id)"
              @pointermove="tiltStamp($event, project.id)"
              @pointerleave="restStamp(project.id)"
            >
              <span class="stamp__paper">
                <span class="stamp__issuer">{{ project.field }}</span>
                <span class="stamp__art" aria-hidden="true">{{ project.glyph }}</span>
                <span class="stamp__name">{{ project.name }}</span>
                <span class="stamp__foot">
                  <span class="stamp__denom">{{ project.language }}</span>
                  <span class="stamp__year">{{ project.issued }}</span>
                </span>
                <span class="stamp__blurb">{{ project.blurb }}</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <section
      class="qualifications qualifications--languages"
      :class="{ 'qualifications--motion': pageVisible }"
      aria-labelledby="languages-title"
    >
      <div class="album__head qualifications__head">
        <div>
          <p>Languages / {{ String(profile.languages.length).padStart(2, '0') }}</p>
          <h2 id="languages-title">Languages</h2>
        </div>
      </div>

      <div
        class="qualifications__instrument"
        :style="{ '--language-count': profile.languages.length }"
      >
        <div class="language-console">
          <div
            :class="['language-switch', { 'language-switch--scrolling': languageSwitchScrollable }]"
            :style="{
              '--language-accent': activeLanguageRecord.accent,
            }"
            role="group"
            aria-label="Choose a language"
          >
            <button
              v-for="language in profile.languages"
              :key="language.id"
              type="button"
              :class="{ 'language-switch__button--active': activeLanguage === language.id }"
              :aria-pressed="activeLanguage === language.id"
              @click="activeLanguage = language.id"
            >
              <span :lang="language.lang">{{ language.native }}</span>
            </button>
          </div>

          <div class="language-stage" aria-live="polite">
            <div
              :key="activeLanguageRecord.id"
              class="language-stage__state"
              :style="{ '--language-accent': activeLanguageRecord.accent }"
            >
              <p class="language-stage__word" :lang="activeLanguageRecord.lang">
                <span
                  v-for="(letter, index) in activeLanguageLetters"
                  :key="`${letter}-${index}`"
                  class="language-stage__letter"
                  :style="{ '--letter': index }"
                >{{ letter }}</span>
              </p>
              <p class="language-stage__level">{{ activeLanguageRecord.level }}</p>
              <p class="language-stage__detail">{{ activeLanguageRecord.detail }}</p>
              <a
                v-if="activeLanguageRecord.href"
                :href="activeLanguageRecord.href"
                rel="external"
              >JLPT level definition <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="qualifications qualifications--certifications"
      :class="{ 'qualifications--motion': pageVisible }"
      aria-labelledby="certifications-title"
    >
      <div class="album__head qualifications__head">
        <div>
          <p>Credentials / {{ String(profile.certifications.length).padStart(2, '0') }}</p>
          <h2 id="certifications-title">Certifications</h2>
        </div>
      </div>

      <div class="qualifications__instrument">
        <section class="certification-press" aria-labelledby="certification-press-title">
          <div class="qualifications__label">
            <p>Record / {{ String(profile.certifications.length).padStart(2, '0') }}</p>
            <h3 id="certification-press-title">Credential details</h3>
          </div>

          <div class="certification-press__bench">
            <div class="certification-press__seals" role="group" aria-label="Choose a certification">
              <button
                v-for="certification in profile.certifications"
                :key="certification.id"
                type="button"
                class="certification-seal"
                :class="{ 'certification-seal--active': activeCertification === certification.id }"
                :style="{
                  '--certification-accent': certification.accent,
                  '--tilt-x': certificationTilt[certification.id]?.ax ?? 0,
                  '--tilt-y': certificationTilt[certification.id]?.ay ?? 0,
                  '--tilt-a': `${certificationTilt[certification.id]?.deg ?? 0}deg`,
                  '--px': certificationTilt[certification.id]?.px ?? '50%',
                  '--py': certificationTilt[certification.id]?.py ?? '50%',
                }"
                :aria-pressed="activeCertification === certification.id"
                :aria-label="`${certification.issuer}: ${certification.name}`"
                @click="activeCertification = certification.id"
                @pointermove="tiltCertification($event, certification.id)"
                @pointerleave="restCertification(certification.id)"
              >
                <span class="certification-seal__coin">
                  <span>{{ certification.issuer }}</span>
                  <strong>{{ certification.code }}</strong>
                </span>
              </button>
            </div>

            <div class="certification-focus" aria-live="polite">
              <article
                :key="activeCertificationRecord.id"
                :style="{ '--certification-accent': activeCertificationRecord.accent }"
              >
                <p>{{ activeCertificationRecord.issuer }}</p>
                <h4>{{ activeCertificationRecord.name }}</h4>
                <dl>
                  <div><dt>Status</dt><dd>{{ activeCertificationRecord.status }}</dd></div>
                  <div><dt>Code</dt><dd>{{ activeCertificationRecord.code }}</dd></div>
                </dl>
                <p class="certification-focus__detail">{{ activeCertificationRecord.detail }}</p>
                <ul>
                  <li v-for="link in activeCertificationRecord.links" :key="link.href">
                    <a :href="link.href" rel="external">{{ link.label }} <span aria-hidden="true">↗</span></a>
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>
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

    <p class="font-credit font-credit--photos">
      Place photographs:
      <template v-for="(credit, index) in photoCredits" :key="credit.subject">
        <span v-if="index" aria-hidden="true"> · </span>
        {{ credit.subject }} by {{ credit.author }},
        <a :href="credit.href" rel="license external">{{ credit.licence }}</a>
      </template>
    </p>
  </footer>
</template>