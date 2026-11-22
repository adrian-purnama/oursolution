import { MousePointer2 } from 'lucide-react'
import type { HTMLAttributes } from 'react'

/**
 * The three teammates whose cursors build the landing page: the hero on
 * load, and the sections as they scroll in. `from` and `to` are where each
 * flies in from and leaves to, off screen, as fractions of the window: each
 * one uses its own edges.
 */
export const BUILDERS = [
  {
    name: 'Design',
    color: 'var(--accent)',
    from: { x: -0.1, y: -0.12 },
    to: { x: -0.12, y: 0.75 },
  },
  {
    name: 'Dev',
    color: 'var(--navy)',
    from: { x: 1.1, y: 0.35 },
    to: { x: 0.85, y: -0.15 },
  },
  {
    name: 'Ops',
    color: '#059669',
    from: { x: 0.3, y: 1.15 },
    to: { x: 1.12, y: 1.1 },
  },
] as const

export type Builder = (typeof BUILDERS)[number]

/** One move of a cursor, and the frame it drags out alongside. */
export const MOVE = { duration: 0.42, ease: 'power2.inOut' }

/**
 * A point given as fractions of the window (below 0 or above 1 is off
 * screen), in the coordinates of `root`, which clips what is outside.
 */
export function offscreen(root: HTMLElement, point: { x: number; y: number }) {
  const box = root.getBoundingClientRect()
  return {
    x: window.innerWidth * point.x - box.left,
    y: window.innerHeight * point.y - box.top,
  }
}

/** A builder's labelled cursor, moved from its top left corner. */
export function BuilderCursor({
  builder,
  ...rest
}: { builder: Builder } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="absolute top-0 left-0 opacity-0" {...rest}>
      <MousePointer2
        className="size-5 text-white drop-shadow-[0_1px_2px_rgba(12,12,11,0.35)]"
        style={{ fill: builder.color }}
      />
      <span
        className="absolute top-4 left-4 rounded-full rounded-tl-sm px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow-[0_4px_10px_-4px_rgba(12,12,11,0.4)]"
        style={{ backgroundColor: builder.color }}
      >
        {builder.name}
      </span>
    </div>
  )
}

const CORNERS = [
  '-top-1 -left-1',
  '-top-1 -right-1',
  '-bottom-1 -left-1',
  '-right-1 -bottom-1',
]

/** The selection frame a builder drags out, with a handle on each corner. */
export function BuildFrame({
  builder,
  ...rest
}: { builder: Builder } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="absolute top-0 left-0 border-[1.5px] opacity-0"
      style={{
        borderColor: builder.color,
        backgroundColor: `color-mix(in srgb, ${builder.color} 7%, transparent)`,
      }}
      {...rest}
    >
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={`absolute ${corner} size-2 border-[1.5px] bg-white`}
          style={{ borderColor: builder.color }}
        />
      ))}
    </div>
  )
}
