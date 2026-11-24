import { createFileRoute } from '@tanstack/react-router'
import CheckoutForm from '#/components/forms/billing/CheckoutForm'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

type CheckoutSearch = {
  productId?: string
  quantity?: number
  /** A subscription variant; none extends the one the user is on. */
  variantId?: string
}

export const Route = createFileRoute('/_authenticated/checkout/')({
  head: () => privatePage(m.seo_checkout()),
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => {
    const productId =
      typeof search.productId === 'string' &&
      /^[0-9a-f]{24}$/i.test(search.productId)
        ? search.productId
        : undefined
    const quantity = Number(search.quantity)
    const variantId =
      typeof search.variantId === 'string' &&
      /^[A-Za-z0-9_-]{1,40}$/.test(search.variantId)
        ? search.variantId
        : undefined
    return productId
      ? {
          productId,
          ...(Number.isInteger(quantity) && quantity > 1 ? { quantity } : {}),
          ...(variantId ? { variantId } : {}),
        }
      : {}
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  const { productId, quantity, variantId } = Route.useSearch()
  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-5xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <h1 className="mb-8 text-2xl font-medium">
        {productId ? 'Checkout' : 'Basket'}
      </h1>
      <CheckoutForm
        productId={productId}
        quantity={quantity}
        variantId={variantId}
      />
    </main>
  )
}
