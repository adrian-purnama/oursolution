import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { Check, LoaderCircle, Package } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch, toAbsoluteMediaUrl } from '#/lib/api'
import { formatDays } from '#/lib/product'
import type { PricingProduct } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; products: PricingProduct[] }

type CheckoutResult = {
  paymentId: string
  status: 'pending' | 'paid' | 'failed'
  redirectUrl: string | null
}

const GROUPS = [
  {
    kind: 'subscription',
    title: 'Hosting',
    hint: 'Runs for a period per checkout. Buy again to extend.',
  },
  {
    kind: 'oneTime',
    title: 'One-time purchases',
    hint: 'Pay once and keep it for good.',
  },
] as const

export default function PricingGrid({
  limit,
  grouped = true,
  preview,
}: {
  /** Show only the first few products (the landing page preview). */
  limit?: number
  /** Split hosting and one-time products into their own sections. */
  grouped?: boolean
  /**
   * Landing page use: wraps the grid in its own section, and renders nothing
   * while loading, on error, or when no product is published.
   */
  preview?: (grid: ReactNode) => ReactNode
}) {
  const { isAuthenticated, user, refreshAuth } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [buying, setBuying] = useState<string | null>(null)

  async function load() {
    setState({ status: 'loading' })
    try {
      const response = await apiFetch<PricingProduct[]>('/products/pricing')
      if (!response.success || !response.data) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', products: response.data })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function checkout(product: PricingProduct) {
    setBuying(product.id)
    try {
      const response = await apiFetch<CheckoutResult>('/me/checkout', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Checkout failed')
        return
      }
      if (response.data.redirectUrl) {
        // A real gateway finishes payment on its own page.
        window.location.assign(response.data.redirectUrl)
        return
      }
      toast.success(
        product.kind === 'oneTime'
          ? `${product.name} is yours. Find it on your profile.`
          : `${product.name} is active`,
      )
      await refreshAuth()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setBuying(null)
    }
  }

  if (preview && state.status !== 'ready') return null

  if (state.status === 'loading') {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading products…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>Pricing could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  const products =
    limit === undefined ? state.products : state.products.slice(0, limit)

  if (products.length === 0) {
    if (preview) return null
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-12 text-center">
        <Package
          className="mx-auto mb-3 size-6 text-[var(--muted)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--ink)]">
          No products published yet
        </p>
        <p className={`mt-1 ${hintClassName}`}>Check back soon.</p>
      </div>
    )
  }

  const activeIds = new Set(user?.products.map((product) => product.id))

  const card = (product: PricingProduct) => (
    <ProductCard
      key={product.id}
      product={product}
      isActive={activeIds.has(product.id)}
      isAuthenticated={isAuthenticated}
      buying={buying}
      onCheckout={(item) => void checkout(item)}
    />
  )

  if (!grouped) {
    const grid = (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(card)}
      </ul>
    )
    return preview ? preview(grid) : grid
  }

  return (
    <div className="space-y-14">
      {GROUPS.map((group) => {
        const items = products.filter((product) => product.kind === group.kind)
        if (items.length === 0) return null
        return (
          <section key={group.kind}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] pb-3">
              <h2 className="text-lg font-semibold text-[var(--ink)]">
                {group.title}
              </h2>
              <p className={hintClassName}>{group.hint}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(card)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function ProductCard({
  product,
  isActive,
  isAuthenticated,
  buying,
  onCheckout,
}: {
  product: PricingProduct
  isActive: boolean
  isAuthenticated: boolean
  buying: string | null
  onCheckout: (product: PricingProduct) => void
}) {
  // For a one-time product "active" means owned, and it cannot be bought again.
  const isOwned = product.kind === 'oneTime' && isActive
  const image = toAbsoluteMediaUrl(product.imageUrl)

  return (
    <li
      className={cn(
        'group flex flex-col rounded-xl border bg-white p-6 transition',
        isActive
          ? 'border-[var(--ink)]/25 shadow-[0_1px_2px_rgba(12,12,11,0.05)]'
          : 'border-[var(--line)] hover:border-[var(--ink)]/20 hover:shadow-[0_8px_24px_-12px_rgba(12,12,11,0.15)]',
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--line)]"
            style={image ? undefined : { backgroundColor: product.color }}
          >
            {image ? (
              <img
                src={image}
                alt=""
                className="size-full object-cover"
                loading="lazy"
              />
            ) : (
              <Package className="size-5 text-white/90" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[var(--ink)]">
              {product.name}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {product.kind === 'subscription' ? 'Hosting' : 'One-time'}
            </p>
          </div>
        </div>
        {isActive ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <Check className="size-3" aria-hidden />
            {isOwned ? 'Owned' : 'Active'}
          </span>
        ) : null}
      </div>

      <p className="font-display text-3xl text-[var(--ink)]">
        {product.pricingText || 'Contact us'}
      </p>
      <p className="mt-1 mb-8 text-sm text-[var(--muted)]">
        {product.durationDays
          ? `per ${formatDays(product.durationDays)}`
          : 'one-time, yours to keep'}
      </p>

      <div className="mt-auto">
        {isOwned ? (
          <Button asChild variant="outline" className="w-full">
            <Link to="/profile">Open in profile</Link>
          </Button>
        ) : isAuthenticated ? (
          <Button
            type="button"
            className="w-full"
            variant={isActive ? 'outline' : 'default'}
            disabled={buying !== null}
            onClick={() => onCheckout(product)}
          >
            {buying === product.id
              ? 'Processing…'
              : product.kind === 'oneTime'
                ? 'Buy'
                : isActive
                  ? 'Extend'
                  : 'Subscribe'}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/register">Get started</Link>
          </Button>
        )}
      </div>
    </li>
  )
}
