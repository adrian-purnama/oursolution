import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { cn } from '#/lib/utils'

type CheckoutResult = {
  paymentId: string
  status: 'pending' | 'paid' | 'failed'
  redirectUrl: string | null
}

/**
 * Whether the signed-in user has this product. For a one-time product
 * "active" means owned, and it cannot be bought again.
 */
export function useProductAccess(product: Pick<PricingProduct, 'id' | 'kind'>) {
  const { user } = useAuth()
  const isActive =
    user?.products.some((item) => item.id === product.id) ?? false
  return { isActive, isOwned: product.kind === 'oneTime' && isActive }
}

export function ProductStatusBadge({
  product,
  className,
}: {
  product: Pick<PricingProduct, 'id' | 'kind'>
  className?: string
}) {
  const { isActive, isOwned } = useProductAccess(product)
  if (!isActive) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700',
        className,
      )}
    >
      <Check className="size-3" aria-hidden />
      {isOwned ? 'Owned' : 'Active'}
    </span>
  )
}

/**
 * The one buy action for a product: "Open in profile" when owned, checkout
 * when signed in (Buy / Subscribe / Extend), "Get started" when signed out.
 */
export default function CheckoutButton({
  product,
  className,
  size,
}: {
  product: PricingProduct
  className?: string
  size?: ComponentProps<typeof Button>['size']
}) {
  const { isAuthenticated, refreshAuth } = useAuth()
  const { isActive, isOwned } = useProductAccess(product)
  const [busy, setBusy] = useState(false)

  async function checkout() {
    setBusy(true)
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
      setBusy(false)
    }
  }

  if (isOwned) {
    return (
      <Button asChild variant="outline" size={size} className={className}>
        <Link to="/profile">Open in profile</Link>
      </Button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Button asChild size={size} className={className}>
        <Link to="/register">Get started</Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      variant={isActive ? 'outline' : 'default'}
      disabled={busy}
      onClick={() => void checkout()}
    >
      {busy
        ? 'Processing…'
        : product.kind === 'oneTime'
          ? 'Buy'
          : isActive
            ? 'Extend'
            : 'Subscribe'}
    </Button>
  )
}
