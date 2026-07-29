// One velocity integrator, shared by the career rail and the sticky note.
//
// Both want the same thing: take an impulse, keep moving, lose energy each
// frame, stop when the motion is no longer worth a repaint. Neither wants a
// scroll library, and nothing here touches the page's own scrolling.

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value))

/**
 * @param {object} options
 * @param {number} [options.friction] fraction of speed kept each frame
 * @param {number} [options.min] speed below which the glide is over
 * @param {number} [options.max] speed ceiling, so repeated impulses cannot launch it
 * @param {(vx: number, vy: number) => boolean | void} options.step
 *   applies one frame of motion; return false to end the glide, which is how a
 *   caller reports that it has run out of room
 */
export function glide({ friction = 0.88, min = 0.08, max = Infinity, step }) {
  let vx = 0
  let vy = 0
  let frame = 0

  function halt() {
    vx = 0
    vy = 0
    frame = 0
  }

  function tick() {
    frame = 0
    if (step(vx, vy) === false) return halt()

    vx *= friction
    vy *= friction
    if (Math.hypot(vx, vy) < min) return halt()

    frame = requestAnimationFrame(tick)
  }

  return {
    push(dx, dy = 0) {
      vx = clamp(vx + dx, max)
      vy = clamp(vy + dy, max)
      if (!frame) frame = requestAnimationFrame(tick)
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
 * Total distance an impulse will travel before friction stops it: the sum of
 * the geometric series v * f^n. Callers use it to size an impulse against a
 * distance they actually want, instead of guessing at a velocity.
 */
export const reachOf = (velocity, friction) => velocity / (1 - friction)
export const impulseFor = (distance, friction) => distance * (1 - friction)
