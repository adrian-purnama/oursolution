import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

export type TourStep = {
  /**
   * Selectors for the element to highlight; the first one on screen wins.
   * Without one the step is a card in the middle of the screen. A step
   * whose element never shows up is passed over.
   */
  target?: string | string[]
  title: string
  body: ReactNode
  /** Lets the user press the highlighted element. */
  interactive?: boolean
  /** The main button's label; "Next", or "Done" on the last step. */
  nextLabel?: string
  /** Runs when the main button is pressed, before moving on. */
  onNext?: () => void
  /** Runs once when the step starts, before its element is looked for. */
  onEnter?: () => void
  /** Runs once when the step shows. */
  onShow?: () => void
}

export type TourEnd = 'done' | 'skipped'

type Rect = { top: number; left: number; width: number; height: number }

/** Room around the highlighted element. */
const PAD = 6
/** Space between the element and the card, and the card and the edges. */
const GAP = 12
/** How long to wait for an element that loads late. */
const WAIT_MS = 2500
/** How long the glide to the next step lasts, smooth scroll included. */
const MORPH_MS = 600

function selectorsOf(step: TourStep): string[] {
  if (!step.target) return []
  return Array.isArray(step.target) ? step.target : [step.target]
}

/** The first matching element that takes up space on the page. */
function findTarget(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const box = element.getBoundingClientRect()
      // On screen, so a drawer still sliding in is waited for.
      if (
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.left < window.innerWidth
      ) {
        return element
      }
    }
  }
  return null
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.height === b.height)
  )
}

function prefersLessMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A step-by-step tour: dims the page, cuts a hole around one element and
 * explains it in a card next to it. Between steps the hole and the card
 * glide to their next place. Every step can be skipped; Escape skips too.
 * `onEnd` is called once, when finished or skipped.
 */
export default function Tour({
  steps,
  onEnd,
  label,
}: {
  steps: TourStep[]
  onEnd: (end: TourEnd) => void
  /** Names the tour for screen readers. */
  label: string
}) {
  const [index, setIndex] = useState(0)
  /** The step the card shows; it trails `index` until that step is found. */
  const [shownIndex, setShownIndex] = useState(-1)
  /** Kept between steps, so the hole can glide from it to the next one. */
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  /** On while moving between steps; off after, so scrolling stays crisp. */
  const [morphing, setMorphing] = useState(true)
  const [cardSize, setCardSize] = useState({ width: 320, height: 160 })
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const ended = useRef(false)
  const announced = useRef(-1)
  const entered = useRef(-1)
  const titleId = useId()
  const bodyId = useId()

  const step = steps.at(index)
  const shown = steps.at(shownIndex)
  const ready = shownIndex === index
  const lastShown = shownIndex === steps.length - 1

  function end(how: TourEnd) {
    if (ended.current) return
    ended.current = true
    onEnd(how)
  }

  function next() {
    if (lastShown) end('done')
    else setIndex(shownIndex + 1)
  }

  // Find the step's element, waiting a little for one that loads late.
  useEffect(() => {
    if (!step) return
    setMorphing(true)
    if (entered.current !== index) {
      entered.current = index
      step.onEnter?.()
    }
    const selectors = selectorsOf(step)
    if (selectors.length === 0) {
      setTarget(null)
      setShownIndex(index)
      return
    }
    const startedAt = Date.now()
    let timer = 0
    const look = () => {
      const found = findTarget(selectors)
      if (found) {
        window.clearInterval(timer)
        found.scrollIntoView({
          block: 'center',
          behavior: prefersLessMotion() ? 'auto' : 'smooth',
        })
        setTarget(found)
        setShownIndex(index)
      } else if (Date.now() - startedAt > WAIT_MS) {
        window.clearInterval(timer)
        // Nothing to point at on this page: go on without the step.
        if (index === steps.length - 1) end('done')
        else setIndex(index + 1)
      }
    }
    timer = window.setInterval(look, 100)
    look()
    return () => window.clearInterval(timer)
    // Per step: callers may pass new step objects on every render.
  }, [index])

  // Let the glide finish, then follow the element directly.
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setMorphing(false), MORPH_MS)
    return () => window.clearTimeout(timer)
  }, [ready, index])

  useEffect(() => {
    if (!ready || announced.current === index) return
    announced.current = index
    step?.onShow?.()
  }, [ready, index])

  // Follow the element while the page scrolls, resizes or reflows.
  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }
    let frame = 0
    const track = () => {
      const box = target.getBoundingClientRect()
      const measured: Rect = {
        top: Math.round(box.top - PAD),
        left: Math.round(box.left - PAD),
        width: Math.round(box.width + PAD * 2),
        height: Math.round(box.height + PAD * 2),
      }
      setRect((previous) =>
        sameRect(previous, measured) ? previous : measured,
      )
      frame = window.requestAnimationFrame(track)
    }
    track()
    return () => window.cancelAnimationFrame(frame)
  }, [target])

  useLayoutEffect(() => {
    if (!card.current) return
    const box = card.current.getBoundingClientRect()
    setCardSize((previous) =>
      previous.width === box.width && previous.height === box.height
        ? previous
        : { width: box.width, height: box.height },
    )
  })

  useEffect(() => {
    if (ready) primary.current?.focus({ preventScroll: true })
  }, [ready, index])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end('skipped')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!step || typeof document === 'undefined') return null

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  /** With nothing to point at, the hole closes to a point in the middle. */
  const hole: Rect = (target && rect) || {
    top: Math.round(viewportHeight / 2),
    left: Math.round(viewportWidth / 2),
    width: 0,
    height: 0,
  }
  const pointing = hole.width > 0

  let cardTop = (viewportHeight - cardSize.height) / 2
  let cardLeft = (viewportWidth - cardSize.width) / 2
  if (pointing) {
    const below = hole.top + hole.height + GAP
    const above = hole.top - GAP - cardSize.height
    cardTop =
      below + cardSize.height <= viewportHeight - GAP
        ? below
        : above >= GAP
          ? above
          : Math.max(GAP, viewportHeight - cardSize.height - GAP)
    cardLeft = Math.min(
      Math.max(GAP, hole.left + hole.width / 2 - cardSize.width / 2),
      viewportWidth - cardSize.width - GAP,
    )
  }

  const blocker = 'pointer-events-auto fixed'
  const glide = morphing
    ? 'transition-[top,left,width,height,border-radius,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
    : ''

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-label={label}
    >
      <div
        aria-hidden
        className={cn(
          'fixed rounded-[var(--radius-md)] ring-2 ring-white/90',
          !pointing && 'ring-0',
          glide,
        )}
        style={{
          ...hole,
          boxShadow: '0 0 0 9999px rgba(12, 12, 11, 0.55)',
        }}
      />
      {/* Presses outside the hole do nothing while the tour is open. */}
      <div
        className={blocker}
        style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
      />
      <div
        className={blocker}
        style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className={blocker}
        style={{
          top: hole.top,
          left: 0,
          width: Math.max(0, hole.left),
          height: hole.height,
        }}
      />
      <div
        className={blocker}
        style={{
          top: hole.top,
          left: hole.left + hole.width,
          right: 0,
          height: hole.height,
        }}
      />
      {ready && shown?.interactive ? null : (
        <div className={blocker} style={hole} />
      )}

      {shown ? (
        <div
          ref={card}
          role="dialog"
          aria-modal={!shown.interactive}
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={cn(
            'pointer-events-auto fixed w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 text-[var(--ink)] shadow-[0_24px_48px_-20px_rgba(12,12,11,0.35)]',
            'animate-in fade-in-0 zoom-in-95 duration-300 motion-reduce:animate-none',
            glide,
          )}
          style={{ top: cardTop, left: cardLeft }}
        >
          {/* The new step's words fade in while the card moves. */}
          <div
            key={shownIndex}
            className="animate-in fade-in-0 duration-300 motion-reduce:animate-none"
          >
            <div className="flex items-start gap-3">
              <h2 id={titleId} className="min-w-0 flex-1 text-sm font-medium">
                {shown.title}
              </h2>
              <button
                type="button"
                aria-label="Skip the tour"
                className="-mt-1 -mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                onClick={() => end('skipped')}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div id={bodyId} className={`mt-1 text-sm ${hintClassName}`}>
              {shown.body}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="mr-auto text-xs text-[var(--muted)] tabular-nums">
                {shownIndex + 1} of {steps.length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => end('skipped')}
              >
                Skip
              </Button>
              <Button
                ref={primary}
                type="button"
                size="sm"
                disabled={!ready}
                onClick={() => {
                  shown.onNext?.()
                  next()
                }}
              >
                {shown.nextLabel ?? (lastShown ? 'Done' : 'Next')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
