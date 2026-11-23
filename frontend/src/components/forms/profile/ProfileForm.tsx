import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, KeyRound } from 'lucide-react'
import GoogleButton, { GoogleMark } from '#/components/forms/auth/GoogleButton'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

/** The account tab: who is signed in, and a password reset link. */
export default function ProfileForm() {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleResetPassword() {
    if (!user) return
    setSending(true)
    try {
      const response = await apiFetch<{ email: string }>('/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ email: user.email, isResetPassword: true }),
      })
      if (!response.success) {
        toast.error(response.message || m.profile_reset_failed())
        return
      }
      setSent(true)
      toast.success(m.profile_reset_sent_toast())
    } catch {
      toast.error(m.common_error_network_short())
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <section
        className={`${cardClassName} flex flex-wrap items-center gap-4 px-4 py-4`}
      >
        <UserAvatar email={user.email} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <p className={`text-xs ${hintClassName}`}>{m.profile_email()}</p>
          <p className="truncate text-sm font-medium">{user.email}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={sending || sent}
          onClick={() => void handleResetPassword()}
        >
          <KeyRound aria-hidden />
          {sending
            ? m.profile_sending()
            : sent
              ? m.profile_link_sent()
              : m.profile_reset_password()}
        </Button>
        {sent ? (
          <p className={`w-full text-xs ${hintClassName}`}>
            {m.profile_check_inbox()}
          </p>
        ) : null}
      </section>

      <section
        className={`${cardClassName} flex flex-wrap items-center gap-4 px-4 py-4`}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--line)]">
          <GoogleMark className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{m.profile_google()}</p>
          <p className={`text-xs ${hintClassName}`}>
            {user.googleLinked
              ? m.profile_google_linked_copy()
              : m.profile_google_link_copy()}
          </p>
        </div>
        {user.googleLinked ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Check className="size-4" aria-hidden />
            {m.profile_linked()}
          </p>
        ) : (
          <GoogleButton
            label={m.profile_link_google()}
            mode="link"
            className=""
          />
        )}
      </section>
    </div>
  )
}
