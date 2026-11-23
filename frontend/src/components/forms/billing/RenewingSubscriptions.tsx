import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { formatDateTime, openBillingPortal } from '#/lib/billing'
import type { RenewingSubscription } from '#/lib/billing'
import { m } from '#/paraglide/messages'

function statusLine(subscription: RenewingSubscription): string {
  if (subscription.status === 'past_due') return m.billing_renewals_past_due()
  if (subscription.status === 'paused') return m.billing_renewals_paused()
  if (subscription.status === 'canceled') return m.billing_renewals_ended()
  if (subscription.cancelsAt) {
    return m.billing_renewals_cancels({
      date: formatDateTime(subscription.cancelsAt),
    })
  }
  return subscription.nextBilledAt
    ? m.billing_renewals_next({
        date: formatDateTime(subscription.nextBilledAt),
      })
    : ''
}

/**
 * Subscriptions Paddle renews for the user (billed outside Indonesia), with
 * a link to Paddle's page for cancelling or changing the card. Shows
 * nothing for users who never paid with Paddle.
 */
export default function RenewingSubscriptions() {
  const [items, setItems] = useState<RenewingSubscription[]>([])
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    let active = true
    void apiFetch<RenewingSubscription[]>('/me/subscriptions')
      .then((res) => {
        if (active && res.success && res.data) setItems(res.data)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function manage() {
    // Opened before the await, so the browser does not block the new tab.
    const tab = window.open('', '_blank')
    setOpening(true)
    try {
      const url = await openBillingPortal()
      if (!url) throw new Error()
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (error) {
      tab?.close()
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : m.billing_portal_failed(),
      )
    } finally {
      setOpening(false)
    }
  }

  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="renewals-title"
      className="rounded-xl border border-[var(--line)] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <h3
          id="renewals-title"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]"
        >
          <RefreshCw className="size-4 text-[var(--muted)]" aria-hidden />
          {m.billing_renewals_title()}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={opening}
          onClick={() => void manage()}
        >
          {opening ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="size-3.5" aria-hidden />
          )}
          {m.billing_manage()}
        </Button>
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {items.map((subscription) => (
          <li
            key={subscription.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
          >
            <span className="min-w-0 font-medium text-[var(--ink)]">
              {subscription.products.map((product) => product.name).join(', ')}
            </span>
            <span
              className={
                subscription.status === 'past_due'
                  ? 'text-xs text-red-600'
                  : 'text-xs text-[var(--muted)]'
              }
            >
              {statusLine(subscription)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
