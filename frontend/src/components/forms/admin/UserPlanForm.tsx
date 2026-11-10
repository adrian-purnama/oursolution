import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Trash2 } from 'lucide-react'
import PlanBadge from '#/components/PlanBadge'
import PlanMap from '#/components/PlanMap'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { formatDateTime } from '#/lib/plan'
import type { Plan, PlanSegment, UserPlanOverview } from '#/lib/plan'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** 'now' replaces the running plan; 'next' queues after everything scheduled. */
type Mode = 'now' | 'next'
type EndChoice = 'days' | 'currentEnd' | 'none'

function describeEnd(segment: PlanSegment): string {
  return segment.endsAt ? `until ${formatDateTime(segment.endsAt)}` : 'no end'
}

export default function UserPlanForm({ userId }: { userId: string }) {
  const { refreshAuth } = useAuth()

  const [overview, setOverview] = useState<UserPlanOverview | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState<Mode>('now')
  const [planId, setPlanId] = useState('')
  const [endChoice, setEndChoice] = useState<EndChoice>('days')
  const [days, setDays] = useState('30')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<PlanSegment | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const [overviewRes, plansRes] = await Promise.all([
          apiFetch<UserPlanOverview>(`/admin/users/${userId}/plan`),
          apiFetch<Plan[]>('/admin/plans'),
        ])
        if (run.cancelled) return
        if (!overviewRes.success || !overviewRes.data) {
          toast.error(overviewRes.message || "Failed to load the user's plan")
          return
        }
        setOverview(overviewRes.data)
        if (plansRes.success && plansRes.data) setPlans(plansRes.data)
      } catch {
        if (!run.cancelled) toast.error('Unable to reach the server')
      } finally {
        if (!run.cancelled) setLoading(false)
      }
    })()

    return () => {
      run.cancelled = true
    }
  }, [userId])

  async function applied(next: UserPlanOverview, message: string) {
    setOverview(next)
    toast.success(message)
    // The edited user may be you, and your own plan shows in your session.
    await refreshAuth()
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault()
    if (!planId) {
      toast.error('Choose a plan')
      return
    }

    const body: Record<string, unknown> = { planId }
    if (endChoice === 'days') {
      const count = Number(days)
      if (!Number.isInteger(count) || count < 1) {
        toast.error('Duration must be a whole number of days, 1 or more')
        return
      }
      body.durationDays = count
    } else if (endChoice === 'currentEnd') {
      body.untilCurrentEnd = true
    }

    setSaving(true)
    try {
      const response = await apiFetch<UserPlanOverview>(
        `/admin/users/${userId}/plan/${mode === 'now' ? 'override' : 'schedule'}`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to assign the plan')
        return
      }
      await applied(
        response.data,
        mode === 'now' ? 'Plan changed' : 'Plan scheduled',
      )
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting?.periodId) return
    setRemoving(true)
    try {
      const response = await apiFetch<UserPlanOverview>(
        `/admin/users/${userId}/plan/periods/${deleting.periodId}`,
        { method: 'DELETE' },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to delete the scheduled plan')
        return
      }
      setDeleting(null)
      await applied(response.data, 'Scheduled plan deleted')
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading plan…
      </div>
    )
  }

  if (!overview) {
    return <p className={hintClassName}>The plan could not be loaded.</p>
  }

  const { current, timeline } = overview
  // Stored periods that have not started yet are the only ones an admin can delete.
  const scheduled = timeline.filter(
    (segment) => segment.periodId !== null && !segment.isCurrent,
  )
  // "Until the current period ends" only makes sense when replacing a plan that has an end.
  const canReuseCurrentEnd =
    mode === 'now' && !current.isFallback && current.endsAt !== null
  const effectiveEndChoice: EndChoice =
    endChoice === 'currentEnd' && !canReuseCurrentEnd ? 'days' : endChoice
  const lastSegment = timeline[timeline.length - 1]
  // A queued plan starts where the schedule ends, which is where the trailing
  // default stretch begins. No trailing default means the last plan never ends.
  const queueStart = lastSegment.isFallback ? lastSegment.startsAt : null

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Plan</h2>
        <p className={`mt-1 ${hintClassName}`}>
          Whenever no plan is assigned, the user is on the default plan.
        </p>
      </div>

      <PlanMap overview={overview} />

      {scheduled.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Scheduled</h3>
          <ol className="space-y-2">
            {scheduled.map((segment) => (
              <li
                key={`${segment.periodId}-${segment.startsAt}`}
                className={`${cardClassName} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3`}
              >
                <PlanBadge plan={segment.plan} />
                <span className="min-w-0 flex-1 text-sm text-[var(--muted)]">
                  {`From ${formatDateTime(segment.startsAt)}, ${describeEnd(segment)}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete scheduled ${segment.plan.name} plan`}
                  onClick={() => setDeleting(segment)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <form
        className={`${cardClassName} space-y-4 p-4`}
        onSubmit={(event) => void handleAssign(event)}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Assign a plan</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="plan-mode"
              className="mt-1"
              checked={mode === 'now'}
              onChange={() => setMode('now')}
            />
            <span>
              Change now
              <span className={`block text-xs ${hintClassName}`}>
                Ends the current plan immediately and starts this one.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="plan-mode"
              className="mt-1"
              checked={mode === 'next'}
              onChange={() => setMode('next')}
            />
            <span>
              Add after the current schedule
              <span className={`block text-xs ${hintClassName}`}>
                {queueStart
                  ? `Starts ${
                      timeline.length === 1 ? 'now' : formatDateTime(queueStart)
                    }.`
                  : 'Not possible while the last plan has no end date.'}
              </span>
            </span>
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assign-plan">Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger id="assign-plan" className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                    {plan.isDefault ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-end">Lasts</Label>
            <Select
              value={effectiveEndChoice}
              onValueChange={(value) => setEndChoice(value as EndChoice)}
            >
              <SelectTrigger id="assign-end" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">A number of days</SelectItem>
                {canReuseCurrentEnd ? (
                  <SelectItem value="currentEnd">
                    Until the current period ends
                  </SelectItem>
                ) : null}
                <SelectItem value="none">No end date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {effectiveEndChoice === 'days' ? (
          <div className="space-y-1.5 sm:max-w-40">
            <Label htmlFor="assign-days">Days</Label>
            <Input
              id="assign-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving || (mode === 'next' && queueStart === null)}
          >
            {saving
              ? 'Saving…'
              : mode === 'now'
                ? 'Change plan now'
                : 'Schedule plan'}
          </Button>
        </div>
      </form>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete the scheduled {deleting?.plan.name} plan?
            </DialogTitle>
            <DialogDescription>
              {deleting
                ? `It was due to start ${formatDateTime(deleting.startsAt)}. The default plan will cover that time instead.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              onClick={() => void handleDelete()}
            >
              {removing ? 'Deleting…' : 'Delete scheduled plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
