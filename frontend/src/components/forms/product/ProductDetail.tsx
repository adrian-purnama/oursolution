import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle, Package } from 'lucide-react'
import CheckoutButton, {
  ProductStatusBadge,
  useProductAccess,
} from '#/components/forms/product/CheckoutButton'
import ProductGallery from '#/components/forms/product/ProductGallery'
import Markdown from '#/components/Markdown'
import ProductNotices from '#/components/ProductNotices'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { formatDays, formatIdr } from '#/lib/product'
import type { PricingProduct, PricingVariant } from '#/lib/product'
import { cn } from '#/lib/utils'
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
  const variants = product.variants
  const choosing = variants.length > 1
  const [variantId, setVariantId] = useState<string | undefined>(undefined)
  const chosen = choosing
    ? (variants.find((variant) => variant.id === variantId) ?? null)
    : null

  return (
    <article>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <ProductNotices
          notices={product.notices}
          placement="top"
          className="self-start"
        >
          <ProductGallery product={product} />
        </ProductNotices>

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
              {chosen
                ? formatIdr(chosen.priceIdr)
                : product.pricingText || 'Contact us'}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {chosen?.durationDays
                ? `per ${formatDays(chosen.durationDays)}. Buy again to extend.`
                : product.durationDays
                  ? `per ${formatDays(product.durationDays)}${isSubscription ? '. Buy again to extend.' : ''}`
                  : 'One-time, yours to keep.'}
            </p>
          </div>

          {choosing ? (
            <VariantPicker
              variants={variants}
              value={variantId}
              onChange={setVariantId}
              active={isActive}
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <CheckoutButton
              product={product}
              variantId={chosen?.id}
              size="lg"
              className="flex-1"
            />
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
          <Markdown className="prose-base leading-relaxed">
            {product.description}
          </Markdown>
        </section>
      ) : null}
    </article>
  )
}

/**
 * The variants to choose from, as radio cards. Nothing is chosen at first:
 * a subscriber who picks nothing extends the variant they are on.
 */
function VariantPicker({
  variants,
  value,
  onChange,
  active,
}: {
  variants: PricingVariant[]
  value: string | undefined
  onChange: (id: string) => void
  /** The user has this subscription already. */
  active: boolean
}) {
  return (
    <fieldset className="mt-6">
      <legend className="mb-2 text-sm font-medium text-[var(--ink)]">
        Choose a variant
      </legend>
      <div className="grid gap-2" role="radiogroup">
        {variants.map((variant) => {
          const selected = variant.id === value
          return (
            <label
              key={variant.id}
              className={cn(
                'flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--accent)]/40',
                selected
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--line)] hover:border-[var(--ink)]/30',
              )}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="product-variant"
                  className="mt-1"
                  checked={selected}
                  onChange={() => onChange(variant.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--ink)]">
                    {variant.name}
                  </span>
                  {variant.specs ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {variant.specs}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums">
                {formatIdr(variant.priceIdr)}
                {variant.durationDays ? (
                  <span className="block text-xs text-[var(--muted)]">
                    per {formatDays(variant.durationDays)}
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {active
          ? 'Leave it unpicked to extend the variant you are on. At checkout you can switch right away or after your current time.'
          : 'You can switch to another variant later.'}
      </p>
    </fieldset>
  )
}
