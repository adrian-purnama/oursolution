import { useRef } from 'react'
import {
  BUILDERS,
  BuildFrame,
  BuilderCursor,
  MOVE,
  offscreen,
} from '#/components/home/builders'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '#/lib/gsap'

/**
 * What each builder lays out, in order. `target` matches a `data-build`
 * element of the hero; `at` is when the builder sets off.
 */
const JOBS = [
  { builder: 0, at: 0, targets: ['title1', 'actions'] },
  { builder: 1, at: 0.18, targets: ['title2', 'assure'] },
  { builder: 2, at: 0.36, targets: ['copy', 'visual'] },
] as const

/** Seconds until the last block is in, for whatever plays after. */
export const BUILD_SECONDS = 2.8

/**
 * The hero's entrance: three labelled cursors fly in from different sides
 * of the screen, each drags out a
 * selection frame for a block of the hero, and the block's content appears
 * inside it. Place it as a child of the hero's positioned container; the
 * blocks are the `data-build` elements in there, and their content starts
 * hidden through `data-hero-line` / `data-hero-fade`. With
 * reduced motion nothing here shows and the hero is simply there.
 */
export default function HeroBuilders() {
  const overlay = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        // The container, found from here: a parent's own ref is not attached
        // yet when this first runs.
        const root = overlay.current?.parentElement
        if (!root) return
        const q = gsap.utils.selector(root)
        // Held until styles and fonts are in, so the frames fit the text.
        const master = gsap.timeline({ paused: true })
        let cancelled = false
        void pageReady().then(() => {
          if (!cancelled) master.delay(0.1).play()
        })

        for (const job of JOBS) {
          const builder = BUILDERS[job.builder]
          const cursor = q(`[data-builder="${job.builder}"]`).at(0)
          if (!cursor) continue
          const tl = gsap.timeline()
          const start = offscreen(root, builder.from)
          gsap.set(cursor, { x: start.x, y: start.y, autoAlpha: 1 })
          // `next`: where the cursor sets off for its next block.
          tl.addLabel('next', 0)

          for (const [index, target] of job.targets.entries()) {
            const block = q(`[data-build="${target}"]`).at(0)
            const frame = q(`[data-build-frame="${target}"]`).at(0)
            if (!block || !frame) continue
            // Measured when each step starts, after fonts and layout settle.
            const across = () => span(root, block)
            const left = () => across().left
            const width = () => across().width
            const top = () => block.offsetTop
            // A tall block (the visual) is framed only down to the fold.
            const height = () =>
              Math.min(block.offsetHeight, window.innerHeight * 0.45)

            // The first trip, in from off screen, is longer: glide in.
            const arrive =
              index === 0 ? { duration: 0.6, ease: 'power2.out' } : MOVE
            tl.to(cursor, { x: left, y: top, ...arrive }, 'next')
              .set(frame, {
                x: left,
                y: top,
                width: 0,
                height: 0,
                autoAlpha: 1,
              })
              .to(frame, { width, height, ...MOVE })
              .to(
                cursor,
                {
                  x: () => left() + width(),
                  y: () => top() + height(),
                  ...MOVE,
                },
                '<',
              )
            // The content appears and the frame lets go while the cursor
            // already heads for its next block.
            const dragged = tl.labels.next + arrive.duration + MOVE.duration
            tl.add(reveal(block), dragged - 0.15).to(
              frame,
              { autoAlpha: 0, duration: 0.45 },
              dragged + 0.2,
            )
            tl.addLabel('next', dragged)
          }

          // Done: off it goes, out its own side of the screen.
          tl.to(
            cursor,
            {
              x: () => offscreen(root, builder.to).x,
              y: () => offscreen(root, builder.to).y,
              duration: 0.7,
              ease: 'power2.in',
            },
            'next',
          )
          master.add(tl, job.at)
        }
        return () => {
          cancelled = true
        }
      })
    },
    { scope: overlay },
  )

  return (
    <div
      ref={overlay}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 motion-reduce:hidden"
    >
      {JOBS.flatMap((job) =>
        job.targets.map((target) => (
          <BuildFrame
            key={target}
            builder={BUILDERS[job.builder]}
            data-build-frame={target}
          />
        )),
      )}

      {BUILDERS.map((builder, index) => (
        <BuilderCursor
          key={builder.name}
          builder={builder}
          data-builder={index}
        />
      ))}
    </div>
  )
}

/** Resolves once styles and fonts are in, so layout is final. */
async function pageReady(): Promise<void> {
  if (document.readyState !== 'complete') {
    await new Promise((resolve) =>
      window.addEventListener('load', resolve, { once: true }),
    )
  }
  await document.fonts.ready
}

/** Room left and right of a headline line's text inside its frame. */
const TEXT_PAD = 12

/**
 * Where a block sits across `root`. A headline line spans the full width,
 * so its frame hugs the text instead.
 */
function span(root: HTMLElement, block: HTMLElement) {
  const line = block.querySelector('[data-hero-line]')
  if (!line) return { left: block.offsetLeft, width: block.offsetWidth }
  const range = document.createRange()
  range.selectNodeContents(line)
  const text = range.getBoundingClientRect()
  return {
    left: text.left - root.getBoundingClientRect().left - TEXT_PAD,
    width: text.width + TEXT_PAD * 2,
  }
}

/** Shows a block's content: a headline line slides up, anything else fades in. */
function reveal(block: HTMLElement): gsap.core.Tween {
  const line = block.querySelector('[data-hero-line]')
  if (line) {
    return gsap.to(line, { y: 0, duration: 0.8, ease: 'power4.out' })
  }
  return gsap.to(block, { opacity: 1, y: 0, duration: 0.7, ease: EASE_OUT })
}
