import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import PlanBadge from '#/components/PlanBadge'
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
import { apiFetch } from '#/lib/api'
import { formatIdr } from '#/lib/plan'
import type { Plan } from '#/lib/plan'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

type Draft = {
  name: string
  color: string
  pricingText: string
  priceIdr: string
  showOnPricingPage: boolean
  isDefault: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  color: '#1a5c4a',
  pricingText: '',
  priceIdr: '0',
  showOnPricingPage: true,
  isDefault: false,
}

function toDraft(plan: Plan): Draft {
  return {
    name: plan.name,
    color: plan.color,
    pricingText: plan.pricingText,
    priceIdr: String(plan.priceIdr),
    showOnPricingPage: plan.showOnPricingPage,
    isDefault: plan.isDefault,
  }
}

export default function PlansAdminForm() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  /** null = closed, 'new' = creating, otherwise the plan being edited. */
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const [removing, setRemoving] = useState(false)

  async function load() {
    setLoading(true)
    setFailed(false)
    try {
      const response = await apiFetch<Plan[]>('/admin/plans')
      if (!response.success || !response.data) {
        setFailed(true)
        toast.error(response.message || 'Failed to load plans')
        return
      }
      setPlans(response.data)
    } catch {
      setFailed(true)
      toast.error('Unable to reach the server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setDraft(EMPTY_DRAFT)
    setEditing('new')
  }

  function openEdit(plan: Plan) {
    setDraft(toDraft(plan))
    setEditing(plan)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!editing) return

    const priceIdr = Number(draft.priceIdr)
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!Number.isInteger(priceIdr) || priceIdr < 0) {
      toast.error('Price must be a whole number of rupiah, 0 or more')
      return
    }

    const body = {
      name: draft.name.trim(),
      color: draft.color,
      pricingText: draft.pricingText.trim(),
      priceIdr,
      showOnPricingPage: draft.showOnPricingPage,
      // The current default can only stop being default by choosing another one.
      ...(editing !== 'new' && editing.isDefault
        ? {}
        : { isDefault: draft.isDefault }),
    }

    setSaving(true)
    try {
      const response =
        editing === 'new'
          ? await apiFetch<Plan>('/admin/plans', {
              method: 'POST',
              body: JSON.stringify(body),
            })
          : await apiFetch<Plan>(`/admin/plans/${editing.id}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            })
      if (!response.success) {
        toast.error(response.message || 'Failed to save plan')
        return
      }
      toast.success(editing === 'new' ? 'Plan created' : 'Plan updated')
      setEditing(null)
      await load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      const response = await apiFetch<null>(`/admin/plans/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!response.success) {
        toast.error(response.message || 'Failed to delete plan')
        return
      }
      toast.success('Plan deleted')
      setDeleting(null)
      await load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRemoving(false)
    }
  }

  const editingDefault =
    editing !== null && editing !== 'new' && editing.isDefault

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          <Plus aria-hidden />
          New plan
        </Button>
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 py-4 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading plans…
        </div>
      ) : failed ? (
        <div className={`${cardClassName} px-4 py-8 text-center`}>
          <p className={`mb-3 ${hintClassName}`}>Plans could not be loaded.</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={`${cardClassName} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PlanBadge plan={plan} />
                  {plan.isDefault ? (
                    <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-xs text-white">
                      Default
                    </span>
                  ) : null}
                  {plan.showOnPricingPage ? null : (
                    <span className={`text-xs ${hintClassName}`}>
                      Hidden from pricing
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-[var(--ink)]">
                  {formatIdr(plan.priceIdr)}
                  {plan.pricingText ? (
                    <span className="text-[var(--muted)]">
                      {' · shown as “'}
                      {plan.pricingText}
                      {'”'}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${plan.name}`}
                  onClick={() => openEdit(plan)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${plan.name}`}
                  disabled={plan.isDefault}
                  title={
                    plan.isDefault
                      ? 'Make another plan the default first'
                      : undefined
                  }
                  onClick={() => setDeleting(plan)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <form
            className="space-y-5"
            onSubmit={(event) => void handleSave(event)}
          >
            <DialogHeader>
              <DialogTitle>
                {editing === 'new' ? 'New plan' : 'Edit plan'}
              </DialogTitle>
              <DialogDescription>
                The price in rupiah is what gets charged. The pricing text is
                only what visitors read.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name">Name</Label>
                <Input
                  id="plan-name"
                  value={draft.name}
                  maxLength={60}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-color">Color</Label>
                <input
                  id="plan-color"
                  type="color"
                  value={draft.color}
                  onChange={(event) =>
                    setDraft({ ...draft, color: event.target.value })
                  }
                  className="block h-9 w-16 cursor-pointer rounded-md border border-[var(--line)] bg-white p-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price charged (IDR)</Label>
              <Input
                id="plan-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={draft.priceIdr}
                onChange={(event) =>
                  setDraft({ ...draft, priceIdr: event.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-pricing-text">Pricing text</Label>
              <Input
                id="plan-pricing-text"
                value={draft.pricingText}
                maxLength={120}
                placeholder="Rp 99.000 / month"
                onChange={(event) =>
                  setDraft({ ...draft, pricingText: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.showOnPricingPage}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      showOnPricingPage: event.target.checked,
                    })
                  }
                />
                Show on the pricing page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isDefault}
                  disabled={editingDefault}
                  onChange={(event) =>
                    setDraft({ ...draft, isDefault: event.target.checked })
                  }
                />
                Default plan
              </label>
              <p className={`text-xs ${hintClassName}`}>
                {editingDefault
                  ? 'This is the default. To change it, make another plan the default.'
                  : 'Users with no assigned plan are on the default. Choosing this replaces the current default.'}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. A plan that any user has been on, or is
              scheduled for, cannot be deleted.
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
              {removing ? 'Deleting…' : 'Delete plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
