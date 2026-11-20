import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { Check, LoaderCircle, ShoppingCart } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { addToBasket } from '#/lib/billing'
import { checkoutPath } from '#/lib/redirect'
import type { PricingProduct } from '#/lib/product'
import { cn } from '#/lib/utils'

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
 * The buy actions for a product: "Open in profile" when owned; when signed
 * in, "Buy now" (straight to checkout) next to "Add to basket". Signed out,
 * the same button goes through registration (or sign-in) and then on to
 * this product's checkout.
 */
export default function CheckoutButton({
  product,
  variantId,
  className,
  size,
}: {
  product: PricingProduct
  /** The subscription variant to buy; none extends the user's, else the base. */
  variantId?: string
  className?: string
  size?: ComponentProps<typeof Button>['size']
}) {
  const { isAuthenticated } = useAuth()
  const { isActive, isOwned } = useProductAccess(product)
  const [adding, setAdding] = useState(false)

  async function add() {
    setAdding(true)
    try {
      const response = await addToBasket(product.id, 1, variantId ?? null)
      if (!response.success) {
        toast.error(response.message || 'Could not add to the basket')
        return
      }
      toast.success(`${product.name} added to your basket`)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setAdding(false)
    }
  }

  if (isOwned) {
    return (
      <Button asChild variant="outline" size={size} className={className}>
        <Link to="/profile" search={{ tab: 'products' }}>
          Open in profile
        </Link>
      </Button>
    )
  }

  const label =
    product.kind === 'oneTime' ? 'Buy now' : isActive ? 'Extend' : 'Subscribe'
  /** The main action (buy, subscribe, extend) in the brand blue. */
  const primary = cn(
    'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
    className,
  )

  if (!isAuthenticated) {
    return (
      <Button asChild size={size} className={primary}>
        <Link
          to="/register"
          search={{ redirect: checkoutPath(product.id, variantId) }}
        >
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button asChild size={size} className={primary}>
        <Link
          to="/checkout"
          search={{
            productId: product.id,
            ...(variantId ? { variantId } : {}),
          }}
        >
          {label}
        </Link>
      </Button>
      <Button
        type="button"
        size={size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon'}
        variant="outline"
        disabled={adding}
        onClick={() => void add()}
        aria-label={`Add ${product.name} to basket`}
        title="Add to basket"
      >
        {adding ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <ShoppingCart className="size-4" aria-hidden />
        )}
      </Button>
    </>
  )
}
