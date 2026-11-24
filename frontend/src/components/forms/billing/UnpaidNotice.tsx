import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { formatDateTime, formatMoney } from '#/lib/billing'
import type { PaymentList } from '#/lib/billing'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

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
              ? m.unpaid_many({ count: list.total })
              : m.unpaid_one({ number: first.invoiceNumber })}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {more
              ? m.unpaid_next({
                  number: first.invoiceNumber,
                  amount: formatMoney(first.amount, first.currency),
                  date: formatDateTime(first.expiresAt),
                })
              : m.unpaid_pay_before({
                  amount: formatMoney(first.amount, first.currency),
                  date: formatDateTime(first.expiresAt),
                })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {more ? (
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile" search={{ tab: 'billing' }}>
              {m.unpaid_see_all()}
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm">
          <Link to="/billing/$paymentId" params={{ paymentId: first.id }}>
            {m.unpaid_pay_now()}
          </Link>
        </Button>
      </div>
    </div>
  )
}
