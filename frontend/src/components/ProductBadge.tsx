import { toAbsoluteMediaUrl } from '#/lib/api'
import type { ProductSummary } from '#/lib/product'
import { cn } from '#/lib/utils'

/** The product's image when it has one, otherwise a square in its color. */
export function ProductMark({
  product,
  className,
}: {
  product: ProductSummary
  className?: string
}) {
  const src = toAbsoluteMediaUrl(product.imageUrl)
  return src ? (
    <img
      src={src}
      alt=""
      aria-hidden
      className={cn('size-4 shrink-0 rounded-[3px] object-cover', className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn('size-4 shrink-0 rounded-[3px]', className)}
      style={{ backgroundColor: product.color }}
    />
  )
}

/** A product's name with its image or color, so the text stays readable on any color. */
export default function ProductBadge({
  product,
  className,
}: {
  product: ProductSummary
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--line)] bg-white py-0.5 pr-2.5 pl-1 text-xs font-medium text-[var(--ink)]',
        className,
      )}
    >
      <ProductMark product={product} className="rounded-full" />
      <span className="truncate">{product.name}</span>
    </span>
  )
}
