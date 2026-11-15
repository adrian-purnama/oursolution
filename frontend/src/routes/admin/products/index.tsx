import { createFileRoute } from '@tanstack/react-router'
import ProductsAdminForm from '#/components/forms/admin/ProductsAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/products/')({
  head: () => privatePage('Products · Admin'),
  component: AdminProductsPage,
})

function AdminProductsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Products</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Everything listed in the shop.
        </p>
      </div>

      <ProductsAdminForm />
    </div>
  )
}
