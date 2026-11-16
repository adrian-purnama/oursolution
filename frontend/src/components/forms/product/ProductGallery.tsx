import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductImage from '#/components/forms/product/ProductImage'
import { toAbsoluteMediaUrl } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { cn } from '#/lib/utils'

const arrowClassName =
  'absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0'

/**
 * The product's images as a swipeable carousel with thumbnails; a single
 * image (or none) shows as a plain picture.
 */
export default function ProductGallery({
  product,
  className,
}: {
  product: Pick<PricingProduct, 'images' | 'imageUrl' | 'color' | 'name'>
  className?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const images = product.images.map(
    (image) => toAbsoluteMediaUrl(image.url) ?? image.url,
  )

  // The shown slide follows the scroll position, so swiping updates it too.
  useEffect(() => {
    const element = track.current
    if (!element) return
    const onScroll = () => {
      const width = element.clientWidth || 1
      setCurrent(Math.round(element.scrollLeft / width))
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [images.length])

  if (images.length <= 1) {
    return (
      <ProductImage
        product={product}
        eager
        className={cn(
          'aspect-[16/10] w-full rounded-xl border border-[var(--line)]',
          className,
        )}
        iconClassName="size-16"
      />
    )
  }

  function show(index: number) {
    const element = track.current
    if (!element) return
    const target = Math.max(0, Math.min(images.length - 1, index))
    element.scrollTo({ left: target * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <div
      className={cn('space-y-3', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${product.name} images`}
    >
      <div className="relative">
        <div
          ref={track}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              show(current - 1)
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              show(current + 1)
            }
          }}
          className="flex aspect-[16/10] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={`${product.name}, image ${index + 1} of ${images.length}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable={false}
              className="size-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous image"
          disabled={current === 0}
          onClick={() => show(current - 1)}
          className={`${arrowClassName} left-3`}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next image"
          disabled={current === images.length - 1}
          onClick={() => show(current + 1)}
          className={`${arrowClassName} right-3`}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>

        <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2 py-0.5 font-mono text-xs text-white tabular-nums">
          {current + 1} / {images.length}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            aria-label={`Show image ${index + 1}`}
            aria-current={index === current}
            onClick={() => show(index)}
            className={cn(
              'aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-md border-2 transition',
              index === current
                ? 'border-[var(--ink)]'
                : 'border-transparent opacity-60 hover:opacity-100',
            )}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
