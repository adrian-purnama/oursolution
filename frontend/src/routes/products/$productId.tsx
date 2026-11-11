import { createFileRoute } from '@tanstack/react-router'
import ProductDetail from '#/components/forms/product/ProductDetail'

export const Route = createFileRoute('/products/$productId')({
  component: ProductPage,
})

function ProductPage() {
  const { productId } = Route.useParams()
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 text-[var(--ink)] sm:py-16">
      <ProductDetail key={productId} productId={productId} />
    </main>
  )
}
