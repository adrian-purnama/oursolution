import { createFileRoute } from '@tanstack/react-router'
import CheckoutForm from '#/components/forms/billing/CheckoutForm'
import { privatePage } from '#/lib/seo'

type CheckoutSearch = { productId?: string; quantity?: number }

export const Route = createFileRoute('/_authenticated/checkout/')({
  head: () => privatePage('Checkout'),
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => {
    const productId =
      typeof search.productId === 'string' &&
      /^[0-9a-f]{24}$/i.test(search.productId)
        ? search.productId
        : undefined
    const quantity = Number(search.quantity)
    return productId
      ? {
          productId,
          ...(Number.isInteger(quantity) && quantity > 1 ? { quantity } : {}),
        }
      : {}
  },
  component: CheckoutPage,
})

function CheckoutPage() {
  const { productId, quantity } = Route.useSearch()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-5xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <h1 className="mb-8 text-2xl font-medium">
        {productId ? 'Checkout' : 'Basket'}
      </h1>
      <CheckoutForm productId={productId} quantity={quantity} />
    </main>
  )
}
