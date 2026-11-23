import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { apiFetch } from '#/lib/api'
import type { BillingRegion, BillingRegionInfo } from '#/lib/billing'
import { hintClassName } from '#/lib/ui-classes'

const REGION_LABELS: Record<BillingRegion, string> = {
  ID: 'Indonesia: rupiah, Midtrans',
  INTL: 'Outside Indonesia: US dollars, Paddle',
}

/**
 * Admin: where a user is billed. It follows where they are until their
 * first checkout locks it; setting it here locks it too.
 */
export default function UserBillingRegionForm({ userId }: { userId: string }) {
  const [info, setInfo] = useState<BillingRegionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const base = `/admin/users/${userId}/billing-region`

  useEffect(() => {
    let active = true
    setLoading(true)
    void apiFetch<BillingRegionInfo>(base)
      .then((res) => {
        if (!active) return
        if (res.success && res.data) setInfo(res.data)
        else toast.error(res.message || 'Could not load the billing region')
      })
      .catch(() => {
        if (active) toast.error('Unable to reach the server')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [base])

  async function save(patch: { region: BillingRegion; locked: boolean }) {
    setSaving(true)
    try {
      const res = await apiFetch<BillingRegionInfo>(base, {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Could not save the billing region')
        return
      }
      setInfo(res.data)
      toast.success('Billing region saved')
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading billing region…
      </div>
    )
  }
  if (!info) return null

  return (
    <section aria-labelledby="billing-region-title" className="max-w-2xl">
      <h2
        id="billing-region-title"
        className="mb-1.5 text-sm font-medium text-[var(--ink)]"
      >
        Billing region
      </h2>
      {info.international ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={info.region}
              disabled={saving}
              onValueChange={(value) =>
                void save({ region: value as BillingRegion, locked: true })
              }
            >
              <SelectTrigger
                id="billing-region"
                aria-labelledby="billing-region-title"
                className="w-full sm:w-80"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ID">{REGION_LABELS.ID}</SelectItem>
                <SelectItem value="INTL">{REGION_LABELS.INTL}</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={info.locked}
                disabled={saving}
                onChange={(event) =>
                  void save({
                    region: info.region,
                    locked: event.target.checked,
                  })
                }
              />
              Locked
            </label>
            {saving ? (
              <LoaderCircle
                className="size-4 animate-spin text-[var(--muted)]"
                aria-hidden
              />
            ) : null}
          </div>
          <p className={`mt-1.5 text-xs ${hintClassName}`}>
            Decides the prices they see and who bills them. Unlocked, it follows
            where they browse from; their first checkout locks it.
          </p>
        </>
      ) : (
        <p className={`text-sm ${hintClassName}`}>
          Indonesia. Billing outside Indonesia turns on once Paddle is set up.
        </p>
      )}
    </section>
  )
}
