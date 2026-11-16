import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, KeyRound } from 'lucide-react'
import GoogleButton, { GoogleMark } from '#/components/forms/auth/GoogleButton'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

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
        toast.error(response.message || 'Failed to send the reset link')
        return
      }
      setSent(true)
      toast.success('Reset link sent to your email')
    } catch {
      toast.error('Unable to reach the server')
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
          <p className={`text-xs ${hintClassName}`}>Email</p>
          <p className="truncate text-sm font-medium">{user.email}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={sending || sent}
          onClick={() => void handleResetPassword()}
        >
          <KeyRound aria-hidden />
          {sending ? 'Sending…' : sent ? 'Link sent' : 'Reset password'}
        </Button>
        {sent ? (
          <p className={`w-full text-xs ${hintClassName}`}>
            Check your inbox and follow the link to choose a new password.
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
          <p className="text-sm font-medium">Google</p>
          <p className={`text-xs ${hintClassName}`}>
            {user.googleLinked
              ? 'You can sign in with your Google account.'
              : 'Link a Google account to sign in without your password.'}
          </p>
        </div>
        {user.googleLinked ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Check className="size-4" aria-hidden />
            Linked
          </p>
        ) : (
          <GoogleButton label="Link Google" mode="link" className="" />
        )}
      </section>
    </div>
  )
}
