import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  Bot,
  Check,
  Database,
  Globe,
  LayoutDashboard,
  Leaf,
  MessageCircle,
  MousePointer2,
  Package,
  RefreshCw,
  Send,
  Server,
  Settings,
  Star,
  Truck,
  Users,
  Workflow,
} from 'lucide-react'
import { BRAND_NAME } from '#/lib/config'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '#/lib/gsap'
import { cn } from '#/lib/utils'

/** The tabs of the example browser: one per kind of thing we deliver. */
const SCENES = [
  { label: 'Dashboard', icon: LayoutDashboard, url: 'orders.yourcompany.com' },
  { label: 'Website', icon: Globe, url: 'www.yourbrand.com' },
  { label: 'Hosting', icon: Server, url: 'hosting.yourcompany.com' },
  { label: 'Chatbot', icon: MessageCircle, url: 'yourshop.com' },
]

/** Seconds a scene stays on screen after its own animation has finished. */
const HOLD = 1.6

type Point = { x: number; y: number }

const card = 'rounded-lg border border-[var(--line)] p-4'
const cardLabel = 'text-xs text-[var(--muted)]'
const mono = 'font-mono text-[10px] text-[var(--muted)]'

const floatCard =
  'absolute hidden rounded-xl border border-[var(--line)] bg-white p-4 text-left shadow-[0_1px_2px_rgba(12,12,11,0.05),0_24px_48px_-20px_rgba(12,12,11,0.28)] 2xl:block'

/**
 * Plays one scene. The markup opts in with data attributes:
 * `data-pop` rises in, `data-bar` grows up, `data-fill` grows right,
 * `data-wipe` is revealed left to right, `data-draw` (its dash length) strokes
 * a ring, `data-count` counts up to its number, `data-step` arrives one after
 * another.
 *
 * Then the cursor uses the page: it clicks `data-click` and `data-after`
 * shows up, or it types the text of `data-type` into that field, presses
 * `data-send`, and `data-sent`, `data-typing` and `data-reply` follow.
 *
 * Returns the timeline, a function that puts changed text back, and the two
 * cursor moves so the caller can send it on to the next tab.
 */
function playScene(
  root: HTMLElement,
  scene: HTMLElement,
  cursor: HTMLElement,
  delay: number,
) {
  const q = gsap.utils.selector(scene)
  const tl = gsap.timeline({ delay, defaults: { ease: EASE_OUT } })
  const each = (selector: string, build: (els: Array<HTMLElement>) => void) => {
    const els = q(selector)
    if (els.length) build(els)
  }

  each('[data-pop]', (els) =>
    tl.from(els, { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.05 }, 0),
  )
  each('[data-bar]', (els) =>
    tl.from(
      els,
      { scaleY: 0, transformOrigin: '50% 100%', duration: 0.8, stagger: 0.06 },
      0.25,
    ),
  )
  each('[data-fill]', (els) =>
    tl.from(
      els,
      { scaleX: 0, transformOrigin: '0% 50%', duration: 1, stagger: 0.12 },
      0.3,
    ),
  )
  each('[data-wipe]', (els) =>
    tl.fromTo(
      els,
      { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power2.inOut' },
      0.3,
    ),
  )
  each('[data-draw]', (els) =>
    tl.fromTo(
      els,
      {
        strokeDashoffset: (_: number, el: Element) =>
          Number(el.getAttribute('data-draw')),
      },
      { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' },
      0.3,
    ),
  )

  const counters = q('[data-count]').map((el) => {
    const end = Number(el.dataset.count)
    const decimals = Number(el.dataset.decimals ?? 0)
    const suffix = el.dataset.suffix ?? ''
    const write = (value: number) => {
      el.textContent = value.toFixed(decimals) + suffix
    }
    const state = { value: 0 }
    write(0)
    tl.to(
      state,
      {
        value: end,
        duration: 1.3,
        ease: 'power2.out',
        onUpdate: () => write(state.value),
      },
      0.2,
    )
    return () => write(end)
  })

  each('[data-step]', (els) =>
    tl.from(els, { autoAlpha: 0, y: 10, duration: 0.4, stagger: 0.6 }, 0.6),
  )

  const arrow = cursor.querySelector('[data-cursor-arrow]')
  const ring = cursor.querySelector('[data-cursor-ring]')
  const shown = (el: Element) => el.getClientRects().length > 0
  /** Where the cursor points to press `el`, measured when it sets off. */
  const point = (el: Element): Point => {
    const box = el.getBoundingClientRect()
    const base = root.getBoundingClientRect()
    return {
      x: box.left - base.left + box.width / 2,
      y: box.top - base.top + box.height * 0.6,
    }
  }
  const moveTo = (el: Element, at?: gsap.Position) =>
    tl.to(
      cursor,
      {
        x: () => point(el).x,
        y: () => point(el).y,
        duration: 0.9,
        ease: 'power2.inOut',
      },
      at,
    )
  const click = (el: Element) => {
    tl.to(arrow, { scale: 0.78, duration: 0.1, yoyo: true, repeat: 1 })
      .fromTo(
        ring,
        { scale: 0.3, autoAlpha: 0.7 },
        { scale: 1.9, autoAlpha: 0, duration: 0.45, immediateRender: false },
        '<',
      )
      .to(el, { scale: 0.95, duration: 0.1, yoyo: true, repeat: 1 }, '<')
  }

  // The cursor sets off while the last pieces are still settling.
  tl.addLabel('act', Math.max(1.1, tl.duration() - 0.5))

  const target = q('[data-click]').find(shown)
  if (target) {
    moveTo(target, 'act')
    click(target)
    each('[data-after]', (after) =>
      tl.from(after, {
        autoAlpha: 0,
        y: 8,
        scale: 0.92,
        duration: 0.45,
        ease: 'back.out(1.8)',
      }),
    )
  }

  let restoreField = () => {}
  const field = q('[data-type]').find(shown)
  const send = q('[data-send]').find(shown)
  if (field && send) {
    const text = field.dataset.type ?? ''
    const placeholder = field.textContent
    const typed = { length: 0 }
    restoreField = () => {
      field.textContent = placeholder
    }

    moveTo(field, 'act')
    click(field)
    tl.set(field, { color: 'var(--ink)' }).to(typed, {
      length: text.length,
      duration: text.length * 0.055,
      ease: 'none',
      onUpdate: () => {
        field.textContent = text.slice(0, Math.round(typed.length))
      },
    })
    moveTo(send, '+=0.2')
    click(send)
    tl.call(restoreField).set(field, { clearProps: 'color' })
    each('[data-sent]', (els) =>
      tl.from(els, { autoAlpha: 0, y: 10, duration: 0.4 }),
    )
    each('[data-typing]', (els) =>
      tl
        .set(els, { display: 'flex' }, '+=0.3')
        .from(els, { autoAlpha: 0, duration: 0.2 })
        .set(els, { display: 'none' }, '+=1.2'),
    )
    each('[data-reply]', (els) =>
      tl.from(els, { autoAlpha: 0, y: 10, duration: 0.4 }),
    )
  }

  const reset = () => {
    counters.forEach((restore) => restore())
    restoreField()
  }

  return { tl, reset, moveTo, click }
}

/**
 * An example of what a client gets, as a browser someone is using: a cursor
 * labelled "You" clicks through a custom dashboard, a website, the hosting
 * behind them and the chatbot, typing a question into the last one, and
 * switches the tabs itself. It waits on a scene while the mouse is over the
 * frame, and the tabs can be clicked for real. With reduced motion there is
 * no cursor, nothing moves and the tabs still work. Purely illustrative.
 */
export default function HeroVisual({
  introDelay = 1.1,
}: {
  /** Seconds to wait on load before the first scene plays. */
  introDelay?: number
}) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  /** Changes scene, first noting where the cursor is so it carries on from there. */
  const show = (index: number) => {
    const cursor = root.current?.querySelector('[data-cursor]')
    if (cursor && pos.current) {
      pos.current.x = Number(gsap.getProperty(cursor, 'x'))
      pos.current.y = Number(gsap.getProperty(cursor, 'y'))
    }
    setActive(index)
  }
  const firstRun = useRef(true)
  const hovered = useRef(false)
  const waiting = useRef(false)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  /** Where the cursor was last, so it carries on from there in the next scene. */
  const pos = useRef<Point | null>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(MOTION_OK, () => {
        const frame = root.current
        const scene = frame?.querySelector<HTMLElement>(
          `[data-scene="${active}"]`,
        )
        const cursor = frame?.querySelector<HTMLElement>('[data-cursor]')
        if (!frame || !scene || !cursor) return

        const first = firstRun.current
        firstRun.current = false
        waiting.current = false
        pos.current ??= { x: frame.offsetWidth * 0.7, y: 320 }
        gsap.set(cursor, { x: pos.current.x, y: pos.current.y })

        // On load, wait for the hero itself to fade in first.
        const { tl, reset, moveTo, click } = playScene(
          frame,
          scene,
          cursor,
          first ? introDelay : 0.15,
        )
        timeline.current = tl
        if (first) {
          tl.fromTo(
            cursor,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.4 },
            0,
          )
        }

        // Rest on the scene, and stay for as long as someone is looking.
        tl.to({}, { duration: HOLD }).call(() => {
          if (!hovered.current) return
          waiting.current = true
          tl.pause()
        })

        // Then the cursor opens the next tab.
        const tabs = frame.querySelectorAll('[data-tab]')
        const nextTab = tabs[(active + 1) % tabs.length]
        moveTo(nextTab)
        click(nextTab)
        tl.call(() => show((active + 1) % SCENES.length))

        const progress = frame.querySelector('[data-tab-progress]')
        if (progress) {
          tl.fromTo(
            progress,
            { scaleX: 0 },
            { scaleX: 1, duration: tl.duration(), ease: 'none' },
            0,
          )
        }

        return reset
      })
    },
    { scope: root, dependencies: [active], revertOnUpdate: true },
  )

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(MOTION_OK, () => {
        gsap.to('[data-float]', {
          y: -9,
          duration: 2.8,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: 0.9,
        })
      })
    },
    { scope: root },
  )

  return (
    <div
      ref={root}
      role="group"
      aria-label={`Examples of what ${BRAND_NAME} builds and runs: a dashboard, a website, hosting and a chatbot`}
      className="relative mx-auto max-w-5xl"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') hovered.current = true
      }}
      onPointerLeave={() => {
        hovered.current = false
        if (waiting.current) {
          waiting.current = false
          timeline.current?.resume()
        }
      }}
    >
      <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[var(--line)] bg-white text-left shadow-[0_1px_2px_rgba(12,12,11,0.04),0_40px_80px_-32px_rgba(12,12,11,0.3)]">
        {/* Browser tabs */}
        <div className="flex items-end gap-3 bg-[var(--surface)] px-4 pt-2.5">
          <span aria-hidden className="mb-3 flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
          </span>
          <div className="flex min-w-0 flex-1 gap-1">
            {SCENES.map(({ label, icon: Icon }, i) => (
              <button
                key={label}
                type="button"
                data-tab
                aria-pressed={i === active}
                onClick={() => {
                  waiting.current = false
                  show(i)
                }}
                className={cn(
                  'relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-t-lg border border-b-0 px-3 py-2 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:max-w-40 sm:justify-start',
                  i === active
                    ? 'border-[var(--line)] bg-white font-medium text-[var(--ink)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate max-sm:sr-only">{label}</span>
                {i === active && (
                  <span
                    data-tab-progress
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-0.5 origin-left bg-[var(--accent)]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Address bar */}
        <div className="flex items-center gap-3 border-y border-[var(--line)] bg-white px-4 py-2">
          <span
            aria-hidden
            className="w-full truncate rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 font-mono text-[11px] text-[var(--muted)]"
          >
            {SCENES[active].url}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-[var(--accent)]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
              <span className="relative size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        {/* The scenes share one grid cell, so the frame keeps the height of
            the tallest and nothing jumps when they change. */}
        <div aria-hidden className="grid">
          <Scene index={0} active={active}>
            <DashboardScene />
          </Scene>
          <Scene index={1} active={active}>
            <WebsiteScene />
          </Scene>
          <Scene index={2} active={active}>
            <HostingScene />
          </Scene>
          <Scene index={3} active={active}>
            <ChatbotScene />
          </Scene>
        </div>
      </div>

      {/* The visitor's cursor. It is moved from its top left corner. */}
      <div
        aria-hidden
        data-cursor
        className="pointer-events-none absolute top-0 left-0 z-10 motion-reduce:hidden"
      >
        <span
          data-cursor-ring
          className="absolute -top-3 -left-3 size-6 rounded-full border-2 border-[var(--accent)] opacity-0"
        />
        <MousePointer2
          data-cursor-arrow
          className="size-5 origin-top-left fill-[var(--accent)] text-white drop-shadow-[0_1px_2px_rgba(12,12,11,0.35)]"
        />
        <span className="absolute top-4 left-4 rounded-full rounded-tl-sm bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-white shadow-[0_4px_10px_-4px_rgba(12,12,11,0.4)]">
          You
        </span>
      </div>

      {/* What we run around it: releases on the left, monitoring on the right. */}
      {/* <div
        aria-hidden
        data-float
        className={cn(floatCard, 'top-28 -left-52 w-56')}
      >
        <p className="mb-3 font-mono text-[11px] text-[var(--muted)]">
          Release v2.4
        </p>
        <ul className="space-y-2.5">
          {['Build', 'Tests', 'Deploy'].map((step) => (
            <li key={step} className="flex items-center gap-2.5 text-[13px]">
              <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                <Check className="size-3" aria-hidden />
              </span>
              {step}
              <span className={cn(mono, 'ml-auto')}>passed</span>
            </li>
          ))}
        </ul>
      </div> */}

      {/* <div
        aria-hidden
        data-float
        className={cn(floatCard, '-right-56 bottom-8 w-60')}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] text-[var(--muted)]">
            Monitoring
          </p>
          <Activity className="size-3.5 text-[var(--accent)]" aria-hidden />
        </div>
        <p className="mb-3 text-[13px] font-medium">All systems normal</p>
        <Sparkline
          className="h-10"
          points={[28, 26, 29, 22, 25, 18, 21, 14, 17, 10, 12]}
        />
        <p className={cn(mono, 'mt-2')}>Backups on · updates managed</p>
      </div> */}
    </div>
  )
}

function Scene({
  index,
  active,
  children,
}: {
  index: number
  active: number
  children: ReactNode
}) {
  return (
    <div
      data-scene={index}
      className={cn(
        'col-start-1 row-start-1 min-w-0 transition-[opacity,visibility] duration-500',
        index === active ? 'visible opacity-100' : 'invisible opacity-0',
      )}
    >
      {children}
    </div>
  )
}

/** A line with a soft fill under it. `points` are y values on a 0 to 40 scale. */
function Sparkline({
  points,
  className,
}: {
  points: Array<number>
  className?: string
}) {
  const step = 200 / (points.length - 1)
  const line = points
    .map((y, i) => `${i ? 'L' : 'M'}${i * step} ${y}`)
    .join(' ')

  return (
    <svg
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
      className={cn('w-full text-[var(--accent)]', className)}
      fill="none"
    >
      <path d={`${line} L200 40 L0 40 Z`} fill="currentColor" opacity="0.1" />
      <path
        d={line}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 1: a custom dashboard with its charts                         */
/* ------------------------------------------------------------------ */

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: Package, label: 'Orders', active: false },
  { icon: Users, label: 'Customers', active: false },
  { icon: BarChart3, label: 'Reports', active: false },
  { icon: Settings, label: 'Settings', active: false },
]

const STATS = [
  { label: 'Orders today', count: 128, note: '+12 since yesterday' },
  { label: 'Waiting for approval', count: 9, note: '3 older than a day' },
  { label: 'Average handling', text: '4m 10s', note: 'Was 26m on paper' },
]

/** Bar heights (percent) for the example week. */
const WEEK = [
  { day: 'Mon', value: 46 },
  { day: 'Tue', value: 62 },
  { day: 'Wed', value: 54 },
  { day: 'Thu', value: 78 },
  { day: 'Fri', value: 91 },
  { day: 'Sat', value: 40 },
  { day: 'Sun', value: 28 },
]

function DashboardScene() {
  return (
    <div className="grid h-full md:grid-cols-[11.5rem_1fr]">
      <div className="hidden border-r border-[var(--line)] bg-[var(--surface)]/60 p-4 md:block">
        <p className="mb-5 flex items-center gap-2 text-sm font-semibold">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--ink)] text-[11px] text-white">
            Y
          </span>
          Your Company
        </p>
        <ul className="space-y-1">
          {NAV.map(({ icon: Icon, label, active }) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
                active
                  ? 'bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgba(12,12,11,0.06)]'
                  : 'text-[var(--muted)]',
              )}
            >
              <Icon className="size-4" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="p-5 sm:p-7">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <p className="text-base font-semibold">Orders overview</p>
          <p className="font-mono text-[11px] text-[var(--muted)]">
            Updated just now
          </p>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} data-pop className={card}>
              <p className={cn(cardLabel, 'mb-2')}>{stat.label}</p>
              {stat.count === undefined ? (
                <p className="font-display mb-1 text-2xl">{stat.text}</p>
              ) : (
                <p
                  data-count={stat.count}
                  className="font-display mb-1 text-2xl tabular-nums"
                >
                  {String(stat.count)}
                </p>
              )}
              <p className="text-[11px] text-[var(--accent)]">{stat.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr] lg:grid-cols-[1.3fr_1fr_0.7fr]">
          <div data-pop className={card}>
            <p className={cn(cardLabel, 'mb-4')}>Orders this week</p>
            <div className="flex h-28 items-end gap-2.5">
              {WEEK.map((bar) => (
                <div
                  key={bar.day}
                  className="relative flex h-full flex-1 flex-col justify-end gap-1.5"
                >
                  {bar.day === 'Fri' && (
                    <span
                      data-after
                      className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-[var(--ink)] px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white"
                    >
                      Friday: 117 orders
                    </span>
                  )}
                  <div
                    data-bar
                    data-click={bar.day === 'Fri' ? '' : undefined}
                    className={cn(
                      'rounded-t-sm',
                      bar.day === 'Fri'
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--accent)]/20',
                    )}
                    style={{ height: `${bar.value}%` }}
                  />
                  <span className={cn(mono, 'text-center')}>{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div data-pop className={cn(card, 'hidden sm:block')}>
            <div className="mb-4 flex items-baseline justify-between">
              <p className={cardLabel}>Revenue, 30 days</p>
              <p className="text-[11px] font-medium text-[var(--accent)]">
                +18%
              </p>
            </div>
            <div data-wipe>
              <Sparkline
                className="h-28"
                points={[34, 31, 33, 27, 29, 22, 25, 18, 20, 13, 15, 8, 10, 5]}
              />
            </div>
          </div>

          <div data-pop className={cn(card, 'hidden lg:block')}>
            <p className={cn(cardLabel, 'mb-3')}>Delivered on time</p>
            <div className="relative mx-auto size-24">
              <svg
                viewBox="0 0 36 36"
                className="size-full -rotate-90"
                fill="none"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  stroke="var(--line)"
                  strokeWidth="3"
                />
                <circle
                  data-draw="94"
                  cx="18"
                  cy="18"
                  r="15.9155"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="94 100"
                />
              </svg>
              <p
                data-count={94}
                data-suffix="%"
                className="font-display absolute inset-0 flex items-center justify-center text-lg tabular-nums"
              >
                94%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 2: a landing page                                             */
/* ------------------------------------------------------------------ */

const PERKS = [
  { icon: Truck, title: 'Free delivery', text: 'On every weekly box' },
  { icon: Leaf, title: 'Roasted fresh', text: 'Never older than 5 days' },
  { icon: RefreshCw, title: 'Pause anytime', text: 'No contract, no fuss' },
]

function WebsiteScene() {
  return (
    <div className="flex h-full flex-col p-5 sm:p-7">
      <div data-pop className="mb-7 flex items-center gap-6 text-[13px]">
        <p className="flex items-center gap-2 font-semibold">
          <span className="size-5 rounded-full bg-[var(--accent)]" />
          Your Brand
        </p>
        <p className="ml-auto hidden gap-5 text-[var(--muted)] sm:flex">
          <span>Menu</span>
          <span>How it works</span>
          <span>Reviews</span>
        </p>
        <span className="ml-auto rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-medium sm:ml-0">
          Sign in
        </span>
      </div>

      <div className="grid flex-1 items-center gap-6 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <p
            data-pop
            className="mb-3 inline-flex rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]"
          >
            New: weekly subscription
          </p>
          <p
            data-pop
            className="font-display mb-3 text-[1.7rem] leading-[1.08] sm:text-[2.1rem]"
          >
            Fresh coffee at your door, every week.
          </p>
          <p data-pop className="mb-5 max-w-sm text-[13px] text-[var(--muted)]">
            Pick your roast once. We grind, pack and deliver it before you run
            out.
          </p>
          <div data-pop className="flex flex-wrap gap-2">
            <span
              data-click
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-white"
            >
              Start my order
            </span>
            <span className="rounded-full border border-[var(--line)] px-4 py-2 text-[13px] font-medium">
              See the menu
            </span>
          </div>
        </div>

        <div
          data-pop
          className="relative hidden h-52 rounded-xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,white),color-mix(in_srgb,var(--accent)_5%,white))] sm:block"
        >
          <div className="absolute top-6 left-6 w-40 rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_12px_28px_-16px_rgba(12,12,11,0.35)]">
            <div className="mb-2.5 h-16 rounded-md bg-[var(--accent)]/15" />
            <p className="text-[12px] font-medium">House blend, 250 g</p>
            <p className={mono}>Medium roast</p>
          </div>
          <div className="absolute top-10 right-5 flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium shadow-[0_8px_20px_-12px_rgba(12,12,11,0.35)]">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            4.9 from 2,300 reviews
          </div>
          <div
            data-after
            className="absolute right-5 bottom-5 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 shadow-[0_12px_28px_-16px_rgba(12,12,11,0.35)]"
          >
            <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-3" />
            </span>
            <span>
              <span className="block text-[12px] font-medium">
                New order received
              </span>
              <span className={mono}>just now</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            data-pop
            className={cn(card, 'flex items-center gap-3 py-3')}
          >
            <Icon className="size-4 shrink-0 text-[var(--accent)]" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">
                {title}
              </span>
              <span className="block truncate text-[11px] text-[var(--muted)]">
                {text}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 3: the hosting behind it                                      */
/* ------------------------------------------------------------------ */

const SERVICES = [
  {
    icon: Workflow,
    name: 'Workflow automation',
    host: 'flows.yourcompany.com',
    load: 34,
  },
  {
    icon: Globe,
    name: 'Company website',
    host: 'www.yourcompany.com',
    load: 12,
  },
  { icon: Database, name: 'Database', host: 'db.yourcompany.com', load: 58 },
]

const BACKUPS = [
  { when: 'Today, 02:00', size: '1.2 GB' },
  { when: 'Yesterday, 02:00', size: '1.2 GB' },
  { when: 'Friday, 02:00', size: '1.1 GB' },
]

function HostingScene() {
  return (
    <div className="h-full p-5 sm:p-7">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <p className="text-base font-semibold">Your services</p>
        <p className="mr-auto hidden font-mono text-[11px] text-[var(--muted)] sm:block">
          3 running · managed by {BRAND_NAME}
        </p>
        <span className="relative">
          <span
            data-click
            className="inline-block rounded-full bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white"
          >
            Deploy update
          </span>
          <span
            data-after
            className="absolute top-full right-0 z-10 mt-2 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 whitespace-nowrap shadow-[0_12px_28px_-16px_rgba(12,12,11,0.35)]"
          >
            <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-3" />
            </span>
            <span className="text-[12px] font-medium">v2.5 is live</span>
            <span className={mono}>38s, no downtime</span>
          </span>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
        <ul className="space-y-3">
          {SERVICES.map(({ icon: Icon, name, host, load }) => (
            <li key={name} data-pop className={card}>
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--ink)]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {name}
                  </span>
                  <span className={cn(mono, 'block truncate')}>{host}</span>
                </span>
                <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Running
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={mono}>CPU</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
                  <span
                    data-fill
                    className="block h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${load}%` }}
                  />
                </span>
                <span
                  data-count={load}
                  data-suffix="%"
                  className={cn(mono, 'w-7 text-right tabular-nums')}
                >
                  {`${load}%`}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid content-start gap-3">
          <div data-pop className={card}>
            <p className={cn(cardLabel, 'mb-2')}>Uptime, last 30 days</p>
            <p
              data-count={99.98}
              data-decimals={2}
              data-suffix="%"
              className="font-display mb-3 text-2xl tabular-nums"
            >
              99.98%
            </p>
            <div data-wipe>
              <Sparkline
                className="h-10"
                points={[20, 19, 21, 18, 20, 19, 17, 19, 18, 16, 18, 17]}
              />
            </div>
          </div>

          <div data-pop className={cn(card, 'hidden sm:block')}>
            <p className={cn(cardLabel, 'mb-3')}>Automatic backups</p>
            <ul className="space-y-2.5">
              {BACKUPS.map(({ when, size }) => (
                <li
                  key={when}
                  data-step
                  className="flex items-center gap-2.5 text-[13px]"
                >
                  <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                    <Check className="size-3" />
                  </span>
                  <span className="truncate">{when}</span>
                  <span className={cn(mono, 'ml-auto shrink-0')}>{size}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Scene 4: the answr chatbot on a client's site                       */
/* ------------------------------------------------------------------ */

const CHAT = [
  { from: 'visitor', text: 'Do you deliver to Surabaya?' },
  {
    from: 'bot',
    text: 'Yes. It takes 2 to 3 days, and delivery is free on orders over Rp 500k.',
  },
]

/** The question the cursor types, and what answr says back. */
const TYPED_QUESTION = 'Can I pay on delivery?'
const TYPED_REPLY = 'You can. Cash on delivery works everywhere we ship.'

const bubble = 'max-w-[85%] rounded-2xl px-3 py-2'
const visitorBubble = 'self-end rounded-br-sm bg-[var(--accent)] text-white'
const botBubble = 'self-start rounded-bl-sm bg-[var(--surface)]'

/** Questions answered per day, as bar heights (percent). */
const QUESTIONS = [38, 52, 47, 66, 58, 81, 74, 92, 70, 85]

function ChatbotScene() {
  return (
    <div className="grid h-full gap-4 p-5 sm:grid-cols-[1fr_19rem] sm:p-7">
      <div className="hidden content-start gap-3 sm:grid">
        <p className="mb-2 text-base font-semibold">answr on your website</p>
        <div className="grid grid-cols-2 gap-3">
          <div data-pop className={card}>
            <p className={cn(cardLabel, 'mb-2')}>Answered without staff</p>
            <p
              data-count={86}
              data-suffix="%"
              className="font-display text-2xl tabular-nums"
            >
              86%
            </p>
          </div>
          <div data-pop className={card}>
            <p className={cn(cardLabel, 'mb-2')}>Average reply</p>
            <p className="font-display text-2xl">2 sec</p>
          </div>
        </div>
        <div data-pop className={card}>
          <p className={cn(cardLabel, 'mb-4')}>Questions answered per day</p>
          <div className="flex h-24 items-end gap-2">
            {QUESTIONS.map((value, i) => (
              <div
                key={i}
                data-bar
                className={cn(
                  'flex-1 rounded-t-sm',
                  i === 7 ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/20',
                )}
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        data-pop
        className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] shadow-[0_18px_40px_-24px_rgba(12,12,11,0.35)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <Bot className="size-4" />
          </span>
          <span>
            <span className="block text-[13px] font-medium">answr</span>
            <span className={cn(mono, 'flex items-center gap-1.5')}>
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-2.5 p-4 text-[13px] leading-snug">
          {CHAT.map(({ from, text }) => (
            <li
              key={text}
              data-step
              className={cn(
                bubble,
                from === 'visitor' ? visitorBubble : botBubble,
              )}
            >
              {text}
            </li>
          ))}
          <li data-sent className={cn(bubble, visitorBubble)}>
            {TYPED_QUESTION}
          </li>
          <li
            data-typing
            className={cn(botBubble, 'hidden gap-1 rounded-2xl px-3 py-3')}
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full bg-[var(--muted)] motion-safe:animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </li>
          <li data-reply className={cn(bubble, botBubble)}>
            {TYPED_REPLY}
          </li>
        </ul>

        <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
          <span
            data-type={TYPED_QUESTION}
            className="flex-1 truncate text-[13px] text-[var(--muted)]"
          >
            Ask a question
          </span>
          <span
            data-send
            className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--ink)] text-white"
          >
            <Send className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
