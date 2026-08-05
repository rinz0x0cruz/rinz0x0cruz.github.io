export function scheduleIdleEnhancement(callback, { timeout = 3_000 } = {}) {
  let cancelled = false
  let idleHandle
  let fallbackTimer
  let waitingForLoad = false

  const run = () => {
    if (!cancelled) callback()
  }
  const schedule = () => {
    waitingForLoad = false
    if (window.requestIdleCallback) {
      idleHandle = window.requestIdleCallback(run, { timeout })
    } else {
      fallbackTimer = window.setTimeout(run, 1_000)
    }
  }

  if (document.readyState === 'complete') schedule()
  else {
    waitingForLoad = true
    window.addEventListener('load', schedule, { once: true })
  }

  return () => {
    cancelled = true
    if (waitingForLoad) window.removeEventListener('load', schedule)
    if (idleHandle !== undefined) window.cancelIdleCallback?.(idleHandle)
    window.clearTimeout(fallbackTimer)
  }
}