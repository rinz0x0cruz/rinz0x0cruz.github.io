<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const props = defineProps({
  instruments: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['resolve'])

const canvas = ref(null)
const container = ref(null)
let animationFrame
let animationEnd = 0
let camera
let intersectionObserver
let keyLight
let material
let reducedMotionMedia
let renderer
let resizeObserver
let scene
let visible = false
let disposed = false
const models = []

function instrumentSlots() {
  return [...container.value.querySelectorAll('[data-instrument-index]')]
}

function yieldToMain() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield()

  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function resize() {
  if (!renderer || !camera || !container.value) return

  const { clientWidth, clientHeight } = container.value
  if (!clientWidth || !clientHeight) return

  renderer.setSize(clientWidth, clientHeight, false)
  draw()
}

function draw(time = 0) {
  if (!renderer || !models.some(({ pivot }) => pivot)) return

  canvas.value.dataset.renderCount = String(Number(canvas.value.dataset.renderCount || 0) + 1)
  const rootBounds = container.value.getBoundingClientRect()
  renderer.setScissorTest(false)
  renderer.setViewport(0, 0, rootBounds.width, rootBounds.height)
  renderer.clear()
  renderer.setScissorTest(true)

  for (const state of models) {
    if (!state.pivot) continue

    const slotBounds = state.slot.getBoundingClientRect()
    if (!slotBounds.width || !slotBounds.height) continue

    state.smoothedPointer.lerp(state.pointer, 0.16)
    keyLight.position.set(
      state.smoothedPointer.x * 3.2,
      2.2 - state.smoothedPointer.y * 1.4,
      2.8,
    )
    state.pivot.rotation.x = state.rotation[0] + state.smoothedPointer.y * 0.18
    state.pivot.rotation.y = state.rotation[1] + state.smoothedPointer.x * 0.38
    state.pivot.rotation.z = state.rotation[2]

    const left = slotBounds.left - rootBounds.left
    const bottom = rootBounds.bottom - slotBounds.bottom
    camera.aspect = slotBounds.width / slotBounds.height
    camera.updateProjectionMatrix()
    renderer.setViewport(left, bottom, slotBounds.width, slotBounds.height)
    renderer.setScissor(left, bottom, slotBounds.width, slotBounds.height)
    state.pivot.visible = true
    renderer.render(scene, camera)
    state.pivot.visible = false
  }

  renderer.setScissorTest(false)
}

function animate(time) {
  draw(time)
  if (time < animationEnd) animationFrame = requestAnimationFrame(animate)
  else animationFrame = undefined
}

function syncAnimation() {
  cancelAnimationFrame(animationFrame)
  animationFrame = undefined
  animationEnd = 0

  if (!visible || !models.some(({ pivot }) => pivot)) return

  draw()
}

function scheduleAnimation(duration = 240) {
  if (!visible || reducedMotionMedia.matches || !models.some(({ pivot }) => pivot)) return

  animationEnd = performance.now() + duration
  if (!animationFrame) animationFrame = requestAnimationFrame(animate)
}

function handlePointerMove(event) {
  if (reducedMotionMedia?.matches) return

  for (const state of models) {
    const bounds = state.card.getBoundingClientRect()
    const inside = event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom
    const localX = inside ? ((event.clientX - bounds.left) / bounds.width) * 100 : 50
    const localY = inside ? ((event.clientY - bounds.top) / bounds.height) * 100 : 50
    state.card.style.setProperty('--card-x', `${localX}%`)
    state.card.style.setProperty('--card-y', `${localY}%`)
    state.pointer.set(
      inside ? ((event.clientX - bounds.left) / bounds.width) * 2 - 1 : 0,
      inside ? ((event.clientY - bounds.top) / bounds.height) * 2 - 1 : 0,
    )
  }
  scheduleAnimation()
}

function resetPointer() {
  models.forEach(({ card, pointer }) => {
    card.style.setProperty('--card-x', '50%')
    card.style.setProperty('--card-y', '50%')
    pointer.set(0, 0)
  })
  scheduleAnimation()
}

async function initialize() {
  if (renderer || !canvas.value) return

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvas.value,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
  } catch {
    canvas.value.setAttribute('data-render-state', 'failed')
    instrumentSlots().forEach((slot) => {
      slot.dataset.modelState = 'failed'
    })
    emit('resolve', props.instruments.map(() => 'failed'))
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.72
  await yieldToMain()
  if (disposed) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100)
  camera.position.set(0, 0.1, 4.4)
  await yieldToMain()
  if (disposed) return

  keyLight = new THREE.PointLight(0xdaf5ff, 10, 10)
  keyLight.position.set(0, 2.2, 2.8)
  scene.add(keyLight)
  const rimLight = new THREE.PointLight(0xd1a35f, 7, 10)
  rimLight.position.set(-2.4, -0.5, 1.8)
  scene.add(rimLight)
  const separationLight = new THREE.PointLight(0x8fc7d0, 5, 10)
  separationLight.position.set(2.5, 0.8, -1.2)
  scene.add(separationLight)

  material = new THREE.MeshPhysicalMaterial({
    color: 0x151e24,
    metalness: 0.9,
    roughness: 0.24,
    anisotropy: 0.6,
    clearcoat: 0.34,
    clearcoatRoughness: 0.18,
  })

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const slots = instrumentSlots()
  props.instruments.forEach((instrument, index) => {
    models.push({
      card: slots[index].closest('.achievement-card'),
      index,
      pointer: new THREE.Vector2(),
      pivot: null,
      rotation: instrument.rotation ?? [0, 0, 0],
      slot: slots[index],
      smoothedPointer: new THREE.Vector2(),
      status: 'loading',
    })
  })

  const loads = props.instruments.map((instrument) => loader.loadAsync(instrument.src).then(
    (gltf) => ({ gltf }),
    () => ({ gltf: null }),
  ))

  for (let index = 0; index < loads.length; index += 1) {
    const { gltf } = await loads[index]
    if (disposed) return

    if (!gltf) {
      models[index].status = 'failed'
      models[index].slot.dataset.modelState = 'failed'
    } else {
      const source = gltf.scene
      const bounds = new THREE.Box3().setFromObject(source)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const scale = 1.7 / Math.max(size.x, size.y, size.z)
      source.scale.setScalar(scale)
      source.position.copy(center).multiplyScalar(-scale)
      source.traverse((child) => {
        if (child.isMesh) child.material = material
      })

      const pivot = new THREE.Group()
      pivot.add(source)
      pivot.position.y = 0.18
      pivot.visible = false
      scene.add(pivot)
      models[index].pivot = pivot
      models[index].status = 'ready'
      models[index].slot.dataset.modelState = 'ready'
    }

    await yieldToMain()
    if (disposed) return
  }

  const readyModels = models.filter(({ pivot }) => pivot)
  emit('resolve', models.map(({ status }) => status))
  canvas.value.setAttribute('data-render-state', readyModels.length ? 'ready' : 'failed')

  if (readyModels.length && renderer.compileAsync) {
    readyModels.forEach((state) => {
      state.pivot.visible = true
    })
    await renderer.compileAsync(scene, camera)
    readyModels.forEach((state) => {
      state.pivot.visible = false
    })
    if (disposed) return
  }
  if (!reducedMotionMedia.matches) {
    readyModels.forEach((state) => {
      state.smoothedPointer.set(state.index % 2 ? 0.42 : -0.42, 0.12)
    })
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container.value)
  resize()
  if (!reducedMotionMedia.matches) scheduleAnimation(520)
}

onMounted(() => {
  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionMedia.addEventListener('change', syncAnimation)
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible && !window.matchMedia('(forced-colors: active)').matches) void initialize()
    syncAnimation()
  }, { rootMargin: '160px' })
  intersectionObserver.observe(container.value)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(animationFrame)
  reducedMotionMedia?.removeEventListener('change', syncAnimation)
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  models.forEach(({ pivot }) => pivot?.traverse((child) => child.geometry?.dispose()))
  material?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div
    ref="container"
    class="achievement-stage"
    @pointermove="handlePointerMove"
    @pointerleave="resetPointer"
  >
    <canvas
      ref="canvas"
      class="achievement-stage__canvas"
      data-render-count="0"
      data-render-state="loading"
    ></canvas>
    <slot></slot>
  </div>
</template>

<style scoped>
.achievement-stage__canvas {
  display: block;
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  filter: drop-shadow(0 1.25rem 1rem rgba(0, 0, 0, 0.78));
}

@media (prefers-reduced-motion: reduce) {
  .achievement-stage__canvas {
    filter: none;
  }
}

@media (forced-colors: active) {
  .achievement-stage__canvas {
    display: none;
  }
}
</style>