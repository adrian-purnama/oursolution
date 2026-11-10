import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { LoaderCircle, Package } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch, toAbsoluteMediaUrl } from '#/lib/api'
import { formatDays } from '#/lib/product'
import type { PricingProduct } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; products: PricingProduct[] }

type CheckoutResult = {
  paymentId: string
  status: 'pending' | 'paid' | 'failed'
  redirectUrl: string | null
}

export default function PricingGrid() {
  const { isAuthenticated, user, refreshAuth } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [buying, setBuying] = useState<string | null>(null)

  async function load() {
    setState({ status: 'loading' })
    try {
      const response = await apiFetch<PricingProduct[]>('/products/pricing')
      if (!response.success || !response.data) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', products: response.data })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function checkout(product: PricingProduct) {
    setBuying(product.id)
    try {
      const response = await apiFetch<CheckoutResult>('/me/checkout', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Checkout failed')
        return
      }
      if (response.data.redirectUrl) {
        // A real gateway finishes payment on its own page.
        window.location.assign(response.data.redirectUrl)
        return
      }
      toast.success(
        product.kind === 'oneTime'
          ? `${product.name} is yours. Find it on your profile.`
          : `${product.name} is active`,
      )
      await refreshAuth()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setBuying(null)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading products…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>Pricing could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (state.products.length === 0) {
    return <p className={hintClassName}>No products are published yet.</p>
  }

  const activeIds = new Set(user?.products.map((product) => product.id))

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {state.products.map((product) => {
        // For a one-time product "active" means owned, and it cannot be bought again.
        const isActive = activeIds.has(product.id)
        const isOwned = product.kind === 'oneTime' && isActive
        const image = toAbsoluteMediaUrl(product.imageUrl)
        return (
          <li
            key={product.id}
            className={`${cardClassName} flex flex-col overflow-hidden`}
          >
            <div
              className="flex aspect-[16/9] items-center justify-center overflow-hidden"
              style={{ backgroundColor: product.color }}
            >
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Package className="size-10 text-white/80" aria-hidden />
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-lg font-semibold text-[var(--ink)]">
                {product.name}
              </h2>
              <p className="font-display mt-3 text-3xl text-[var(--ink)]">
                {product.pricingText || 'Contact us'}
              </p>
              <p className={`mt-1 mb-6 text-sm ${hintClassName}`}>
                {product.durationDays
                  ? `${formatDays(product.durationDays)} per checkout`
                  : 'One-time purchase, yours to keep'}
                {isOwned
                  ? ' · you own this'
                  : isActive
                    ? ' · active on your account'
                    : ''}
              </p>
              <div className="mt-auto">
                {isOwned ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/profile">Owned · open in profile</Link>
                  </Button>
                ) : isAuthenticated ? (
                  <Button
                    type="button"
                    className="w-full"
                    variant={isActive ? 'outline' : 'default'}
                    disabled={buying !== null}
                    onClick={() => void checkout(product)}
                  >
                    {buying === product.id
                      ? 'Processing…'
                      : product.kind === 'oneTime'
                        ? 'Buy'
                        : isActive
                          ? 'Extend'
                          : 'Checkout'}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/register">Get started</Link>
                  </Button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
