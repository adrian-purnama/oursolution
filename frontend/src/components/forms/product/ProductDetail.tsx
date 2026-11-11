import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle, Package } from 'lucide-react'
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

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; product: PricingProduct }

export default function ProductDetail({ productId }: { productId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  async function load() {
    setState({ status: 'loading' })
    try {
      const response = await apiFetch<PricingProduct>(
        `/products/pricing/${encodeURIComponent(productId)}`,
      )
      if (response.success && response.data) {
        setState({ status: 'ready', product: response.data })
        return
      }
      // Unpublished, deleted, unknown or malformed ids all read as missing.
      setState({ status: 'missing' })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    void load()
  }, [productId])

  return (
    <div>
      <Link
        to="/pricing"
        className={`mb-8 inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        All products
      </Link>

      {state.status === 'loading' ? (
        <div className={`flex items-center gap-2 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading product…
        </div>
      ) : state.status === 'error' ? (
        <div className={`${cardClassName} px-4 py-8 text-center`}>
          <p className={`mb-3 ${hintClassName}`}>
            The product could not be loaded.
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : state.status === 'missing' ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-12 text-center">
          <Package
            className="mx-auto mb-3 size-6 text-[var(--muted)]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--ink)]">
            This product is not available
          </p>
          <p className={`mt-1 mb-4 ${hintClassName}`}>
            It may have been removed from sale.
          </p>
          <Button asChild variant="outline">
            <Link to="/pricing">See all products</Link>
          </Button>
        </div>
      ) : (
        <Detail product={state.product} />
      )}
    </div>
  )
}

function Detail({ product }: { product: PricingProduct }) {
  const { isActive } = useProductAccess(product)
  const isSubscription = product.kind === 'subscription'

  return (
    <article>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <ProductImage
          product={product}
          eager
          className="aspect-[16/10] w-full rounded-xl border border-[var(--line)]"
          iconClassName="size-16"
        />

        <div className="flex flex-col">
          <div className="mb-2 flex items-center gap-2">
            <p className="font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
              {isSubscription ? 'Hosting' : 'One-time'}
            </p>
            <ProductStatusBadge product={product} />
          </div>
          <h1 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-6 border-t border-[var(--line)] pt-6">
            <p className="font-display text-3xl text-[var(--ink)]">
              {product.pricingText || 'Contact us'}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {product.durationDays
                ? `per ${formatDays(product.durationDays)}${isSubscription ? '. Buy again to extend.' : ''}`
                : 'One-time, yours to keep.'}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <CheckoutButton product={product} size="lg" className="flex-1" />
            {isSubscription && isActive ? (
              <Button asChild variant="ghost" size="lg">
                <Link to="/dashboard">Manage in dashboard</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {product.description ? (
        <section className="mt-12 max-w-3xl border-t border-[var(--line)] pt-8">
          <h2 className="mb-3 text-lg font-semibold text-[var(--ink)]">
            About this product
          </h2>
          <p className="leading-relaxed whitespace-pre-line text-[var(--ink)]/80">
            {product.description}
          </p>
        </section>
      ) : null}
    </article>
  )
}
