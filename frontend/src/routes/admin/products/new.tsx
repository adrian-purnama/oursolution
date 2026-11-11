import { createFileRoute } from '@tanstack/react-router'
import ProductEditorForm from '#/components/forms/admin/ProductEditorForm'

export const Route = createFileRoute('/admin/products/new')({
  component: AdminNewProductPage,
})

function AdminNewProductPage() {
  return <ProductEditorForm />
}
