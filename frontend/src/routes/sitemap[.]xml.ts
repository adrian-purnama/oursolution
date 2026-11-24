import { createFileRoute } from '@tanstack/react-router'
import { apiFetch } from '#/lib/api'
import type { PricingProduct } from '#/lib/product'
import { SERVICES } from '#/lib/services'
import { absoluteUrl, languageAlternates } from '#/lib/seo'
import { locales, localizeHref } from '#/paraglide/runtime'

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
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
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

/**
 * One <url> per language version of a page, each listing all versions as
 * alternates. A page with a single URL (login, register) gets one entry.
 */
function urlEntries(entry: Entry): string[] {
  const alternates = languageAlternates(entry.path)
  const tail = `<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority>`
  if (alternates.length === 0) {
    return [
      `  <url><loc>${escapeXml(absoluteUrl(entry.path))}</loc>${tail}</url>`,
    ]
  }
  const links = alternates
    .map(
      (link) =>
        `<xhtml:link rel="alternate" hreflang="${link.hrefLang}" href="${escapeXml(link.href)}"/>`,
    )
    .join('')
  return locales.map(
    (locale) =>
      `  <url><loc>${escapeXml(absoluteUrl(localizeHref(entry.path, { locale })))}</loc>${links}${tail}</url>`,
  )
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
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...entries.flatMap(urlEntries),
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
