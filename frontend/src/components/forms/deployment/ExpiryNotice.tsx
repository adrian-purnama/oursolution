import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarClock, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { expiryOf, formatDaysLeft } from '#/lib/deployment'
import type { Deployment, Expiry } from '#/lib/deployment'
import { cn } from '#/lib/utils'

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
    ? `${deployment.product.name} has expired`
    : `${deployment.product.name} ends ${formatDaysLeft(expiry.daysLeft)}`
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
            and {rest.length} more {rest.length === 1 ? 'service' : 'services'}
          </span>
        ) : (
          <span className="text-[var(--muted)]">
            {first.expiry.kind === 'expired'
              ? '. Extend it to turn it back on.'
              : '. Extend it to keep it running.'}
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
            Extend
          </Link>
        </Button>
      ) : (
        <Button asChild size="xs" variant="outline">
          <Link
            to="/profile"
            search={{ tab: 'products' }}
            className="no-underline"
          >
            Review
          </Link>
        </Button>
      )}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
