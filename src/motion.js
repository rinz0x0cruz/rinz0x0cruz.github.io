// One velocity integrator, shared by the career rail and the sticky note.
//
// Both want the same thing: take a shove, keep moving, lose energy each frame,
// stop when the motion is no longer worth a repaint. Neither wants a scroll
// library, and nothing here touches the page's own scrolling.
//
// The difference between them is `pickup`, which is how quickly a shove becomes
// speed. A thrown object leaves the hand at full speed already (pickup: 1). A
// heavy surface does not: it resists, takes the push up over several frames, and
// only then comes with you. That ramp is the whole of what reads as weight.

const FRAME = 1000 / 60
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value))

/**
 * @param {object} options
 * @param {number} [options.pickup] 0-1, share of the remaining shove taken per frame
 * @param {number} [options.drag] share of speed kept per frame
 * @param {number} [options.min] speed below which the motion is over
 * @param {number} [options.max] speed ceiling, so repeated shoves cannot launch it
 * @param {(dx: number, dy: number) => boolean | void} options.step
 *   moves by this frame's displacement; return false to end the motion, which is
 *   how a caller reports that it has run out of room
 */
export function glide({ pickup = 1, drag = 0.88, min = 0.08, max = Infinity, step }) {
  let vx = 0
  let vy = 0
  // shove that has not been turned into speed yet
  let px = 0
  let py = 0
  let frame = 0
  let last = 0

  function halt() {
    vx = 0
    vy = 0
    px = 0
    py = 0
    frame = 0
    last = 0
  }

  function tick(now) {
    // Everything below is per 60fps frame, so the feel does not change on a
    // 120Hz display or across a dropped frame. Clamped because a backgrounded
    // tab resumes with a gap that would otherwise teleport the whole motion.
    const frames = last ? Math.min(4, Math.max(0.2, (now - last) / FRAME)) : 1
    last = now
    frame = 0

    const taken = 1 - Math.pow(1 - pickup, frames)
    const tx = px * taken
    const ty = py * taken
    px -= tx
    py -= ty
    vx = clamp(vx + tx, max)
    vy = clamp(vy + ty, max)

    const kept = Math.pow(drag, frames)
    vx *= kept
    vy *= kept

    if (step(vx * frames, vy * frames) === false) return halt()
    // both have to be spent: speed can still be near zero while a shove is being
    // taken up, which is exactly what the start of a heavy scroll looks like
    if (Math.hypot(vx, vy) < min && Math.hypot(px, py) < min) return halt()

    frame = requestAnimationFrame(tick)
  }

  return {
    push(dx, dy = 0) {
      px += dx
      py += dy
      if (!frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    },
    stop() {
      if (frame) cancelAnimationFrame(frame)
      halt()
    },
    get moving() {
      return frame !== 0
    },
  }
}

/**
 * Total distance a shove travels before drag stops it: the sum of the geometric
 * series. Callers use it to size a shove against a distance they actually want
 * instead of guessing at a number. Independent of pickup, which changes only how
 * that distance is spread over time, not how much of it there is.
 */
export const reachOf = (shove, drag) => shove / (1 - drag)
export const impulseFor = (distance, drag) => distance * (1 - drag)
