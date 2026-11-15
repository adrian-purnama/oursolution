import { createFileRoute } from '@tanstack/react-router'
import ProductDetail from '#/components/forms/product/ProductDetail'
import { apiFetch, toAbsoluteMediaUrl } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { absoluteUrl, jsonLd, seo } from '#/lib/seo'

/** Fetched for the page's title and share preview; the page loads its own copy. */
async function loadProductMeta(
  productId: string,
): Promise<PricingProduct | null> {
  try {
    const response = await apiFetch<PricingProduct>(
      `/products/pricing/${encodeURIComponent(productId)}`,
      { signal: AbortSignal.timeout(3000) },
    )
    return response.success ? response.data : null
  } catch {
    return null
  }
}

/** Markdown to one plain line, cut at a word near 160 characters. */
function toMetaDescription(markdown: string): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= 160) return text
  return `${text.slice(0, 157).replace(/\s+\S*$/, '')}…`
}

export const Route = createFileRoute('/products/$productId')({
  loader: async ({ params }) => ({
    product: await loadProductMeta(params.productId),
  }),
  head: ({ params, loaderData }) => {
    const product = loaderData?.product
    const path = `/products/${encodeURIComponent(params.productId)}`
    if (!product) return seo({ title: 'Product', path, noindex: true })
    const description =
      toMetaDescription(product.description) ||
      `${product.name} from Our Solution. ${product.pricingText}`.trim()
    const image = toAbsoluteMediaUrl(product.imageUrl) ?? undefined
    return {
      ...seo({
        title: product.name,
        description,
        path,
        image,
        imageAlt: product.name,
        type: 'product',
      }),
      scripts: [
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description,
          url: absoluteUrl(path),
          ...(image ? { image } : {}),
          brand: { '@type': 'Brand', name: 'Our Solution' },
        }),
      ],
    }
  },
  component: ProductPage,
})

function ProductPage() {
  const { productId } = Route.useParams()
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 text-[var(--ink)] sm:py-16">
      <ProductDetail key={productId} productId={productId} />
    </main>
  )
}
