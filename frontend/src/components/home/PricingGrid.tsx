import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { LoaderCircle, Package } from 'lucide-react'
import CheckoutButton, {
  ProductStatusBadge,
  useProductAccess,
} from '#/components/forms/product/CheckoutButton'
import ProductImage from '#/components/forms/product/ProductImage'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { formatDays } from '#/lib/product'
import type { PricingProduct } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; products: PricingProduct[] }

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
  const [state, setState] = useState<State>({ status: 'loading' })

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

  const card = (product: PricingProduct) => (
    <ProductCard key={product.id} product={product} />
  )

  if (!grouped) {
    const grid = (
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(card)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function ProductCard({ product }: { product: PricingProduct }) {
  const { isActive } = useProductAccess(product)
  const page = {
    to: '/products/$productId',
    params: { productId: product.id },
  } as const

  return (
    <li
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-white transition',
        isActive
          ? 'border-[var(--ink)]/25 shadow-[0_1px_2px_rgba(12,12,11,0.05)]'
          : 'border-[var(--line)] hover:border-[var(--ink)]/20 hover:shadow-[0_8px_24px_-12px_rgba(12,12,11,0.15)]',
      )}
    >
      <Link {...page} className="relative block" tabIndex={-1} aria-hidden>
        <ProductImage
          product={product}
          className="aspect-[16/10] w-full border-b border-[var(--line)]"
        />
        <ProductStatusBadge
          product={product}
          className="absolute top-3 right-3 shadow-sm"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="mb-1 text-xs text-[var(--muted)]">
          {product.kind === 'subscription' ? 'Hosting' : 'One-time'}
        </p>
        <h3 className="text-base font-semibold text-[var(--ink)]">
          <Link {...page} className="text-inherit no-underline hover:underline">
            {product.name}
          </Link>
        </h3>
        {product.description ? (
          <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-[var(--muted)]">
            {product.description}
          </p>
        ) : null}

        <div className="mt-5 mb-5">
          <p className="font-display text-2xl text-[var(--ink)]">
            {product.pricingText || 'Contact us'}
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {product.durationDays
              ? `per ${formatDays(product.durationDays)}`
              : 'one-time, yours to keep'}
          </p>
        </div>

        <div className="mt-auto flex gap-2">
          <CheckoutButton product={product} className="flex-1" />
          <Button asChild variant="ghost">
            <Link {...page}>Details</Link>
          </Button>
        </div>
      </div>
    </li>
  )
}
