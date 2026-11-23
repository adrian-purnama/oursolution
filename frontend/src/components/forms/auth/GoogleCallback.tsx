import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { takeGoogleIntent } from '#/lib/google'
import { safeRedirect } from '#/lib/redirect'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

/** Long enough to read "sign in with your password, then link Google". */
const ERROR_TOAST_MS = 8000

/**
 * Where Google sends the user back to. Finishes what the Google button
 * started (sign in, register or link), then moves on.
 */
export default function GoogleCallback({
  code,
  state,
  error,
}: {
  code?: string
  state?: string
  error?: string
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const { login, refreshAuth } = useAuth()
  // The code works once, and effects run twice in development.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function finish() {
      const intent = takeGoogleIntent(state)
      const redirect = safeRedirect(intent?.redirect)
      const back = () =>
        intent?.mode === 'link'
          ? navigate({ to: '/profile', replace: true })
          : navigate({
              to: '/login',
              search: redirect ? { redirect } : {},
              replace: true,
            })

      if (!intent || !code || error) {
        // "access_denied" is the user pressing Cancel at Google.
        if (error !== 'access_denied') {
          toast.error(m.google_failed())
        }
        await back()
        return
      }

      try {
        if (intent.mode === 'link') {
          const response = await apiFetch<null>('/auth/google/link', {
            method: 'POST',
            body: JSON.stringify({ code }),
          })
          if (!response.success) {
            toast.error(response.message || m.google_link_failed(), {
              duration: ERROR_TOAST_MS,
            })
          } else {
            await refreshAuth()
            toast.success(m.google_linked())
          }
          await back()
          return
        }

        const response = await apiFetch<{ email: string; jwt: string }>(
          '/auth/google',
          {
            method: 'POST',
            body: JSON.stringify({ code, rememberMe: intent.rememberMe }),
          },
        )
        if (!response.success || !response.data?.jwt) {
          toast.error(response.message || m.google_signin_failed(), {
            duration: ERROR_TOAST_MS,
          })
          await back()
          return
        }

        await login(response.data.jwt)
        toast.success(m.auth_signin_success())
        if (redirect) router.history.replace(redirect)
        else await navigate({ to: '/dashboard', replace: true })
      } catch {
        toast.error(m.common_error_network())
        await back()
      }
    }

    void finish()
    // Runs once, for the answer Google sent back.
  }, [])

  return (
    <div className={`${cardClassName} w-full p-6 sm:p-8`} role="status">
      <h1 className="mb-2 text-2xl font-medium text-[var(--ink)]">
        {m.google_finishing()}
      </h1>
      <p className={hintClassName}>{m.google_checking()}</p>
    </div>
  )
}
