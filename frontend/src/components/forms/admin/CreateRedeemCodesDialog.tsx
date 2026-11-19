import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy } from 'lucide-react'
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
import { apiFetch } from '#/lib/api'
import type { Product } from '#/lib/product'
import { localInputToIso } from '#/lib/redeem'
import type { RedeemActivation, RedeemCode } from '#/lib/redeem'
import { hintClassName } from '#/lib/ui-classes'

type EndChoice = 'days' | 'date'

const MAX_QUANTITY = 50

/** Admin: make one or more redeem codes for a product, then copy them. */
export default function CreateRedeemCodesDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [activation, setActivation] = useState<RedeemActivation>('onRedeem')
  const [activatesAt, setActivatesAt] = useState('')
  const [endChoice, setEndChoice] = useState<EndChoice>('days')
  const [days, setDays] = useState('30')
  const [endsAt, setEndsAt] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<RedeemCode[] | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    apiFetch<Product[]>('/admin/products')
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          toast.error(res.message || 'Could not load products')
          return
        }
        setProducts(res.data.filter((product) => !product.deletedAt))
      })
      .catch(() => {
        if (!cancelled) toast.error('Unable to reach the server')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const product = products.find((item) => item.id === productId) ?? null
  const isSubscription = product?.kind === 'subscription'

  function reset() {
    setProductId('')
    setActivation('onRedeem')
    setActivatesAt('')
    setEndChoice('days')
    setDays('30')
    setEndsAt('')
    setValidUntil('')
    setQuantity('1')
    setCreated(null)
    setCopied(false)
  }

  function pickProduct(id: string) {
    setProductId(id)
    const next = products.find((item) => item.id === id)
    if (next?.durationDays) setDays(String(next.durationDays))
    if (next?.kind === 'oneTime') setActivation('onRedeem')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!product) {
      toast.error('Choose a product')
      return
    }
    const count = Number(quantity)
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUANTITY) {
      toast.error(`Make between 1 and ${MAX_QUANTITY} codes`)
      return
    }

    const body: Record<string, unknown> = {
      productId: product.id,
      activation: isSubscription ? activation : 'onRedeem',
      validUntil: localInputToIso(validUntil),
      quantity: count,
    }
    if (isSubscription) {
      if (activation === 'date') {
        const start = localInputToIso(activatesAt)
        if (!start) {
          toast.error('Choose when the product becomes active')
          return
        }
        body.activatesAt = start
      }
      if (endChoice === 'days') {
        const length = Number(days)
        if (!Number.isInteger(length) || length < 1) {
          toast.error('Duration must be a whole number of days, 1 or more')
          return
        }
        body.durationDays = length
      } else {
        const end = localInputToIso(endsAt)
        if (!end) {
          toast.error('Choose when the subscription ends')
          return
        }
        body.endsAt = end
      }
    }

    setSaving(true)
    try {
      const res = await apiFetch<RedeemCode[]>('/admin/redeem-codes', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Could not create codes')
        return
      }
      toast.success(res.message)
      setCreated(res.data)
      onCreated()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  async function copyAll() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(
        created.map((code) => code.code).join('\n'),
      )
      setCopied(true)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {created.length === 1 ? 'Code ready' : 'Codes ready'}
              </DialogTitle>
              <DialogDescription>
                Share {created.length === 1 ? 'it' : 'them'} with whoever should
                get {created[0]?.product?.name ?? 'the product'}.
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 font-mono text-sm">
              {created.map((code) => (
                <li key={code.id}>{code.code}</li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Make more
              </Button>
              <Button type="button" onClick={() => void copyAll()}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? 'Copied' : 'Copy all'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>New redeem codes</DialogTitle>
              <DialogDescription>
                Each code gives one person the product, once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="redeem-product">Product</Label>
              <Select value={productId} onValueChange={pickProduct}>
                <SelectTrigger id="redeem-product" className="w-full">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                      <span className="text-[var(--muted)]">
                        {item.kind === 'oneTime' ? ' · one-time' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {product && !isSubscription ? (
                <p className={`text-xs ${hintClassName}`}>
                  One-time: owned for good from the moment it is redeemed.
                </p>
              ) : null}
            </div>

            {isSubscription ? (
              <>
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">
                    Active from
                  </legend>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="redeem-activation"
                      className="mt-1"
                      checked={activation === 'onRedeem'}
                      onChange={() => setActivation('onRedeem')}
                    />
                    <span>
                      When redeemed
                      <span className={`block text-xs ${hintClassName}`}>
                        Starts right away, or after the time they already have.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="redeem-activation"
                      className="mt-1"
                      checked={activation === 'date'}
                      onChange={() => setActivation('date')}
                    />
                    <span>
                      A set date
                      <span className={`block text-xs ${hintClassName}`}>
                        Redeemed after this date, it starts right away.
                      </span>
                    </span>
                  </label>
                  {activation === 'date' ? (
                    <Input
                      type="datetime-local"
                      aria-label="Active from"
                      value={activatesAt}
                      onChange={(e) => setActivatesAt(e.target.value)}
                    />
                  ) : null}
                </fieldset>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="redeem-end">Ends</Label>
                    <Select
                      value={endChoice}
                      onValueChange={(value) =>
                        setEndChoice(value as EndChoice)
                      }
                    >
                      <SelectTrigger id="redeem-end" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">
                          After a number of days
                        </SelectItem>
                        <SelectItem value="date">On a date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {endChoice === 'days' ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="redeem-days">Days</Label>
                      <Input
                        id="redeem-days"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="redeem-ends-at">End date</Label>
                      <Input
                        id="redeem-ends-at"
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="redeem-valid-until">Valid until</Label>
                <Input
                  id="redeem-valid-until"
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
                <p className={`text-xs ${hintClassName}`}>
                  Last moment to redeem. Empty: never expires.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redeem-quantity">How many codes</Label>
                <Input
                  id="redeem-quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_QUANTITY}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !product}>
                {saving ? 'Creating…' : 'Create codes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
