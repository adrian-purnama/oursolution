import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { formatDateTime, formatIdr } from '#/lib/billing'
import type { PaymentList } from '#/lib/billing'
import { cn } from '#/lib/utils'

/**
 * A reminder of invoices that can still be paid. Shows nothing when there
 * are none, or when they cannot be loaded.
 */
export default function UnpaidNotice({ className }: { className?: string }) {
  const [list, setList] = useState<PaymentList | null>(null)

  useEffect(() => {
    let active = true
    void apiFetch<PaymentList>('/me/payments?status=unpaid&pageSize=3')
      .then((res) => {
        if (active && res.success && res.data) setList(res.data)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const first = list?.items.at(0)
  if (!list || !first) return null
  const more = list.total > 1

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Clock className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ink)]">
            {more
              ? `You have ${list.total} unpaid invoices`
              : `Invoice ${first.invoiceNumber} is waiting for payment`}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {more
              ? `The next one, ${first.invoiceNumber} (${formatIdr(first.amountIdr)}), expires ${formatDateTime(first.expiresAt)}.`
              : `${formatIdr(first.amountIdr)} · pay before ${formatDateTime(first.expiresAt)}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {more ? (
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile" search={{ tab: 'billing' }}>
              See all
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm">
          <Link to="/billing/$paymentId" params={{ paymentId: first.id }}>
            Pay now
          </Link>
        </Button>
      </div>
    </div>
  )
}
