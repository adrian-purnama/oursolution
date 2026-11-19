import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Info, TriangleAlert } from 'lucide-react'
import Markdown from '#/components/Markdown'
import type { ProductNotice } from '#/lib/product'
import { cn } from '#/lib/utils'

/**
 * Wraps a card and attaches a small "Notices" tab to it, listing every
 * notice, warnings first. Without notices the card renders unchanged.
 *
 * - `bottom`: the tab hangs off the card's bottom border and a drawer
 *   slides out from under the card.
 * - `top`: the tab is strapped onto the card's top-right corner and the
 *   list drops down over the card, so nothing below it moves.
 */
export default function ProductNotices({
  notices,
  children,
  className,
  placement = 'bottom',
  tabTour,
}: {
  notices: ProductNotice[]
  /** The card the tab attaches to. */
  children: ReactNode
  className?: string
  placement?: 'bottom' | 'top'
  /** Marks the tab for a guided tour. */
  tabTour?: string
}) {
  const [open, setOpen] = useState(false)
  const drawerId = useId()
  const strap = useRef<HTMLDivElement>(null)

  // The dropped-down list closes on Escape or a press outside it.
  useEffect(() => {
    if (!open || placement !== 'top') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: PointerEvent) => {
      if (!strap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, placement])

  if (notices.length === 0) return <>{children}</>

  const warnings = notices.filter((notice) => notice.tone === 'warning')
  const ordered = [
    ...warnings,
    ...notices.filter((notice) => notice.tone !== 'warning'),
  ]
  const top = placement === 'top'

  const list = (
    <ul
      id={drawerId}
      aria-label="Notices"
      className={cn(
        'divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--surface)]',
        top
          ? 'absolute top-full right-0 z-20 -mt-px max-h-[min(24rem,60vh)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg rounded-tr-none shadow-lg'
          : 'mx-3 -mt-px rounded-b-lg',
      )}
    >
      {ordered.map((notice, index) => {
        const warning = notice.tone === 'warning'
        const Icon = warning ? TriangleAlert : Info
        return (
          <li key={index} className="flex gap-3 px-4 py-3 text-sm">
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                warning ? 'text-amber-500' : 'text-[var(--muted)]',
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              {warning ? (
                <span className="mb-0.5 block text-xs font-medium text-amber-700">
                  Heads up
                </span>
              ) : (
                <span className="sr-only">Note: </span>
              )}
              <Markdown className="prose-p:my-0 prose-ul:my-1">
                {notice.text}
              </Markdown>
            </div>
          </li>
        )
      })}
    </ul>
  )

  const tab = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={drawerId}
      data-tour={tabTour}
      onClick={() => setOpen((value) => !value)}
      className={cn(
        'relative z-30 inline-flex items-center gap-1.5 border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]',
        top ? 'rounded-t-md border-b-0 pb-1.5' : '-mt-px self-end rounded-b-md',
        !top && (open ? 'mr-7' : 'mr-4'),
      )}
    >
      <Info className="size-3.5" aria-hidden />
      Notices
      <span className="rounded-full bg-[var(--line)] px-1.5 text-[10px] leading-4 font-medium text-[var(--ink)]">
        {notices.length}
      </span>
      {warnings.length > 0 ? (
        <span
          className="size-1.5 rounded-full bg-amber-500"
          aria-label={`${warnings.length} to read before buying`}
        />
      ) : null}
      <ChevronDown
        className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  )

  if (top) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div ref={strap} className="relative mr-4 -mb-px self-end">
          {tab}
          {open ? list : null}
        </div>
        <div>{children}</div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative z-10">{children}</div>
      {open ? list : null}
      {tab}
    </div>
  )
}
