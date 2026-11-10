import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { KeyRound, LoaderCircle } from 'lucide-react'
import PlanGantt from '#/components/PlanGantt'
import PurchaseList from '#/components/PurchaseList'
import UserAvatar from '#/components/UserAvatar'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { Purchase, UserPlan, UserProductRow } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

export default function ProfileForm() {
  const { user, refreshAuth } = useAuth()

  const [overview, setOverview] = useState<UserPlan | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [extending, setExtending] = useState<string | null>(null)

  const loadPlan = useCallback(async (run = { cancelled: false }) => {
    setLoading(true)
    setFailed(false)
    try {
      const [planRes, purchasesRes] = await Promise.all([
        apiFetch<UserPlan>('/me/plan'),
        apiFetch<Purchase[]>('/me/purchases'),
      ])
      if (run.cancelled) return
      if (
        !planRes.success ||
        !planRes.data ||
        !purchasesRes.success ||
        !purchasesRes.data
      ) {
        setFailed(true)
        return
      }
      setOverview(planRes.data)
      setPurchases(purchasesRes.data)
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

  /**
   * A subscription the user has running or scheduled can be extended here,
   * even when it is no longer on the pricing page. One with no end date has
   * nothing to extend.
   */
  function canExtend(row: UserProductRow): boolean {
    if (row.product.kind !== 'subscription' || !overview) return false
    const now = Date.parse(overview.now)
    const live = row.periods.filter(
      (period) => period.endsAt === null || Date.parse(period.endsAt) > now,
    )
    return live.length > 0 && live.every((period) => period.endsAt !== null)
  }

  async function handleExtend(row: UserProductRow) {
    setExtending(row.product.id)
    try {
      const response = await apiFetch<{ redirectUrl: string | null }>(
        '/me/checkout',
        {
          method: 'POST',
          body: JSON.stringify({ productId: row.product.id }),
        },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Could not extend')
        return
      }
      if (response.data.redirectUrl) {
        // A real gateway finishes payment on its own page.
        window.location.assign(response.data.redirectUrl)
        return
      }
      toast.success(`${row.product.name} extended`)
      await Promise.all([loadPlan(), refreshAuth()])
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setExtending(null)
    }
  }

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
        <h2 className="text-base font-medium">Your products</h2>
        {loading ? (
          <div className={`flex items-center gap-2 ${hintClassName}`}>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading your products…
          </div>
        ) : failed || !overview ? (
          <div className="flex items-center gap-3">
            <p className={hintClassName}>Your products could not be loaded.</p>
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
          <div className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Plan</h3>
              <PlanGantt
                plan={overview}
                rowActions={(row) =>
                  canExtend(row) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={extending !== null}
                      onClick={() => void handleExtend(row)}
                    >
                      {extending === row.product.id ? 'Extending…' : 'Extend'}
                    </Button>
                  ) : null
                }
                emptyText="No products yet. Check one out on the pricing page."
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Purchases and links</h3>
              <PurchaseList
                purchases={purchases}
                emptyText="No purchases yet. One-time products you buy stay here for good."
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
