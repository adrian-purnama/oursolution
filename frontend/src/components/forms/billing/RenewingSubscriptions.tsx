import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowRightLeft,
  Ban,
  CalendarClock,
  Check,
  CircleAlert,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  Receipt,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react'
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

type Tone = 'good' | 'bad' | 'warn' | 'idle'

const TONES: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  bad: 'bg-red-50 text-red-700 ring-red-600/15',
  warn: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  idle: 'bg-slate-100 text-slate-600 ring-slate-500/15',
}

/** The pill next to a subscription's name. */
function statusOf(s: RenewingSubscription): { label: string; tone: Tone } {
  if (s.status === 'past_due') {
    return { label: m.billing_status_past_due(), tone: 'bad' }
  }
  if (s.status === 'paused') {
    return { label: m.billing_renewals_paused(), tone: 'idle' }
  }
  if (s.status === 'canceled') {
    return { label: m.billing_renewals_ended(), tone: 'idle' }
  }
  if (s.cancelsAt) return { label: m.billing_status_ending(), tone: 'warn' }
  return { label: m.billing_status_active(), tone: 'good' }
}

/** The line under the name: when it renews or ends. */
function whenLine(s: RenewingSubscription): string {
  if (s.cancelsAt) {
    return m.billing_renewals_cancels({ date: formatDateTime(s.cancelsAt) })
  }
  return s.nextBilledAt
    ? m.billing_renewals_next({ date: formatDateTime(s.nextBilledAt) })
    : ''
}

const TILE_COLORS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
]

/** A coloured tile with the product's first letter, steady per product. */
function ProductTile({ name, seed }: { name: string; seed: string }) {
  const hash = [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-base font-semibold text-white shadow-sm ${TILE_COLORS[hash % TILE_COLORS.length]}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : m.billing_renewal_failed()
}

function ActionButton({
  icon,
  children,
  onClick,
  disabled,
  active = false,
  tone = 'default',
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={
        tone === 'danger'
          ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
          : undefined
      }
    >
      {icon}
      {children}
    </Button>
  )
}

/**
 * Subscriptions Paddle renews for the user (billed outside Indonesia): see
 * when each renews, change plan or card, and stop or resume renewing, with
 * Paddle's own page as a fallback. Shows nothing for users who never paid
 * with Paddle.
 */
export default function RenewingSubscriptions() {
  const [items, setItems] = useState<RenewingSubscription[]>([])
  const [opening, setOpening] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [card, setCard] = useState<{
    id: string
    transactionId: string
  } | null>(null)
  const [plan, setPlan] = useState<{
    id: string
    choices: UpgradeChoice[]
    picked: string | null
    preview: UpgradePreview | null
    loadingPreview: boolean
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

  function stopRenewing(s: RenewingSubscription) {
    const name = s.products.map((p) => p.name).join(', ')
    if (!window.confirm(m.billing_renewal_cancel_confirm({ name }))) return
    void act(s.id, async () => {
      await cancelRenewal(s.id)
      await load()
    })
  }

  function keepRenewing(s: RenewingSubscription) {
    void act(s.id, async () => {
      await resumeRenewal(s.id)
      await load()
    })
  }

  function changeCard(s: RenewingSubscription) {
    setPlan(null)
    if (card?.id === s.id) {
      setCard(null)
      return
    }
    void act(s.id, async () => {
      const transactionId = await cardTransactionId(s.id)
      setCard({ id: s.id, transactionId })
    })
  }

  function togglePlan(s: RenewingSubscription) {
    setCard(null)
    if (plan?.id === s.id) {
      setPlan(null)
      return
    }
    void act(s.id, async () => {
      const choices = await upgradeChoices(s.id)
      setPlan({
        id: s.id,
        choices,
        picked: null,
        preview: null,
        loadingPreview: false,
      })
    })
  }

  async function pickPlan(s: RenewingSubscription, variantId: string) {
    if (!plan) return
    setPlan({ ...plan, picked: variantId, preview: null, loadingPreview: true })
    try {
      const preview = await previewUpgrade(s.id, variantId)
      setPlan((current) =>
        current && current.picked === variantId
          ? { ...current, preview, loadingPreview: false }
          : current,
      )
    } catch (error) {
      toast.error(errorText(error))
      setPlan((current) =>
        current ? { ...current, picked: null, loadingPreview: false } : current,
      )
    }
  }

  function confirmPlan(s: RenewingSubscription) {
    const variantId = plan?.preview?.variantId
    if (!variantId) return
    void act(s.id, async () => {
      await applyUpgrade(s.id, variantId)
      setPlan(null)
      toast.success(m.billing_upgrade_done())
      await load()
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
      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 via-white to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <RefreshCw className="size-5" aria-hidden />
          </span>
          <div>
            <h3
              id="renewals-title"
              className="text-base font-semibold text-[var(--ink)]"
            >
              {m.billing_renewals_title()}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {m.billing_renewals_subtitle()}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={opening}
          onClick={() => void manage()}
          className="text-[var(--muted)]"
        >
          {opening ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <ExternalLink aria-hidden />
          )}
          {m.billing_manage()}
        </Button>
      </header>

      <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        {items.map((s) => {
          const live =
            s.status === 'active' ||
            s.status === 'trialing' ||
            s.status === 'past_due'
          const busy = busyId === s.id
          const status = statusOf(s)
          const name = s.products.map((p) => p.name).join(', ')
          const canChangePlan =
            s.status === 'active' && !s.cancelsAt && s.products.length === 1
          const panelPlan = plan?.id === s.id ? plan : null

          return (
            <li key={s.id} className="space-y-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <ProductTile name={name} seed={s.products[0]?.productId ?? s.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--ink)]">
                      {name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[status.tone]}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {whenLine(s) ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {whenLine(s)}
                    </p>
                  ) : null}
                </div>
              </div>

              {s.status === 'past_due' ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {m.billing_renewals_past_due()}
                </div>
              ) : null}

              {live ? (
                <div className="flex flex-wrap items-center gap-2">
                  {canChangePlan ? (
                    <ActionButton
                      icon={<ArrowRightLeft />}
                      active={panelPlan !== null}
                      disabled={busy}
                      onClick={() => togglePlan(s)}
                    >
                      {m.billing_upgrade_open()}
                    </ActionButton>
                  ) : null}
                  <ActionButton
                    icon={<CreditCard />}
                    active={card?.id === s.id}
                    disabled={busy}
                    onClick={() => changeCard(s)}
                  >
                    {m.billing_renewal_card()}
                  </ActionButton>
                  <span className="ml-auto">
                    {s.cancelsAt ? (
                      <ActionButton
                        icon={<RotateCcw />}
                        disabled={busy}
                        onClick={() => keepRenewing(s)}
                      >
                        {m.billing_renewal_resume()}
                      </ActionButton>
                    ) : (
                      <ActionButton
                        icon={<Ban />}
                        tone="danger"
                        disabled={busy}
                        onClick={() => stopRenewing(s)}
                      >
                        {m.billing_renewal_cancel()}
                      </ActionButton>
                    )}
                  </span>
                </div>
              ) : null}

              {panelPlan ? (
                <div className="space-y-3 rounded-xl border border-[var(--line)] bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {m.billing_upgrade_preview()}
                    </p>
                    <button
                      type="button"
                      aria-label={m.billing_panel_close()}
                      onClick={() => setPlan(null)}
                      className="rounded-md p-1 text-[var(--muted)] hover:bg-white"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>

                  {panelPlan.choices.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">
                      {m.billing_upgrade_none()}
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {panelPlan.choices.map((choice) => {
                        const picked = panelPlan.picked === choice.variantId
                        return (
                          <button
                            key={choice.variantId}
                            type="button"
                            disabled={busy}
                            onClick={() => void pickPlan(s, choice.variantId)}
                            className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 text-left transition ${
                              picked
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                                : 'border-[var(--line)] hover:border-indigo-300'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-[var(--ink)]">
                                {choice.name}
                              </span>
                              <span className="text-xs text-[var(--muted)]">
                                {formatMoney(choice.priceCents, 'USD')}{' '}
                                {m.billing_upgrade_per_renewal()}
                              </span>
                            </span>
                            {picked ? (
                              <Check
                                className="size-4 shrink-0 text-indigo-600"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {panelPlan.loadingPreview ? (
                    <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                      {m.billing_upgrade_calculating()}
                    </p>
                  ) : null}

                  {panelPlan.preview ? (
                    <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-[var(--line)]">
                      <Receipt
                        className="mt-0.5 size-5 shrink-0 text-indigo-600"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--muted)]">
                          {panelPlan.preview.credit
                            ? m.billing_upgrade_credit_label()
                            : m.billing_upgrade_due_label()}
                        </p>
                        <p className="text-lg font-semibold text-[var(--ink)]">
                          {formatMoney(panelPlan.preview.amountCents, 'USD')}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {(panelPlan.preview.credit
                            ? m.billing_upgrade_credit
                            : m.billing_upgrade_pay)({
                            amount: formatMoney(
                              panelPlan.preview.amountCents,
                              'USD',
                            ),
                            name: panelPlan.preview.name,
                            date: panelPlan.preview.nextBilledAt
                              ? formatDateTime(panelPlan.preview.nextBilledAt)
                              : '',
                            renewal: formatMoney(
                              panelPlan.preview.renewalCents,
                              'USD',
                            ),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => confirmPlan(s)}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" aria-hidden />
                        ) : (
                          <Check aria-hidden />
                        )}
                        {m.billing_upgrade_confirm()}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {card?.id === s.id ? (
                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
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
