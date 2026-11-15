import { createFileRoute } from '@tanstack/react-router'
import ProductEditorForm from '#/components/forms/admin/ProductEditorForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/products/new')({
  head: () => privatePage('New product · Admin'),
  component: AdminNewProductPage,
})

function AdminNewProductPage() {
  return <ProductEditorForm />
}
