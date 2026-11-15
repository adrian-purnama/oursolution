import { Link, createFileRoute } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'
import ProductBadge from '#/components/ProductBadge'
import UnpaidNotice from '#/components/forms/billing/UnpaidNotice'
import SupportButton from '#/components/forms/ticket/SupportButton'
import DeploymentList from '#/components/forms/deployment/DeploymentList'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-4xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
          {user ? (
            <p className={`mt-1 truncate ${hintClassName}`}>{user.email}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <SupportButton />
          <Button asChild size="sm">
            <Link to="/pricing" className="no-underline">
              <ShoppingBag aria-hidden />
              Shop
            </Link>
          </Button>
        </div>
      </header>

      <UnpaidNotice className="mb-8" />

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your services</h2>
        <DeploymentList />
      </section>

      {user && user.products.length > 0 ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-medium">Everything you have</h2>
          <ul className="flex flex-wrap gap-1.5">
            {user.products.map((product) => (
              <li key={product.id}>
                <ProductBadge product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
