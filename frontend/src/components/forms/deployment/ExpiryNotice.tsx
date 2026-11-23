import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarClock, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { expiryOf, formatDaysLeft } from '#/lib/deployment'
import type { Deployment, Expiry } from '#/lib/deployment'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

const DISMISS_KEY = 'expiry-notice-dismissed'

type Row = { deployment: Deployment; expiry: Expiry }

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

function describe({ deployment, expiry }: Row): string {
  return expiry.kind === 'expired'
    ? m.expiry_expired({ name: deployment.product.name })
    : m.expiry_ends({
        name: deployment.product.name,
        when: formatDaysLeft(expiry.daysLeft),
      })
}

/**
 * A quiet reminder of services whose subscription has ended or ends soon.
 * Dismissing hides it until the set of services in question changes.
 */
export default function ExpiryNotice({
  deployments,
  className,
}: {
  deployments: Deployment[]
  className?: string
}) {
  const rows: Row[] = deployments.flatMap((deployment) => {
    const expiry = expiryOf(deployment)
    return expiry ? [{ deployment, expiry }] : []
  })
  // Expired first, then by how soon they end.
  rows.sort((a, b) => {
    const rank = (row: Row) =>
      row.expiry.kind === 'expired' ? -1 : row.expiry.daysLeft
    return rank(a) - rank(b)
  })
  const signature = rows
    .map((row) => `${row.deployment.product.id}:${row.expiry.kind}`)
    .join(',')

  const [dismissed, setDismissed] = useState<string | null>(null)
  useEffect(() => setDismissed(readDismissed()), [])

  if (rows.length === 0 || dismissed === signature) return null

  function dismiss() {
    setDismissed(signature)
    try {
      window.localStorage.setItem(DISMISS_KEY, signature)
    } catch {
      // Hidden for this visit only.
    }
  }

  const anyExpired = rows.some((row) => row.expiry.kind === 'expired')
  const [first, ...rest] = rows

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2 pr-2 pl-3 text-sm',
        className,
      )}
    >
      <CalendarClock
        className={cn(
          'size-4 shrink-0',
          anyExpired ? 'text-[var(--destructive)]' : 'text-amber-600',
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 truncate">
        {describe(first)}
        {rest.length > 0 ? (
          <span className="text-[var(--muted)]">
            {' '}
            {rest.length === 1
              ? m.expiry_and_more_one()
              : m.expiry_and_more_other({ count: rest.length })}
          </span>
        ) : (
          <span className="text-[var(--muted)]">
            {first.expiry.kind === 'expired'
              ? m.expiry_extend_on()
              : m.expiry_extend_keep()}
          </span>
        )}
      </p>
      {rest.length === 0 ? (
        <Button asChild size="xs" variant="outline">
          <Link
            to="/checkout"
            search={{ productId: first.deployment.product.id }}
            className="no-underline"
          >
            {m.expiry_extend()}
          </Link>
        </Button>
      ) : (
        <Button asChild size="xs" variant="outline">
          <Link
            to="/profile"
            search={{ tab: 'products' }}
            className="no-underline"
          >
            {m.expiry_review()}
          </Link>
        </Button>
      )}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={m.common_dismiss()}
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
