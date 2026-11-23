import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Public pages get a URL per language so search engines index each one:
 * English at /pricing, Indonesian at /id/pricing. Everything else (the
 * dashboard, auth, admin) keeps one URL and follows the visitor's saved
 * language instead.
 */
const PUBLIC_PAGES = [
  '/services/:path(.*)?',
  '/pricing',
  '/products/:path(.*)?',
  '/contact',
  '/privacy',
  '/terms',
]

const urlPatterns = [
  {
    pattern: '/',
    localized: [
      ['id', '/id'],
      ['en', '/'],
    ] as Array<['en' | 'id', string]>,
  },
  ...PUBLIC_PAGES.map((page) => ({
    pattern: page,
    localized: [
      ['id', `/id${page}`],
      ['en', page],
    ] as Array<['en' | 'id', string]>,
  })),
  // App pages: the same URL in every language.
  {
    pattern: '/:path(.*)?',
    localized: [
      ['en', '/:path(.*)?'],
      ['id', '/:path(.*)?'],
    ] as Array<['en' | 'id', string]>,
  },
]

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      emitTsDeclarations: true,
      // App pages: the saved choice, then the browser's language.
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
      routeStrategies: [
        { match: '/sitemap.xml', exclude: true },
        { match: '/robots.txt', exclude: true },
        // Public pages: the URL decides. "cookie" comes after "url" so it is
        // never read here, but setLocale() still saves the choice in it.
        ...['/', ...PUBLIC_PAGES].map((match) => ({
          match,
          strategy: ['url', 'cookie', 'baseLocale'] as Array<
            'url' | 'cookie' | 'baseLocale'
          >,
        })),
      ],
      urlPatterns,
      cookieName: 'locale',
      cookieSameSite: 'lax',
      cookieSecure: 'auto',
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  // The TanStack packages pin different @tanstack/router-core versions
  // (start-server-core carries its own copy). Left external, the production
  // server imports the top-level copy and fails; bundling them keeps each one
  // on the version it was built against.
  ssr: command === 'build' ? { noExternal: [/^@tanstack\//] } : undefined,
}))

export default config
