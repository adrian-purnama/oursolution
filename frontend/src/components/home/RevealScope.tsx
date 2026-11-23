import { useRef } from 'react'
import type { ReactNode } from 'react'
import {
  BUILDERS,
  BuildFrame,
  BuilderCursor,
  MOVE,
  clipToFrame,
  offscreen,
  releaseClip,
} from '#/components/home/builders'
import { EASE_OUT, MOTION_OK, ScrollTrigger, gsap, useGSAP } from '#/lib/gsap'
import { cn } from '#/lib/utils'

/** Seconds between blocks that scroll in together. */
const STAGGER = 0.15

/**
 * The landing page shell. Every `[data-reveal]` element inside is built
 * once as it scrolls into view: one of the builders' cursors flies in from
 * its side of the screen, drags a frame over it, the element is drawn in
 * place under the frame as it grows, and the cursor leaves. Elements entering together go to
 * different builders, a little apart. Their hidden start state lives in
 * styles.css; with reduced motion they are simply there.
 */
export default function RevealScope({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const root = useRef<HTMLElement>(null)
  const layer = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const main = root.current
      const overlay = layer.current
      if (!main || !overlay) return
      /** Which builder takes the next element, in turn. */
      let turn = 0

      // Not wrapped in contextSafe: the batch callback already runs inside
      // the matchMedia context below, so the timelines land there and are
      // reverted with it. Wrapping it in the outer context would put that
      // context inside its own child, and reverting it on unmount would
      // then recurse forever ("Maximum call stack size exceeded").
      const build = (element: HTMLElement, delay: number) => {
        const index = turn++ % BUILDERS.length
        const builder = BUILDERS[index]
        const cursor = cloneTemplate(overlay, 'cursor', index)
        const frame = cloneTemplate(overlay, 'frame', index)
        if (!cursor || !frame) {
          gsap.to(element, { opacity: 1, duration: 0.8, ease: EASE_OUT })
          return
        }

        /** Where the element sits, in `main`'s terms. */
        let box = { left: 0, top: 0, width: 0, height: 0 }
        const draw = () => clipToFrame(element, frame)
        const measure = () => {
          const area = main.getBoundingClientRect()
          const rect = element.getBoundingClientRect()
          box = {
            left: rect.left - area.left,
            top: rect.top - area.top,
            width: rect.width,
            // A tall element is framed only as far as the screen shows.
            height: Math.min(rect.height, window.innerHeight * 0.6),
          }
          const start = offscreen(main, builder.from)
          gsap.set(cursor, { x: start.x, y: start.y, autoAlpha: 1 })
        }

        gsap
          .timeline({
            delay,
            onComplete: () => {
              cursor.remove()
              frame.remove()
            },
          })
          .call(measure)
          .to(cursor, {
            x: () => box.left,
            y: () => box.top,
            duration: 0.6,
            ease: 'power2.out',
          })
          .set(frame, {
            x: () => box.left,
            y: () => box.top,
            width: 0,
            height: 0,
            autoAlpha: 1,
          })
          .to(frame, {
            width: () => box.width,
            height: () => box.height,
            ...MOVE,
            onStart: draw,
            onUpdate: draw,
          })
          .to(
            cursor,
            {
              x: () => box.left + box.width,
              y: () => box.top + box.height,
              ...MOVE,
            },
            '<',
          )
          .add(() => void releaseClip(element))
          .to(frame, { autoAlpha: 0, duration: 0.45 }, '<0.2')
          .to(
            cursor,
            {
              x: () => offscreen(main, builder.to).x,
              y: () => offscreen(main, builder.to).y,
              duration: 0.7,
              ease: 'power2.in',
            },
            '<-0.2',
          )
      }

      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 88%',
          once: true,
          onEnter: (elements) => {
            elements.forEach((element, index) => {
              if (element instanceof HTMLElement)
                build(element, index * STAGGER)
            })
          },
        })
      })
    },
    { scope: root },
  )

  return (
    <main ref={root} className={cn('relative', className)}>
      {children}
      {/* Where the builders work; it clips cursors that are off screen. */}
      <div
        ref={layer}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden"
      >
        {BUILDERS.map((builder, index) => (
          <BuilderCursor
            key={builder.name}
            builder={builder}
            hidden
            data-template="cursor"
            data-index={index}
          />
        ))}
        {BUILDERS.map((builder, index) => (
          <BuildFrame
            key={builder.name}
            builder={builder}
            hidden
            data-template="frame"
            data-index={index}
          />
        ))}
      </div>
    </main>
  )
}

/** A fresh copy of a builder's cursor or frame, placed in the overlay. */
function cloneTemplate(
  overlay: HTMLElement,
  kind: 'cursor' | 'frame',
  index: number,
): HTMLElement | null {
  const template = overlay.querySelector(
    `[data-template="${kind}"][data-index="${index}"]`,
  )
  if (!(template instanceof HTMLElement)) return null
  const copy = template.cloneNode(true) as HTMLElement
  copy.hidden = false
  copy.removeAttribute('data-template')
  overlay.append(copy)
  return copy
}
