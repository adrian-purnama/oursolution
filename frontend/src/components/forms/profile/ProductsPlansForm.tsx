import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import PlanGantt from '#/components/PlanGantt'
import PurchaseList from '#/components/PurchaseList'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import type { Purchase, UserPlan, UserProductRow } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

/** The user's subscriptions on a timeline, and the one-time products they own. */
export default function ProductsPlansForm() {
  const [overview, setOverview] = useState<UserPlan | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (run = { cancelled: false }) => {
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
    void load(run)
    return () => {
      run.cancelled = true
    }
  }, [load])

  /**
   * A subscription the user has running or scheduled can be extended, even
   * when it is no longer on the pricing page. One with no end date has
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

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading your products…
      </div>
    )
  }

  if (failed || !overview) {
    return (
      <div className="flex items-center gap-3">
        <p className={hintClassName}>Your products could not be loaded.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Plan</h2>
        <PlanGantt
          plan={overview}
          rowActions={(row) =>
            canExtend(row) ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/checkout" search={{ productId: row.product.id }}>
                  Extend
                </Link>
              </Button>
            ) : null
          }
          emptyText="No products yet. Check one out on the pricing page."
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Purchases and links</h2>
        <PurchaseList
          purchases={purchases}
          emptyText="No purchases yet. One-time products you buy stay here for good."
        />
      </section>
    </div>
  )
}
