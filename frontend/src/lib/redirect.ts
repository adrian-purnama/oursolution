/**
 * Where to go after signing in or registering, carried as `?redirect=`.
 * Only a path on this site is accepted ("/checkout?productId=…"); anything
 * else, such as "//evil.example" or "https://…", is dropped so the link
 * cannot send people to another site.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  if (
    path.length === 0 ||
    path.length > 2000 ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\') ||
    // No control characters (a tab or newline could sneak past the checks).
    [...path].some((char) => char.charCodeAt(0) < 32)
  ) {
    return undefined
  }
  // Signing in again from the auth pages themselves would loop.
  if (/^\/(login|register)(?:[/?#]|$)/.test(path)) return undefined
  return path
}

export type AuthSearch = { redirect?: string }

/**
 * `validateSearch` for /login and /register. The key is always returned:
 * the router merges validated search over the raw query, so leaving out an
 * unsafe redirect would let the raw value through.
 */
export function validateAuthSearch(
  search: Record<string, unknown>,
): AuthSearch {
  return { redirect: safeRedirect(search.redirect) }
}

/** The checkout page for one product, as a redirect target. */
export function checkoutPath(productId: string): string {
  return `/checkout?productId=${encodeURIComponent(productId)}`
}
