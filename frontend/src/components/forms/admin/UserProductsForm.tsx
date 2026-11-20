import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Trash2 } from 'lucide-react'
import PlanGantt from '#/components/PlanGantt'
import ProductBadge from '#/components/ProductBadge'
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
import VariantSelect from '#/components/forms/admin/VariantSelect'
import { apiFetch } from '#/lib/api'
import { formatDateTime, BASE_VARIANT_ID } from '#/lib/product'
import type {
  Product,
  ProductPeriod,
  ProductSummary,
  UserPlan,
} from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** 'now' replaces the product's running period; 'next' queues after its schedule. */
type Mode = 'now' | 'next'
type EndChoice = 'days' | 'currentEnd' | 'none'

type Scheduled = { product: ProductSummary; period: ProductPeriod }

export default function UserProductsForm({ userId }: { userId: string }) {
  const { refreshAuth } = useAuth()

  const [plan, setPlan] = useState<UserPlan | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState(BASE_VARIANT_ID)
  const [mode, setMode] = useState<Mode>('now')
  const [endChoice, setEndChoice] = useState<EndChoice>('days')
  const [days, setDays] = useState('30')
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<Scheduled | null>(null)
  const [stopping, setStopping] = useState<ProductSummary | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const [planRes, productsRes] = await Promise.all([
          apiFetch<UserPlan>(`/admin/users/${userId}/plan`),
          apiFetch<Product[]>('/admin/products'),
        ])
        if (run.cancelled) return
        if (!planRes.success || !planRes.data) {
          toast.error(planRes.message || "Failed to load the user's plan")
          return
        }
        setPlan(planRes.data)
        if (productsRes.success && productsRes.data) {
          // Only subscriptions live on the plan timeline.
          setProducts(
            productsRes.data.filter(
              (product) =>
                product.kind === 'subscription' && !product.deletedAt,
            ),
          )
        }
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

  async function call(path: string, init: RequestInit, message: string) {
    const response = await apiFetch<UserPlan>(path, init)
    if (!response.success || !response.data) {
      toast.error(response.message || 'Something went wrong')
      return false
    }
    setPlan(response.data)
    toast.success(message)
    // The edited user may be you, and your active products show in your session.
    await refreshAuth()
    return true
  }

  function pickProduct(id: string) {
    setProductId(id)
    setVariantId(BASE_VARIANT_ID)
    const product = products.find((item) => item.id === id)
    if (product) setDays(String(product.durationDays))
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault()
    if (!productId) {
      toast.error('Choose a product')
      return
    }

    const body: Record<string, unknown> = { productId, variantId }
    if (effectiveEndChoice === 'days') {
      const count = Number(days)
      if (!Number.isInteger(count) || count < 1) {
        toast.error('Duration must be a whole number of days, 1 or more')
        return
      }
      body.durationDays = count
    } else if (effectiveEndChoice === 'currentEnd') {
      body.untilCurrentEnd = true
    }

    setSaving(true)
    try {
      await call(
        `/admin/users/${userId}/plan/${mode === 'now' ? 'override' : 'schedule'}`,
        { method: 'POST', body: JSON.stringify(body) },
        mode === 'now' ? 'Product started' : 'Product scheduled',
      )
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setConfirmBusy(true)
    try {
      if (deleting) {
        const done = await call(
          `/admin/users/${userId}/plan/periods/${deleting.period.periodId}`,
          { method: 'DELETE' },
          'Period deleted',
        )
        if (done) setDeleting(null)
      } else if (stopping) {
        const done = await call(
          `/admin/users/${userId}/plan/products/${stopping.id}/end`,
          { method: 'POST' },
          `${stopping.name} stopped`,
        )
        if (done) setStopping(null)
      }
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setConfirmBusy(false)
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

  if (!plan) {
    return <p className={hintClassName}>The plan could not be loaded.</p>
  }

  const now = Date.parse(plan.now)
  // Running and scheduled subscription periods can be deleted; ended ones are history.
  // One-time products are taken back from Purchases instead.
  const scheduled: Scheduled[] = plan.rows
    .filter((row) => row.product.kind === 'subscription')
    .flatMap((row) =>
      row.periods
        .filter(
          (period) => period.endsAt === null || Date.parse(period.endsAt) > now,
        )
        .map((period) => ({ product: row.product, period })),
    )
    .sort((a, b) => a.period.startsAt.localeCompare(b.period.startsAt))

  // The chosen product's running and scheduled periods decide what is possible.
  const selectedRow = plan.rows.find((row) => row.product.id === productId)
  const livePeriods =
    selectedRow?.periods.filter(
      (period) => period.endsAt === null || Date.parse(period.endsAt) > now,
    ) ?? []
  const current = livePeriods.find((period) => period.isCurrent) ?? null
  const lastLive = livePeriods.at(-1) ?? null
  const canReuseCurrentEnd = mode === 'now' && current?.endsAt != null
  const effectiveEndChoice: EndChoice =
    endChoice === 'currentEnd' && !canReuseCurrentEnd ? 'days' : endChoice
  const canQueue = lastLive === null || lastLive.endsAt !== null
  const queueStart = lastLive?.endsAt ?? null

  const confirmOpen = deleting !== null || stopping !== null

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Plan</h2>
        <p className={`mt-1 ${hintClassName}`}>
          Active subscriptions and their periods.
        </p>
      </div>

      <PlanGantt
        plan={plan}
        emptyText="This user has no products yet."
        rowActions={(row) =>
          row.active && row.product.kind === 'subscription' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStopping(row.product)}
            >
              Stop
            </Button>
          ) : null
        }
      />

      {scheduled.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Running and scheduled</h3>
          <ol className="space-y-2">
            {scheduled.map((item) => (
              <li
                key={item.period.periodId}
                className={`${cardClassName} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3`}
              >
                <ProductBadge product={item.product} />
                <span className="min-w-0 flex-1 text-sm text-[var(--muted)]">
                  {item.period.isCurrent ? (
                    <span className="mr-1.5 font-medium text-[var(--ink)]">
                      Running ·
                    </span>
                  ) : null}
                  From {formatDateTime(item.period.startsAt)},{' '}
                  {item.period.endsAt
                    ? `until ${formatDateTime(item.period.endsAt)}`
                    : 'no end'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${item.period.isCurrent ? 'running' : 'scheduled'} ${item.product.name} period`}
                  onClick={() => setDeleting(item)}
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
        <div className="space-y-1.5">
          <Label htmlFor="assign-product">Set a subscription</Label>
          <Select value={productId} onValueChange={pickProduct}>
            <SelectTrigger id="assign-product" className="w-full">
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {products.length === 0 ? (
            <p className={`text-xs ${hintClassName}`}>
              Create a subscription product first on the Products page.
            </p>
          ) : null}
        </div>

        <VariantSelect
          id="assign-variant"
          product={products.find((item) => item.id === productId) ?? null}
          value={variantId}
          onChange={(next, variantDays) => {
            setVariantId(next)
            if (variantDays) setDays(String(variantDays))
          }}
        />

        <fieldset className="space-y-2">
          <legend className="sr-only">When</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="product-mode"
              className="mt-1"
              checked={mode === 'now'}
              onChange={() => setMode('now')}
            />
            <span>
              Start now
              <span className={`block text-xs ${hintClassName}`}>
                {current
                  ? 'Cuts the running period of this product short.'
                  : 'Activates the product immediately.'}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="product-mode"
              className="mt-1"
              checked={mode === 'next'}
              onChange={() => setMode('next')}
            />
            <span>
              Add after this product&apos;s schedule
              <span className={`block text-xs ${hintClassName}`}>
                {!canQueue
                  ? 'Not possible while it is active with no end date.'
                  : queueStart
                    ? `Starts ${formatDateTime(queueStart)}.`
                    : 'Starts now.'}
              </span>
            </span>
          </label>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
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

          {effectiveEndChoice === 'days' ? (
            <div className="space-y-1.5">
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
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving || !productId || (mode === 'next' && !canQueue)}
          >
            {saving
              ? 'Saving…'
              : mode === 'now'
                ? 'Start product now'
                : 'Schedule product'}
          </Button>
        </div>
      </form>

      <Dialog
        open={confirmOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDeleting(null)
            setStopping(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleting
                ? `Delete the ${deleting.period.isCurrent ? 'running' : 'scheduled'} ${deleting.product.name} period?`
                : `Stop ${stopping?.name ?? ''} now?`}
            </DialogTitle>
            <DialogDescription>
              {deleting
                ? deleting.period.isCurrent
                  ? 'The product stops now and this period is removed as if it never happened. To keep it in history, use Stop instead. Any payment for it stays on record.'
                  : `It was due to start ${formatDateTime(deleting.period.startsAt)}. The product will not be active for that time.`
                : 'Its running period ends now. Scheduled periods of it are kept.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleting(null)
                setStopping(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmBusy}
              onClick={() => void handleConfirm()}
            >
              {confirmBusy
                ? 'Working…'
                : deleting
                  ? 'Delete period'
                  : 'Stop now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
