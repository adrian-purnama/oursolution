import { createFileRoute } from '@tanstack/react-router'
import ProductEditorForm from '#/components/forms/admin/ProductEditorForm'

export const Route = createFileRoute('/admin/products/$productId')({
  component: AdminEditProductPage,
})

function AdminEditProductPage() {
  const { productId } = Route.useParams()
  return <ProductEditorForm key={productId} productId={productId} />
}
