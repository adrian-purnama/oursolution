import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import PaddlePay from '#/components/forms/billing/PaddlePay'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import {
  applyUpgrade,
  cancelRenewal,
  cardTransactionId,
  formatDateTime,
  formatMoney,
  openBillingPortal,
  previewUpgrade,
  resumeRenewal,
  upgradeChoices,
} from '#/lib/billing'
import type {
  RenewingSubscription,
  UpgradeChoice,
  UpgradePreview,
} from '#/lib/billing'
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

function errorText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : m.billing_renewal_failed()
}

/**
 * Subscriptions Paddle renews for the user (billed outside Indonesia): stop
 * or resume renewing and change the card here, with Paddle's own page as a
 * fallback. Shows nothing for users who never paid with Paddle.
 */
export default function RenewingSubscriptions() {
  const [items, setItems] = useState<RenewingSubscription[]>([])
  const [opening, setOpening] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [card, setCard] = useState<{
    id: string
    transactionId: string
  } | null>(null)

  const [upgrade, setUpgrade] = useState<{
    id: string
    choices: UpgradeChoice[]
    preview: UpgradePreview | null
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<RenewingSubscription[]>('/me/subscriptions')
      if (res.success && res.data) setItems(res.data)
    } catch {
      // Keep what is shown.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: string, run: () => Promise<void>) {
    setBusyId(id)
    try {
      await run()
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setBusyId(null)
    }
  }

  function stopRenewing(subscription: RenewingSubscription) {
    const name = subscription.products.map((p) => p.name).join(', ')
    if (!window.confirm(m.billing_renewal_cancel_confirm({ name }))) return
    void act(subscription.id, async () => {
      await cancelRenewal(subscription.id)
      await load()
    })
  }

  function keepRenewing(subscription: RenewingSubscription) {
    void act(subscription.id, async () => {
      await resumeRenewal(subscription.id)
      await load()
    })
  }

  function openUpgrade(subscription: RenewingSubscription) {
    if (upgrade?.id === subscription.id) {
      setUpgrade(null)
      return
    }
    void act(subscription.id, async () => {
      const choices = await upgradeChoices(subscription.id)
      setUpgrade({ id: subscription.id, choices, preview: null })
    })
  }

  function pickUpgrade(subscription: RenewingSubscription, variantId: string) {
    if (!upgrade || !variantId) return
    void act(subscription.id, async () => {
      const preview = await previewUpgrade(subscription.id, variantId)
      setUpgrade({ ...upgrade, preview })
    })
  }

  function confirmUpgrade(subscription: RenewingSubscription) {
    const variantId = upgrade?.preview?.variantId
    if (!variantId) return
    void act(subscription.id, async () => {
      await applyUpgrade(subscription.id, variantId)
      setUpgrade(null)
      toast.success(m.billing_upgrade_done())
      await load()
    })
  }

  function changeCard(subscription: RenewingSubscription) {
    void act(subscription.id, async () => {
      const transactionId = await cardTransactionId(subscription.id)
      setCard({ id: subscription.id, transactionId })
    })
  }

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
        {items.map((subscription) => {
          const live =
            subscription.status === 'active' ||
            subscription.status === 'trialing' ||
            subscription.status === 'past_due'
          const busy = busyId === subscription.id
          return (
            <li key={subscription.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="min-w-0 font-medium text-[var(--ink)]">
                  {subscription.products.map((p) => p.name).join(', ')}
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
              </div>
              {live ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => changeCard(subscription)}
                  >
                    {m.billing_renewal_card()}
                  </Button>
                  {subscription.status === 'active' &&
                  !subscription.cancelsAt &&
                  subscription.products.length === 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => openUpgrade(subscription)}
                    >
                      {m.billing_upgrade_open()}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      subscription.cancelsAt
                        ? keepRenewing(subscription)
                        : stopRenewing(subscription)
                    }
                  >
                    {subscription.cancelsAt
                      ? m.billing_renewal_resume()
                      : m.billing_renewal_cancel()}
                  </Button>
                </div>
              ) : null}
              {upgrade?.id === subscription.id ? (
                <div className="mt-3 space-y-3 rounded-lg border border-[var(--line)] p-3">
                  {upgrade.choices.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">
                      {m.billing_upgrade_none()}
                    </p>
                  ) : (
                    <>
                      <select
                        className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                        defaultValue=""
                        disabled={busy}
                        onChange={(event) =>
                          pickUpgrade(subscription, event.target.value)
                        }
                      >
                        <option value="" disabled>
                          {m.billing_upgrade_preview()}
                        </option>
                        {upgrade.choices.map((choice) => (
                          <option key={choice.variantId} value={choice.variantId}>
                            {choice.name} · {formatMoney(choice.priceCents, 'USD')}
                          </option>
                        ))}
                      </select>
                      {upgrade.preview ? (
                        <p className="text-xs text-[var(--muted)]">
                          {(upgrade.preview.credit
                            ? m.billing_upgrade_credit
                            : m.billing_upgrade_pay)({
                            amount: formatMoney(upgrade.preview.amountCents, 'USD'),
                            name: upgrade.preview.name,
                            date: upgrade.preview.nextBilledAt
                              ? formatDateTime(upgrade.preview.nextBilledAt)
                              : '',
                            renewal: formatMoney(upgrade.preview.renewalCents, 'USD'),
                          })}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || !upgrade.preview}
                        onClick={() => confirmUpgrade(subscription)}
                      >
                        {m.billing_upgrade_confirm()}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
              {card?.id === subscription.id ? (
                <div className="mt-3 rounded-lg border border-[var(--line)]">
                  <PaddlePay
                    transactionId={card.transactionId}
                    onChange={() => {
                      setCard(null)
                      void load()
                    }}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
