<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvas = ref(null)
const container = ref(null)
const cameraHalfHeight = 1.2
const cardSources = [
  {
    name: 'sun',
    model: '/models/tarot/sun.glb',
    texture: '/models/tarot/sun-atlas.webp',
    rotation: [0, 0, -0.044],
  },
  {
    name: 'moon',
    model: '/models/tarot/moon.glb',
    texture: '/models/tarot/moon-atlas.webp',
    rotation: [0, 0, 0.035],
  },
]

let THREE
let animationEnd = 0
let animationFrame
let camera
let disposed = false
let intersectionObserver
let reducedMotionMedia
let renderer
let resizeObserver
let scene
let visible = false
const materials = []
const models = []
const textures = []

function slots() {
  return [...container.value.querySelectorAll('[data-tarot-slot]')]
}

function prefersReducedData() {
  return Boolean(
    navigator.connection?.saveData
    || window.matchMedia('(prefers-reduced-data: reduce)').matches,
  )
}

function yieldToMain() {
  if (globalThis.scheduler?.yield) return globalThis.scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function resize() {
  if (!renderer || !container.value) return
  const { clientWidth, clientHeight } = container.value
  if (!clientWidth || !clientHeight) return

  renderer.setSize(clientWidth, clientHeight, false)
  draw()
}

function draw() {
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

    state.smoothedPointer.lerp(state.pointer, 0.18)
    state.pivot.rotation.x = state.rotation[0] + state.smoothedPointer.y * 0.16
    state.pivot.rotation.y = state.rotation[1] + state.smoothedPointer.x * 0.34
    state.pivot.rotation.z = state.rotation[2] + state.smoothedPointer.x * 0.025

    const left = slotBounds.left - rootBounds.left
    const bottom = rootBounds.bottom - slotBounds.bottom
    const aspect = slotBounds.width / slotBounds.height
    camera.left = -cameraHalfHeight * aspect
    camera.right = cameraHalfHeight * aspect
    camera.top = cameraHalfHeight
    camera.bottom = -cameraHalfHeight
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
  draw()
  if (time < animationEnd) {
    animationFrame = requestAnimationFrame(animate)
    return
  }

  models.forEach(({ pivot, pointer, smoothedPointer }) => {
    if (pivot) smoothedPointer.copy(pointer)
  })
  draw()
  animationFrame = undefined
}

function stopAnimation() {
  cancelAnimationFrame(animationFrame)
  animationFrame = undefined
  animationEnd = 0
}

function scheduleAnimation(duration = 280) {
  if (!visible || document.hidden || reducedMotionMedia.matches) return
  animationEnd = performance.now() + duration
  if (!animationFrame) animationFrame = requestAnimationFrame(animate)
}

function syncMotion() {
  stopAnimation()
  if (!models.some(({ pivot }) => pivot)) return

  if (reducedMotionMedia.matches) {
    models.forEach(({ pointer, smoothedPointer }) => {
      pointer.set(0, 0)
      smoothedPointer.set(0, 0)
    })
    draw()
  } else if (visible && !document.hidden) {
    scheduleAnimation(520)
  }
}

function handlePointerMove(event) {
  if (reducedMotionMedia?.matches) return

  for (const state of models) {
    const bounds = state.slot.getBoundingClientRect()
    const inside = event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom
    state.pointer.set(
      inside ? ((event.clientX - bounds.left) / bounds.width) * 2 - 1 : 0,
      inside ? ((event.clientY - bounds.top) / bounds.height) * 2 - 1 : 0,
    )
  }
  scheduleAnimation()
}

function resetPointer() {
  models.forEach(({ pointer }) => pointer.set(0, 0))
  scheduleAnimation()
}

function failAll() {
  container.value.dataset.renderState = 'failed'
  canvas.value.dataset.renderState = 'failed'
  slots().forEach((slot) => { slot.dataset.modelState = 'failed' })
}

async function initialize() {
  if (renderer || disposed || !canvas.value) return

  let GLTFLoader
  try {
    const modules = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
    ])
    THREE = modules[0]
    GLTFLoader = modules[1].GLTFLoader
    if (disposed) return

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvas.value,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
  } catch {
    failAll()
    return
  }

  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(
    -cameraHalfHeight,
    cameraHalfHeight,
    cameraHalfHeight,
    -cameraHalfHeight,
    0.01,
    100,
  )
  camera.position.set(0, 0, 5)
  await yieldToMain()
  if (disposed) return

  const cardSlots = slots()
  const modelLoader = new GLTFLoader()
  const textureLoader = new THREE.TextureLoader()
  cardSources.forEach(({ rotation }, index) => {
    models.push({
      index,
      pivot: null,
      pointer: new THREE.Vector2(),
      rotation,
      slot: cardSlots[index],
      smoothedPointer: new THREE.Vector2(),
    })
  })

  const loads = cardSources.map(async (card) => {
    try {
      const [gltf, texture] = await Promise.all([
        modelLoader.loadAsync(card.model),
        textureLoader.loadAsync(card.texture),
      ])
      return { gltf, texture }
    } catch {
      return null
    }
  })

  for (let index = 0; index < loads.length; index += 1) {
    const loaded = await loads[index]
    if (disposed) return

    if (!loaded) {
      models[index].slot.dataset.modelState = 'failed'
      continue
    }

    const { gltf, texture } = loaded
    texture.colorSpace = THREE.SRGBColorSpace
    // The OBJ UVs are retained verbatim; glTF's usual false value scrambles this atlas.
    texture.flipY = true
    texture.needsUpdate = true
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    textures.push(texture)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    })
    materials.push(material)

    const source = gltf.scene
    const bounds = new THREE.Box3().setFromObject(source)
    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const scale = 2 / size.y
    models[index].slot.dataset.reliefDepth = (size.z / size.y).toFixed(3)
    source.scale.setScalar(scale)
    source.position.copy(center).multiplyScalar(-scale)
    source.traverse((child) => {
      if (child.isMesh) child.material = material
    })

    const pivot = new THREE.Group()
    pivot.add(source)
    pivot.visible = false
    scene.add(pivot)
    models[index].pivot = pivot
    models[index].slot.dataset.modelState = 'ready'
    await yieldToMain()
    if (disposed) return
  }

  const readyModels = models.filter(({ pivot }) => pivot)
  const allReady = readyModels.length === cardSources.length
  container.value.dataset.renderState = allReady ? 'ready' : readyModels.length ? 'partial' : 'failed'
  canvas.value.dataset.renderState = readyModels.length ? 'ready' : 'failed'

  if (readyModels.length && renderer.compileAsync) {
    readyModels.forEach(({ pivot }) => { pivot.visible = true })
    await renderer.compileAsync(scene, camera)
    readyModels.forEach(({ pivot }) => { pivot.visible = false })
    if (disposed) return
  }

  if (!reducedMotionMedia.matches) {
    readyModels.forEach((state) => {
      state.smoothedPointer.set(state.index ? 0.45 : -0.45, 0.08)
    })
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container.value)
  resize()
  scheduleAnimation(620)
}

function handleVisibility() {
  if (document.hidden) stopAnimation()
  else if (visible) {
    draw()
    scheduleAnimation()
  }
}

onMounted(() => {
  reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionMedia.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', handleVisibility)

  if (prefersReducedData()) {
    container.value.dataset.renderState = 'fallback'
    canvas.value.dataset.renderState = 'fallback'
    slots().forEach((slot) => { slot.dataset.modelState = 'fallback' })
    return
  }

  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible && !window.matchMedia('(forced-colors: active)').matches) void initialize()
    if (!visible) stopAnimation()
    else draw()
  }, { rootMargin: '160px' })
  intersectionObserver.observe(container.value)
})

onBeforeUnmount(() => {
  disposed = true
  stopAnimation()
  reducedMotionMedia?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', handleVisibility)
  intersectionObserver?.disconnect()
  resizeObserver?.disconnect()
  models.forEach(({ pivot }) => pivot?.traverse((child) => child.geometry?.dispose()))
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
  renderer?.dispose()
})
</script>

<template>
  <div
    ref="container"
    class="tarot-hanging"
    aria-hidden="true"
    data-render-state="loading"
    @pointermove="handlePointerMove"
    @pointerleave="resetPointer"
  >
    <canvas
      ref="canvas"
      class="tarot-hanging__canvas"
      data-render-count="0"
      data-render-state="loading"
    ></canvas>
    <span
      class="tarot-hanging__card tarot-hanging__card--sun"
      data-model-state="loading"
      data-tarot-slot
    >
      <img
        src="/tarot-sun.webp"
        srcset="/tarot-sun-256.webp 256w, /tarot-sun.webp 482w"
        sizes="128px"
        alt=""
        width="482"
        height="720"
        loading="lazy"
        decoding="async"
      />
    </span>
    <span
      class="tarot-hanging__card tarot-hanging__card--moon"
      data-model-state="loading"
      data-tarot-slot
    >
      <img
        src="/tarot-moon.webp"
        srcset="/tarot-moon-256.webp 256w, /tarot-moon.webp 432w"
        sizes="116px"
        alt=""
        width="432"
        height="720"
        loading="lazy"
        decoding="async"
      />
    </span>
  </div>
</template>

<style scoped>
.tarot-hanging__canvas {
  position: absolute;
  z-index: 3;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  filter: drop-shadow(0 0.75rem 0.7rem rgba(0, 0, 0, 0.72));
}

@media (prefers-reduced-motion: reduce) {
  .tarot-hanging__canvas {
    filter: none;
  }
}

@media (forced-colors: active) {
  .tarot-hanging__canvas {
    display: none;
  }
}
</style>