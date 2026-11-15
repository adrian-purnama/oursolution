import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Info, TriangleAlert } from 'lucide-react'
import Markdown from '#/components/Markdown'
import type { ProductNotice } from '#/lib/product'
import { cn } from '#/lib/utils'

/**
 * Wraps a card and hangs a small "Notices" pull tab off its bottom border.
 * Pressing the tab slides a drawer out from under the card listing every
 * notice, warnings first. Without notices the card renders unchanged.
 */
export default function ProductNotices({
  notices,
  children,
  className,
}: {
  notices: ProductNotice[]
  /** The card the tab attaches to. */
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const drawerId = useId()
  if (notices.length === 0) return <>{children}</>

  const warnings = notices.filter((notice) => notice.tone === 'warning')
  const ordered = [
    ...warnings,
    ...notices.filter((notice) => notice.tone !== 'warning'),
  ]

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="relative z-10">{children}</div>

      {open ? (
        <ul
          id={drawerId}
          aria-label="Notices"
          className="mx-3 -mt-px divide-y divide-[var(--line)] rounded-b-lg border border-[var(--line)] bg-[var(--surface)]"
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
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          '-mt-px inline-flex items-center gap-1.5 self-end rounded-b-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]',
          open ? 'mr-7' : 'mr-4',
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
    </div>
  )
}
