import { Info, TriangleAlert } from 'lucide-react'
import Markdown from '#/components/Markdown'
import type { ProductNotice } from '#/lib/product'
import { cn } from '#/lib/utils'

const TONE_CLASSES: Record<ProductNotice['tone'], string> = {
  info: 'border-[var(--line)] bg-[var(--surface)]',
  warning: 'border-amber-200 bg-amber-50',
}

/** A product's rules and disclaimers, warnings drawn in amber. */
export default function ProductNotices({
  notices,
  className,
}: {
  notices: ProductNotice[]
  className?: string
}) {
  if (notices.length === 0) return null
  return (
    <ul className={cn('space-y-2', className)}>
      {notices.map((notice, index) => {
        const Icon = notice.tone === 'warning' ? TriangleAlert : Info
        return (
          <li
            key={index}
            className={cn(
              'flex gap-3 rounded-lg border px-4 py-3',
              TONE_CLASSES[notice.tone],
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                notice.tone === 'warning'
                  ? 'text-amber-600'
                  : 'text-[var(--muted)]',
              )}
              aria-label={notice.tone === 'warning' ? 'Warning' : 'Note'}
            />
            <Markdown className="min-w-0 flex-1 prose-p:my-0 prose-ul:my-1">
              {notice.text}
            </Markdown>
          </li>
        )
      })}
    </ul>
  )
}
