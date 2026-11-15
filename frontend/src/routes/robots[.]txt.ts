import { createFileRoute } from '@tanstack/react-router'
import { absoluteUrl } from '#/lib/seo'

/** Private areas stay out of search; the sitemap lists the public pages. */
const DISALLOW = [
  '/admin',
  '/dashboard',
  '/billing',
  '/checkout',
  '/profile',
  '/support',
  '/reset-password',
]

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            'User-agent: *',
            'Allow: /',
            ...DISALLOW.map((path) => `Disallow: ${path}`),
            '',
            `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
            '',
          ].join('\n'),
          {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=3600',
            },
          },
        ),
    },
  },
})
