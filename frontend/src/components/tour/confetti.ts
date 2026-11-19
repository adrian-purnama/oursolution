/** Brand colours, read from the page so a theme change carries over. */
function palette(): string[] {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return [
    read('--accent', '#135ef5'),
    read('--navy', '#002060'),
    read('--accent-paper', '#e6dac7'),
    '#f59e0b',
    '#10b981',
    '#ec4899',
  ]
}

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  color: string
}

/**
 * A short burst of confetti from both bottom corners, drawn on a canvas
 * laid over the page. Skipped when the user asks for less motion.
 */
export function fireConfetti(durationMs = 2600): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '300',
  })
  document.body.appendChild(canvas)
  const context = canvas.getContext('2d')
  if (!context) {
    canvas.remove()
    return
  }

  const ratio = window.devicePixelRatio || 1
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  context.scale(ratio, ratio)

  const colors = palette()
  const pieces: Piece[] = Array.from({ length: 140 }, (_, index) => {
    const fromLeft = index % 2 === 0
    const speed = 9 + Math.random() * 9
    // Up and inwards, spread over about 40 degrees.
    const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40
    const radians = (angle * Math.PI) / 180
    return {
      x: fromLeft ? 0 : width,
      y: height,
      vx: Math.cos(radians) * speed,
      vy: Math.sin(radians) * speed * 1.4,
      size: 6 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.3,
      angle: Math.random() * Math.PI,
      color: colors[index % colors.length],
    }
  })

  const start = performance.now()
  const frame = (now: number) => {
    const elapsed = now - start
    context.clearRect(0, 0, width, height)
    const fade = Math.max(0, 1 - Math.max(0, elapsed - durationMs + 600) / 600)
    context.globalAlpha = fade
    for (const piece of pieces) {
      piece.vy += 0.32
      piece.vx *= 0.985
      piece.vy *= 0.985
      piece.x += piece.vx
      piece.y += piece.vy
      piece.angle += piece.spin
      context.save()
      context.translate(piece.x, piece.y)
      context.rotate(piece.angle)
      context.fillStyle = piece.color
      context.fillRect(
        -piece.size / 2,
        -piece.size / 4,
        piece.size,
        piece.size / 2,
      )
      context.restore()
    }
    if (elapsed < durationMs) window.requestAnimationFrame(frame)
    else canvas.remove()
  }
  window.requestAnimationFrame(frame)
}
