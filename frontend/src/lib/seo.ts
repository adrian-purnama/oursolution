import { BRAND_NAME } from '#/lib/config'

/**
 * The site's public origin, used for canonical links, share previews and the
 * sitemap. Set VITE_SITE_URL at build time (e.g. https://oursolution.id);
 * share previews on Facebook, X and WhatsApp need absolute URLs.
 */
export const SITE_URL: string = (
  import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '')

export const SITE_NAME = BRAND_NAME

export const SITE_TAGLINE = 'Custom software, managed hosting and AI chatbots'

export const DEFAULT_DESCRIPTION =
  'Our Solution builds custom web and mobile apps, hosts ready-made business tools for you, and runs answr.id, an AI chatbot for your website. One team that builds it, hosts it and keeps it running.'

export const DEFAULT_KEYWORDS = [
  'custom software development',
  'web app development',
  'mobile app development',
  'managed hosting',
  'business process digitalization',
  'AI chatbot for website',
  'answr.id',
  'Our Solution',
]

/** 1200x630, under 300 KB so WhatsApp shows it too. */
export const DEFAULT_OG_IMAGE = '/og-image.png'
const DEFAULT_OG_IMAGE_ALT = `${SITE_NAME} — ${SITE_TAGLINE}`

export const THEME_COLOR = '#002060'

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

type SeoInput = {
  /** Page title without the brand; omit on the home page. */
  title?: string
  description?: string
  /** Path of the page, e.g. /pricing. Sets the canonical and og:url. */
  path?: string
  /** Absolute URL or a path in /public. */
  image?: string
  imageAlt?: string
  keywords?: string[]
  type?: 'website' | 'article' | 'product'
  /** Private pages: keep them out of search results. */
  noindex?: boolean
}

type MetaTag = Record<string, string>
type LinkTag = Record<string, string>

/**
 * Title, description, Open Graph (Facebook, WhatsApp, LinkedIn), Twitter card
 * and canonical tags for a route's `head`. Child routes' tags replace the
 * root's tags of the same name or property.
 */
export function seo(input: SeoInput = {}): {
  meta: MetaTag[]
  links: LinkTag[]
} {
  const title = input.title
    ? `${input.title} | ${SITE_NAME}`
    : `${SITE_NAME} — ${SITE_TAGLINE}`
  const description = input.description ?? DEFAULT_DESCRIPTION
  const image = absoluteUrl(input.image ?? DEFAULT_OG_IMAGE)
  const imageAlt =
    input.imageAlt ?? (input.image ? title : DEFAULT_OG_IMAGE_ALT)
  const isDefaultImage = !input.image

  const meta: MetaTag[] = [
    { title },
    { name: 'description', content: description },
    {
      name: 'robots',
      content: input.noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large',
    },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: input.type ?? 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:image:alt', content: imageAlt },
    { property: 'og:locale', content: 'en_US' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: imageAlt },
  ]

  if (isDefaultImage) {
    meta.push(
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:type', content: 'image/png' },
    )
  }
  if (input.keywords?.length) {
    meta.push({ name: 'keywords', content: input.keywords.join(', ') })
  }

  const links: LinkTag[] = []
  if (input.path !== undefined) {
    const url = absoluteUrl(input.path)
    meta.push({ property: 'og:url', content: url })
    if (!input.noindex) links.push({ rel: 'canonical', href: url })
  }

  return { meta, links }
}

/** Head for signed-in and admin pages: a title, and no indexing. */
export function privatePage(title: string) {
  return seo({ title, noindex: true })
}

/** A JSON-LD block for a route's `scripts`. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data),
  }
}

export const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl('/oursolution-logo.png'),
  description: DEFAULT_DESCRIPTION,
}

export const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
}
