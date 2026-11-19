import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'
import ProductBadge from '#/components/ProductBadge'
import UnpaidNotice from '#/components/forms/billing/UnpaidNotice'
import SupportButton from '#/components/forms/ticket/SupportButton'
import DeploymentList from '#/components/forms/deployment/DeploymentList'
import DashboardTours from '#/components/forms/tour/DashboardTours'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { Deployment } from '#/lib/deployment'
import type { ProductSummary } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'
import type { TourId } from '#/lib/tours'

export const Route = createFileRoute('/_authenticated/dashboard/')({
  head: () => privatePage('Dashboard'),
  /** `tour` replays a tour, from the profile. */
  validateSearch: (search: Record<string, unknown>): { tour?: TourId } =>
    search.tour === 'welcome' || search.tour === 'firstService'
      ? { tour: search.tour }
      : {},
  component: DashboardPage,
})

/** The user's services; null until loaded (or when they fail to load). */
function useMyDeployments(): Deployment[] | null {
  const [deployments, setDeployments] = useState<Deployment[] | null>(null)
  useEffect(() => {
    let cancelled = false
    apiFetch<Deployment[]>('/me/deployments')
      .then((response) => {
        if (cancelled || !response.success || !response.data) return
        setDeployments(response.data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return deployments
}

/**
 * A product the user has: its deployment page when it is deployed,
 * otherwise the products tab of the profile.
 */
function OwnedProductLink({
  product,
  deployable,
}: {
  product: ProductSummary
  deployable: boolean
}) {
  const className =
    'inline-flex max-w-full rounded-full no-underline transition hover:opacity-80'
  if (product.kind === 'subscription' && deployable) {
    return (
      <Link
        to="/dashboard/deployments/$productId"
        params={{ productId: product.id }}
        className={className}
      >
        <ProductBadge product={product} />
      </Link>
    )
  }
  return (
    <Link to="/profile" search={{ tab: 'products' }} className={className}>
      <ProductBadge product={product} />
    </Link>
  )
}

function DashboardPage() {
  const { user } = useAuth()
  const { tour } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const deployments = useMyDeployments()
  const deployableIds = new Set(
    (deployments ?? []).map((item) => item.product.id),
  )

  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-4xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
          {user ? (
            <p className={`mt-1 truncate ${hintClassName}`}>{user.email}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <SupportButton />
          <Button asChild size="sm" data-tour="shop">
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
              <li key={product.id} className="max-w-full min-w-0">
                <OwnedProductLink
                  product={product}
                  deployable={deployableIds.has(product.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DashboardTours
        deployments={deployments}
        replay={tour}
        onReplayEnd={() => void navigate({ search: {}, replace: true })}
      />
    </main>
  )
}
