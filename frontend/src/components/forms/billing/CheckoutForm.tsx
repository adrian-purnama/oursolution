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
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { ApiResponse } from '#/lib/api'
import { formatIdr, periodLabel, syncBasket } from '#/lib/billing'
import type {
  CheckoutItem,
  CheckoutLine,
  CheckoutQuote,
  CheckoutResult,
  Payment,
  PaymentList,
} from '#/lib/billing'
import { PRODUCT_KIND_LABELS } from '#/lib/product'
import { cn } from '#/lib/utils'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; quote: CheckoutQuote }

/**
 * The checkout page. Without `productId` it is the user's basket; with it,
 * "Buy now" for that one product, leaving the basket alone.
 */
export default function CheckoutForm({
  productId,
  quantity = 1,
}: {
  productId?: string
  quantity?: number
}) {
  const direct = Boolean(productId)
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  // Buy now keeps its items here instead of in the basket.
  const directItems = useRef<CheckoutItem[]>(
    productId ? [{ productId, quantity }] : [],
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
          message: res.message || 'Could not load your checkout',
        })
        return
      }
      setState({ status: 'ready', quote: res.data })
      if (!direct) syncBasket(res.data)
    } catch {
      setState({ status: 'error', message: 'Unable to reach the server' })
    }
  }

  useEffect(() => {
    directItems.current = productId ? [{ productId, quantity }] : []
    void load()
  }, [productId, quantity])

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

  async function setQuantity(line: CheckoutLine, next: number) {
    const id = line.product.id
    setBusyLine(id)
    try {
      if (direct) {
        directItems.current = directItems.current.map((item) =>
          item.productId === id ? { ...item, quantity: next } : item,
        )
        applyQuote(await priceDirect(), 'Could not update the quantity')
      } else {
        applyQuote(
          await apiFetch<CheckoutQuote>(`/me/basket/items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: next }),
          }),
          'Could not update the quantity',
        )
      }
    } catch {
      toast.error('Unable to reach the server')
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
      setState({
        status: 'ready',
        quote: { lines: [], totalIdr: 0, canCheckout: false },
      })
      return
    }
    setBusyLine(id)
    try {
      applyQuote(
        await apiFetch<CheckoutQuote>(`/me/basket/items/${id}`, {
          method: 'DELETE',
        }),
        'Could not remove the product',
      )
    } catch {
      toast.error('Unable to reach the server')
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
          })),
          fromBasket: !direct,
        }),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Checkout failed')
        // Prices or availability may have changed: show the fresh state.
        void load()
        return
      }
      if (!direct) syncBasket({ lines: [], totalIdr: 0, canCheckout: false })
      if (res.data.status === 'paid') {
        toast.success('Payment received')
        await refreshAuth()
      }
      // The invoice page shows Midtrans' payment form and waits for it.
      void navigate({
        to: '/billing/$paymentId',
        params: { paymentId: res.data.paymentId },
      })
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setPaying(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading your checkout…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
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
          {direct ? 'Nothing to buy' : 'Your basket is empty'}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pick a product on the pricing page.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/pricing">Browse the shop</Link>
        </Button>
      </div>
    )
  }

  const blocked = quote.lines.some((line) => line.problem)

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <section aria-label="Products">
        {direct ? (
          <p className="mb-4 text-sm text-[var(--muted)]">
            Buying now. Your basket stays as it is.{' '}
            <Link to="/checkout" className="text-[var(--ink)] underline">
              Go to basket
            </Link>
          </p>
        ) : null}
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {quote.lines.map((line) => (
            <CheckoutLineRow
              key={line.product.id}
              line={line}
              busy={busyLine === line.product.id || paying}
              onQuantity={(next) => void setQuantity(line, next)}
              onRemove={() => void remove(line)}
            />
          ))}
        </ul>
      </section>

      <aside className="h-fit rounded-xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {quote.lines.map((line) => (
            <div key={line.product.id} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate text-[var(--muted)]">
                {line.product.name}
                {line.quantity > 1 ? ` × ${line.quantity}` : ''}
              </dt>
              <dd className="shrink-0 tabular-nums">
                {formatIdr(line.amountIdr)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-[var(--line)] pt-4">
          <span className="text-sm font-medium">Total</span>
          <span className="font-display text-2xl tabular-nums">
            {formatIdr(quote.totalIdr)}
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
              Starting payment…
            </>
          ) : (
            `Pay ${formatIdr(quote.totalIdr)}`
          )}
        </Button>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {blocked
            ? 'Remove or fix the products marked above to continue.'
            : 'Pay by bank transfer, e-wallet, QRIS or card.'}
        </p>
        {openCheckout ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your unpaid checkout {openCheckout.invoiceNumber} (
            {formatIdr(openCheckout.amountIdr)}) will be cancelled and replaced
            by this one.
          </p>
        ) : null}
      </aside>
    </div>
  )
}

function CheckoutLineRow({
  line,
  busy,
  onQuantity,
  onRemove,
}: {
  line: CheckoutLine
  busy: boolean
  onQuantity: (next: number) => void
  onRemove: () => void
}) {
  const isSubscription = line.product.kind === 'subscription'
  const period = periodLabel(line.quantity, line.durationDays)

  return (
    <li className="flex gap-4 py-5">
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
              {formatIdr(line.unitPriceIdr)}
              {line.durationDays !== null
                ? ` per ${line.durationDays} days`
                : ''}
            </p>
          </div>
          <p className="shrink-0 font-medium tabular-nums">
            {formatIdr(line.amountIdr)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {isSubscription ? (
            <div className="flex items-center gap-3">
              <div
                className="inline-flex items-center rounded-md border border-[var(--line)]"
                role="group"
                aria-label={`Periods of ${line.product.name}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy || line.quantity <= 1}
                  onClick={() => onQuantity(line.quantity - 1)}
                  aria-label="One period less"
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
                  aria-label="One period more"
                >
                  <Plus className="size-3.5" aria-hidden />
                </Button>
              </div>
              <span className="text-xs text-[var(--muted)]">{period}</span>
            </div>
          ) : (
            <span className="text-xs text-[var(--muted)]">
              Quantity 1 · yours to keep
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
            Remove
          </Button>
        </div>

        {line.problem ? (
          <p className={cn('flex items-center gap-1.5 text-sm text-red-600')}>
            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
            {line.problem}
          </p>
        ) : null}
      </div>
    </li>
  )
}
