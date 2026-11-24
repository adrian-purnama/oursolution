import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import ProductImage from '#/components/forms/product/ProductImage'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { ApiResponse } from '#/lib/api'
import { emptyQuote, formatMoney, periodLabel, syncBasket } from '#/lib/billing'
import type {
  CheckoutItem,
  CheckoutLine,
  CheckoutQuote,
  CheckoutResult,
  Currency,
  Payment,
  PaymentList,
} from '#/lib/billing'
import { formatDateTime, PRODUCT_KIND_LABELS } from '#/lib/product'
import type { CheckoutPlacement, VariantApplyMode } from '#/lib/product'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; quote: CheckoutQuote }

/**
 * The checkout page. Without `productId` it is the user's basket; with it,
 * "Buy now" for that one product, leaving the basket alone.
 */
/** What a line can change besides its quantity. */
type LinePatch = {
  quantity?: number
  variantId?: string
  applyVariant?: VariantApplyMode
  placement?: CheckoutPlacement
}

export default function CheckoutForm({
  productId,
  quantity = 1,
  variantId,
}: {
  productId?: string
  quantity?: number
  /** Buy now: the subscription variant; none extends the user's. */
  variantId?: string
}) {
  const direct = Boolean(productId)
  const navigate = useNavigate()
  const { refreshAuth, user } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  // Buy now keeps its items here instead of in the basket.
  const directItems = useRef<CheckoutItem[]>(
    productId ? [{ productId, quantity, variantId }] : [],
  )

  function applyQuote(res: ApiResponse<CheckoutQuote>, fallback: string) {
    if (!res.success || !res.data) {
      toast.error(res.message || fallback)
      return false
    }
    setState({ status: 'ready', quote: res.data })
    if (!direct) syncBasket(res.data)
    return true
  }

  async function priceDirect() {
    return apiFetch<CheckoutQuote>('/me/checkout/quote', {
      method: 'POST',
      body: JSON.stringify({ items: directItems.current }),
    })
  }

  async function load() {
    setState({ status: 'loading' })
    try {
      const res = direct
        ? await priceDirect()
        : await apiFetch<CheckoutQuote>('/me/basket')
      if (!res.success || !res.data) {
        setState({
          status: 'error',
          message: res.message || m.checkout_load_failed(),
        })
        return
      }
      setState({ status: 'ready', quote: res.data })
      if (!direct) syncBasket(res.data)
    } catch {
      setState({ status: 'error', message: m.common_error_network_short() })
    }
  }

  useEffect(() => {
    directItems.current = productId ? [{ productId, quantity, variantId }] : []
    void load()
  }, [productId, quantity, variantId])

  // A new checkout voids the user's earlier unpaid one: say so before paying.
  const [openCheckout, setOpenCheckout] = useState<Payment | null>(null)
  useEffect(() => {
    let active = true
    void apiFetch<PaymentList>('/me/payments?status=unpaid&pageSize=20')
      .then((res) => {
        if (!active || !res.success || !res.data) return
        setOpenCheckout(
          res.data.items.find((payment) => payment.source !== 'admin') ?? null,
        )
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function updateLine(line: CheckoutLine, patch: LinePatch) {
    const id = line.product.id
    setBusyLine(id)
    try {
      if (direct) {
        directItems.current = directItems.current.map((item) =>
          item.productId === id ? { ...item, ...patch } : item,
        )
        applyQuote(await priceDirect(), m.checkout_update_failed())
      } else {
        applyQuote(
          await apiFetch<CheckoutQuote>(`/me/basket/items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }),
          m.checkout_update_failed(),
        )
      }
    } catch {
      toast.error(m.common_error_network_short())
    } finally {
      setBusyLine(null)
    }
  }

  async function remove(line: CheckoutLine) {
    const id = line.product.id
    if (direct) {
      directItems.current = directItems.current.filter(
        (item) => item.productId !== id,
      )
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', quote: emptyQuote(current.quote) }
          : current,
      )
      return
    }
    setBusyLine(id)
    try {
      applyQuote(
        await apiFetch<CheckoutQuote>(`/me/basket/items/${id}`, {
          method: 'DELETE',
        }),
        m.checkout_remove_failed(),
      )
    } catch {
      toast.error(m.common_error_network_short())
    } finally {
      setBusyLine(null)
    }
  }

  async function pay(quote: CheckoutQuote) {
    setPaying(true)
    try {
      const res = await apiFetch<CheckoutResult>('/me/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: quote.lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            ...(line.variant
              ? {
                  variantId: line.variant.id,
                  applyVariant: line.applyVariant ?? 'auto',
                  placement: line.placement ?? 'after',
                }
              : {}),
          })),
          fromBasket: !direct,
        }),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || m.checkout_failed())
        // Prices or availability may have changed: show the fresh state.
        void load()
        return
      }
      if (!direct) syncBasket(emptyQuote(quote))
      if (res.data.status === 'paid') {
        toast.success(m.checkout_paid())
        await refreshAuth()
      }
      // The invoice page shows the payment form (Midtrans or Paddle) and
      // waits for it.
      void navigate({
        to: '/billing/$paymentId',
        params: { paymentId: res.data.paymentId },
      })
    } catch {
      toast.error(m.common_error_network_short())
    } finally {
      setPaying(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {m.checkout_loading()}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          {m.common_retry()}
        </Button>
      </div>
    )
  }

  const { quote } = state

  if (quote.lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
        <ShoppingCart
          className="mx-auto mb-3 size-6 text-[var(--muted)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--ink)]">
          {direct ? m.checkout_nothing() : m.checkout_empty()}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{m.checkout_pick()}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/pricing">{m.common_browse_shop()}</Link>
        </Button>
      </div>
    )
  }

  const blocked = quote.lines.some((line) => line.problem)
  const money = (value: number) => formatMoney(value, quote.currency)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <section aria-label={m.checkout_products()} className="min-w-0">
        {direct ? (
          <p className="mb-4 text-sm text-[var(--muted)]">
            {m.checkout_buying_now()}{' '}
            <Link to="/checkout" className="text-[var(--ink)] underline">
              {m.checkout_go_basket()}
            </Link>
          </p>
        ) : null}
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {quote.lines.map((line) => (
            <CheckoutLineRow
              key={line.product.id}
              line={line}
              subscribed={
                user?.products.some((item) => item.id === line.product.id) ??
                false
              }
              currency={quote.currency}
              busy={busyLine === line.product.id || paying}
              onChange={(patch) => void updateLine(line, patch)}
              onRemove={() => void remove(line)}
            />
          ))}
        </ul>
      </section>

      <aside className="h-fit min-w-0 rounded-xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          {m.checkout_summary()}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          {quote.lines.map((line) => (
            <div key={line.product.id} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate text-[var(--muted)]">
                {line.product.name}
                {line.variants.length > 1 && line.variant
                  ? ` (${line.variant.name})`
                  : ''}
                {line.quantity > 1 ? ` × ${line.quantity}` : ''}
              </dt>
              <dd className="shrink-0 tabular-nums">{money(line.amount)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--line)] pt-4">
          <span className="text-sm font-medium">{m.common_total()}</span>
          <span className="font-display text-2xl tabular-nums">
            {money(quote.total)}
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          className="mt-5 w-full"
          disabled={!quote.canCheckout || paying || busyLine !== null}
          onClick={() => void pay(quote)}
        >
          {paying ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {m.checkout_starting()}
            </>
          ) : (
            m.invoice_pay_amount({ amount: money(quote.total) })
          )}
        </Button>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {blocked
            ? m.checkout_blocked()
            : quote.currency === 'USD'
              ? m.checkout_methods_intl()
              : m.checkout_methods()}
        </p>
        {openCheckout ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {m.checkout_replace({
              number: openCheckout.invoiceNumber,
              amount: formatMoney(openCheckout.amount, openCheckout.currency),
            })}
          </p>
        ) : null}
      </aside>
    </div>
  )
}

function CheckoutLineRow({
  line,
  currency,
  subscribed,
  busy,
  onChange,
  onRemove,
}: {
  line: CheckoutLine
  currency: Currency
  /** The user has this subscription already. */
  subscribed: boolean
  busy: boolean
  onChange: (patch: LinePatch) => void
  onRemove: () => void
}) {
  const isSubscription = line.product.kind === 'subscription'
  const period = periodLabel(line.quantity, line.durationDays)
  const onQuantity = (quantity: number) => onChange({ quantity })
  const hasVariants = line.variants.length > 1
  // Paddle renews it every period: one period at a time.
  const renews = currency === 'USD' && isSubscription

  return (
    <li className="flex gap-3 py-5 sm:gap-4">
      <Link
        to="/products/$productId"
        params={{ productId: line.product.id }}
        tabIndex={-1}
        aria-hidden
        className="shrink-0"
      >
        <ProductImage
          product={line.product}
          className="size-16 rounded-lg border border-[var(--line)] sm:size-20"
          iconClassName="size-5"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">
              {PRODUCT_KIND_LABELS[line.product.kind]}
            </p>
            <Link
              to="/products/$productId"
              params={{ productId: line.product.id }}
              className="font-medium text-[var(--ink)] no-underline hover:underline"
            >
              {line.product.name}
            </Link>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              {formatMoney(line.unitPrice, currency)}
              {line.durationDays !== null
                ? m.checkout_per_days({ days: line.durationDays })
                : ''}
            </p>
          </div>
          <p className="shrink-0 font-medium tabular-nums">
            {formatMoney(line.amount, currency)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {renews && line.durationDays !== null ? (
            <span className="text-xs text-[var(--muted)]">
              {m.checkout_renews_every({ days: line.durationDays })}
            </span>
          ) : isSubscription ? (
            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center rounded-md border border-[var(--line)]"
                role="group"
                aria-label={m.checkout_periods_of({ name: line.product.name })}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy || line.quantity <= 1}
                  onClick={() => onQuantity(line.quantity - 1)}
                  aria-label={m.checkout_one_less()}
                >
                  <Minus className="size-3.5" aria-hidden />
                </Button>
                <span
                  className="w-8 text-center text-sm tabular-nums"
                  aria-live="polite"
                >
                  {line.quantity}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy || line.quantity >= line.maxQuantity}
                  onClick={() => onQuantity(line.quantity + 1)}
                  aria-label={m.checkout_one_more()}
                >
                  <Plus className="size-3.5" aria-hidden />
                </Button>
              </div>
              <span className="text-xs text-[var(--muted)]">{period}</span>
            </div>
          ) : (
            <span className="text-xs text-[var(--muted)]">
              {m.checkout_quantity_one()}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onRemove}
            className="text-[var(--muted)]"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {m.common_remove()}
          </Button>
        </div>

        {isSubscription && hasVariants ? (
          <VariantChoices
            line={line}
            currency={currency}
            subscribed={renews ? false : subscribed}
            busy={busy}
            onChange={onChange}
          />
        ) : null}

        {line.problem ? (
          <p className={cn('flex items-start gap-1.5 text-sm text-red-600')}>
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {line.problem}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/** Radio options in a row, labelled as a group. */
function ChoiceGroup<T extends string>({
  name,
  legend,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string
  legend: string
  value: T
  options: { value: T; label: string }[]
  disabled: boolean
  onChange: (value: T) => void
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1 text-xs text-[var(--muted)]">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * A subscription line's variant and, for a subscriber, when it starts and
 * whether their service restarts on it by itself.
 */
function VariantChoices({
  line,
  currency,
  subscribed,
  busy,
  onChange,
}: {
  line: CheckoutLine
  currency: Currency
  subscribed: boolean
  busy: boolean
  onChange: (patch: LinePatch) => void
}) {
  const id = line.product.id
  const placement = line.placement ?? 'after'
  const applyVariant = line.applyVariant ?? 'auto'

  return (
    <div className="space-y-3 rounded-lg bg-[var(--surface)] px-3 py-3">
      <div className="space-y-1">
        <label
          htmlFor={`variant-${id}`}
          className="block text-xs text-[var(--muted)]"
        >
          {m.checkout_variant()}
        </label>
        <Select
          value={line.variant?.id}
          disabled={busy}
          onValueChange={(variantId) => onChange({ variantId })}
        >
          <SelectTrigger id={`variant-${id}`} className="w-full bg-white">
            <SelectValue placeholder={m.checkout_choose_variant()} />
          </SelectTrigger>
          <SelectContent>
            {line.variants.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name} · {formatMoney(option.unitPrice, currency)}
                {option.durationDays ? ` / ${option.durationDays} days` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {subscribed ? (
        <>
          <ChoiceGroup
            name={`placement-${id}`}
            legend={m.checkout_when_starts()}
            value={placement}
            disabled={busy}
            options={[
              { value: 'after', label: m.checkout_after_current() },
              { value: 'now', label: m.checkout_switch_now() },
            ]}
            onChange={(next) => onChange({ placement: next })}
          />
          {placement === 'now' && line.switch ? (
            <p className="text-xs text-[var(--muted)]">
              {m.checkout_switch_info({
                credit: formatMoney(line.switch.creditIdr, currency),
                bonus: line.switch.bonusDays,
                date: formatDateTime(line.switch.endsAt),
              })}
            </p>
          ) : null}
          <ChoiceGroup
            name={`apply-${id}`}
            legend={m.checkout_when_changes()}
            value={applyVariant}
            disabled={busy}
            options={[
              { value: 'auto', label: m.checkout_auto_restart() },
              { value: 'manual', label: m.checkout_manual_restart() },
            ]}
            onChange={(next) => onChange({ applyVariant: next })}
          />
        </>
      ) : null}
    </div>
  )
}
