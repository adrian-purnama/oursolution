import { createFileRoute } from '@tanstack/react-router'
import { apiFetch } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { SERVICES } from '#/lib/services'
import { absoluteUrl } from '#/lib/seo'

type Entry = { path: string; priority: string; changefreq: string }

const STATIC_PAGES: Entry[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/services', priority: '0.9', changefreq: 'monthly' },
  ...SERVICES.map((service) => ({
    path: `/services/${service.slug}`,
    priority: '0.8',
    changefreq: 'monthly',
  })),
  { path: '/pricing', priority: '0.8', changefreq: 'weekly' },
  { path: '/contact', priority: '0.6', changefreq: 'yearly' },
  { path: '/login', priority: '0.3', changefreq: 'yearly' },
  { path: '/register', priority: '0.3', changefreq: 'yearly' },
]

/** Published products, so each product page can be found. Empty if the API is down. */
async function productPages(): Promise<Entry[]> {
  try {
    const response = await apiFetch<PricingProduct[]>('/products/pricing', {
      signal: AbortSignal.timeout(5000),
    })
    if (!response.success || !response.data) return []
    return response.data.map((product) => ({
      path: `/products/${encodeURIComponent(product.id)}`,
      priority: '0.7',
      changefreq: 'weekly',
    }))
  } catch {
    return []
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const entries = [...STATIC_PAGES, ...(await productPages())]
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...entries.map(
            (entry) =>
              `  <url><loc>${escapeXml(absoluteUrl(entry.path))}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`,
          ),
          '</urlset>',
          '',
        ].join('\n')
        return new Response(body, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
