import { Package } from 'lucide-react'
import { toAbsoluteMediaUrl } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { cn } from '#/lib/utils'

/** The product's image, or its color with a package icon when it has none. */
export default function ProductImage({
  product,
  className,
  iconClassName,
  eager = false,
}: {
  product: Pick<PricingProduct, 'imageUrl' | 'color' | 'name'>
  className?: string
  iconClassName?: string
  eager?: boolean
}) {
  const image = toAbsoluteMediaUrl(product.imageUrl)
  return (
    <div
      className={cn('overflow-hidden bg-[var(--surface)]', className)}
      style={image ? undefined : { backgroundColor: product.color }}
    >
      {image ? (
        <img
          src={image}
          alt={product.name}
          className="size-full object-cover"
          loading={eager ? 'eager' : 'lazy'}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <Package
            className={cn('size-10 text-white/85', iconClassName)}
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
