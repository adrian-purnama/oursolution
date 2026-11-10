import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, LoaderCircle } from 'lucide-react'
import PlanMap from '#/components/PlanMap'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { UserPlanOverview } from '#/lib/plan'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

export default function ProfileForm() {
  const { user } = useAuth()

  const [overview, setOverview] = useState<UserPlanOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const loadPlan = useCallback(async (run = { cancelled: false }) => {
    setLoading(true)
    setFailed(false)
    try {
      const response = await apiFetch<UserPlanOverview>('/me/plan')
      if (run.cancelled) return
      if (!response.success || !response.data) {
        setFailed(true)
        return
      }
      setOverview(response.data)
    } catch {
      if (!run.cancelled) setFailed(true)
    } finally {
      if (!run.cancelled) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const run = { cancelled: false }
    void loadPlan(run)
    return () => {
      run.cancelled = true
    }
  }, [loadPlan])

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
    <div className="space-y-10">
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

      <section className="space-y-4">
        <h2 className="text-base font-medium">Plan</h2>
        {loading ? (
          <div className={`flex items-center gap-2 ${hintClassName}`}>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading plan…
          </div>
        ) : failed || !overview ? (
          <div className="flex items-center gap-3">
            <p className={hintClassName}>Your plan could not be loaded.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadPlan()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <PlanMap overview={overview} />
        )}
      </section>
    </div>
  )
}
