import { createFileRoute } from '@tanstack/react-router'
import ProductEditorForm from '#/components/forms/admin/ProductEditorForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/products/$productId')({
  head: () => privatePage('Edit product · Admin'),
  component: AdminEditProductPage,
})

function AdminEditProductPage() {
  const { productId } = Route.useParams()
  return <ProductEditorForm key={productId} productId={productId} />
}
