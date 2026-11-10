import { createFileRoute } from '@tanstack/react-router'
import ProductsAdminForm from '#/components/forms/admin/ProductsAdminForm'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/admin/products')({
  component: AdminProductsPage,
})

function AdminProductsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Products</h1>
        <p className={`mt-2 ${hintClassName}`}>
          What users can have active. Users check out each product on its own;
          you can also set them from a user&apos;s page.
        </p>
      </div>

      <ProductsAdminForm />
    </div>
  )
}
