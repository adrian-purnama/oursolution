import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { paraglideMiddleware } from './paraglide/server'
import {
  baseLocale,
  extractLocaleFromRequestWithStrategies,
  locales,
  localizeUrl,
} from './paraglide/runtime'

/**
 * A public page opened without a language prefix (/pricing) by someone who
 * prefers another language (saved choice first, then the browser's) is sent
 * to that language's URL (/id/pricing). A prefixed URL is never redirected,
 * so a shared /id link always opens in Indonesian. Only real page loads are
 * redirected; crawlers and fetches get the page they asked for.
 */
function preferredLanguageRedirect(request: Request, url: URL) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined
  if (request.headers.get('Sec-Fetch-Dest') !== 'document') return undefined

  const preferred = extractLocaleFromRequestWithStrategies(request, [
    'cookie',
    'preferredLanguage',
    'baseLocale',
  ])
  if (preferred === baseLocale) return undefined

  const target = localizeUrl(url, { locale: preferred })
  if (target.pathname === url.pathname) return undefined

  return new Response(null, {
    status: 307,
    headers: {
      Location: `${target.pathname}${target.search}`,
      Vary: 'Cookie, Accept-Language',
    },
  })
}

/** Whether this URL is the unprefixed (English) version of a public page. */
function hasOtherLanguageVersions(url: URL) {
  return locales.some(
    (locale) =>
      locale !== baseLocale &&
      localizeUrl(url, { locale }).pathname !== url.pathname,
  )
}

export default createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url)
    const redirect = preferredLanguageRedirect(request, url)
    if (redirect) return redirect

    // The router strips and adds the prefix itself (see router.tsx), so it
    // gets the original request; the middleware only sets the locale for
    // server rendering.
    const response = await paraglideMiddleware(request, () =>
      handler.fetch(request, opts),
    )

    if (hasOtherLanguageVersions(url) && !response.headers.has('Vary')) {
      try {
        response.headers.set('Vary', 'Cookie, Accept-Language')
      } catch {
        // Immutable headers: the page is still correct, just not cache-keyed.
      }
    }
    return response
  },
})
