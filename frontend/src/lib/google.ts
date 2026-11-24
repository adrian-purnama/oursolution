import { apiFetch } from '#/lib/api'
import { m } from '#/paraglide/messages'

const STORAGE_KEY = 'google_oauth'
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

/** What the Google round trip is for, kept until Google sends the user back. */
export interface GoogleIntent {
  /** Echoed back by Google; proves the answer belongs to this browser. */
  state: string
  /** `signin` signs in or registers; `link` adds Google to the signed-in account. */
  mode: 'signin' | 'link'
  rememberMe: boolean
  /** Where to continue after signing in, e.g. the checkout. */
  redirect?: string
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

/**
 * Sends the browser to Google's account chooser. Resolves with an error
 * message when Google sign-in cannot start; otherwise the page navigates away.
 */
export async function startGoogle(
  intent: Omit<GoogleIntent, 'state'>,
): Promise<string | null> {
  let config: { clientId: string | null; redirectUri: string } | null
  try {
    const response = await apiFetch<{
      clientId: string | null
      redirectUri: string
    }>('/auth/google')
    config = response.data
  } catch {
    return m.common_error_network()
  }
  if (!config?.clientId) return m.google_unavailable()

  const state = randomState()
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...intent, state } satisfies GoogleIntent),
    )
  } catch {
    return m.google_needs_storage()
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    prompt: 'select_account',
  })
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
  return null
}

/** The intent saved before leaving, once, and only if `state` matches it. */
export function takeGoogleIntent(
  state: string | undefined,
): GoogleIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
    if (!raw || !state) return null
    const intent = JSON.parse(raw) as Partial<GoogleIntent>
    if (intent.state !== state) return null
    return {
      state,
      mode: intent.mode === 'link' ? 'link' : 'signin',
      rememberMe: intent.rememberMe === true,
      redirect:
        typeof intent.redirect === 'string' ? intent.redirect : undefined,
    }
  } catch {
    return null
  }
}
