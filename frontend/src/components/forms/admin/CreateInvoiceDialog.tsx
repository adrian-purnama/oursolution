import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { PackagePlus, PencilLine, Trash2 } from 'lucide-react'
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
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import { formatIdr } from '#/lib/billing'
import type { Payment } from '#/lib/billing'
import { PRODUCT_KIND_LABELS, formatDays } from '#/lib/product'
import type { Product } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** Same caps as the checkout and the API. */
const MAX_LINES = 20
const MAX_SUBSCRIPTION_QUANTITY = 12
const MAX_CUSTOM_QUANTITY = 1000

type Line = {
  key: number
  /** Null for a custom line. */
  product: Product | null
  name: string
  description: string
  /** As typed, so the field can be empty while editing. */
  price: string
  quantity: string
}

let nextKey = 1

function maxQuantity(line: Line): number {
  if (!line.product) return MAX_CUSTOM_QUANTITY
  return line.product.kind === 'oneTime' ? 1 : MAX_SUBSCRIPTION_QUANTITY
}

function toWhole(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

function lineTotal(line: Line): number {
  return (toWhole(line.price) ?? 0) * (toWhole(line.quantity) ?? 0)
}

/**
 * Admin: bill a user for custom work (software projects, setup fees) or for
 * store products at the store price or a price just for them. The user pays
 * it from their billing page; store products are granted once paid.
 */
export default function CreateInvoiceDialog({
  userId,
  open,
  onOpenChange,
  onCreated,
}: {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (payment: Payment) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [dueDays, setDueDays] = useState('7')
  const [notify, setNotify] = useState(true)
  const [picker, setPicker] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLines([])
    setDueDays('7')
    setNotify(true)
    setPicker('')
    const run = { cancelled: false }
    void (async () => {
      try {
        const res = await apiFetch<Product[]>('/admin/products')
        if (run.cancelled) return
        if (res.success && res.data) {
          setProducts(res.data.filter((product) => !product.deletedAt))
        } else {
          toast.error(res.message || 'Could not load products')
        }
      } catch {
        if (!run.cancelled) toast.error('Unable to reach the server')
      }
    })()
    return () => {
      run.cancelled = true
    }
  }, [open])

  const usedProductIds = new Set(
    lines.flatMap((line) => (line.product ? [line.product.id] : [])),
  )
  const pickable = products.filter((p) => !usedProductIds.has(p.id))
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const full = lines.length >= MAX_LINES

  function update(key: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product || full) return
    setLines((current) => [
      ...current,
      {
        key: nextKey++,
        product,
        name: product.name,
        description: '',
        price: String(product.priceIdr),
        quantity: '1',
      },
    ])
    setPicker('')
  }

  function addCustom() {
    if (full) return
    setLines((current) => [
      ...current,
      {
        key: nextKey++,
        product: null,
        name: '',
        description: '',
        price: '',
        quantity: '1',
      },
    ])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lines.length === 0) {
      toast.error('Add at least one line')
      return
    }
    const due = toWhole(dueDays)
    if (!due || due < 1 || due > 90) {
      toast.error('Days to pay must be 1 to 90')
      return
    }

    const body = []
    for (const line of lines) {
      const price = toWhole(line.price)
      const quantity = toWhole(line.quantity)
      const label = line.product?.name ?? (line.name.trim() || 'A custom line')
      if (price === null) {
        toast.error(`${label}: enter a price`)
        return
      }
      if (!quantity || quantity < 1 || quantity > maxQuantity(line)) {
        toast.error(`${label}: quantity must be 1 to ${maxQuantity(line)}`)
        return
      }
      if (line.product) {
        body.push({
          type: 'product',
          productId: line.product.id,
          quantity,
          unitPriceIdr: price,
          description: line.description.trim() || null,
        })
      } else {
        if (!line.name.trim()) {
          toast.error('Each custom line needs a name')
          return
        }
        body.push({
          type: 'custom',
          name: line.name.trim(),
          description: line.description.trim() || null,
          unitPriceIdr: price,
          quantity,
        })
      }
    }

    setSaving(true)
    try {
      const res = await apiFetch<Payment>(`/admin/users/${userId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ lines: body, dueDays: due, notify }),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Could not make the invoice')
        return
      }
      toast.success(res.message || 'Invoice made')
      onCreated(res.data)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
            <DialogDescription>
              Bill custom work or shop products. Products are given once paid.
            </DialogDescription>
          </DialogHeader>

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              No lines yet. Add custom work or a product from the store.
            </p>
          ) : (
            <ol className="space-y-3">
              {lines.map((line, index) => (
                <InvoiceLineEditor
                  key={line.key}
                  line={line}
                  index={index}
                  onChange={(patch) => update(line.key, patch)}
                  onRemove={() =>
                    setLines((current) =>
                      current.filter((l) => l.key !== line.key),
                    )
                  }
                />
              ))}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addCustom}
              disabled={full}
            >
              <PencilLine className="size-4" aria-hidden />
              Add custom line
            </Button>
            <Select
              value={picker}
              onValueChange={addProduct}
              disabled={full || pickable.length === 0}
            >
              <SelectTrigger className="min-w-56" aria-label="Add from store">
                <PackagePlus className="size-4" aria-hidden />
                <SelectValue
                  placeholder={
                    pickable.length > 0 ? 'Add from store' : 'No products left'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {pickable.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} · {formatIdr(product.priceIdr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-due">Days to pay</Label>
              <Input
                id="invoice-due"
                inputMode="numeric"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
              />
              <p className={hintClassName}>
                1 to 90. Unpaid after that, the invoice expires.
              </p>
            </div>
            <label className="flex items-start gap-2 self-center text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <span>
                Email the invoice to the user
                <span className={`block ${hintClassName}`}>
                  With the PDF and a link to pay.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <p className="text-sm">
              Total{' '}
              <span className="font-semibold tabular-nums">
                {formatIdr(total)}
              </span>
              {lines.length > 0 && total === 0 ? (
                <span className={`block ${hintClassName}`}>
                  A free invoice is marked paid right away.
                </span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || lines.length === 0}>
                {saving ? 'Making…' : 'Make invoice'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InvoiceLineEditor({
  line,
  index,
  onChange,
  onRemove,
}: {
  line: Line
  index: number
  onChange: (patch: Partial<Line>) => void
  onRemove: () => void
}) {
  const id = `invoice-line-${line.key}`
  const product = line.product
  const storePrice = product?.priceIdr ?? null
  const price = toWhole(line.price)
  const max = maxQuantity(line)

  return (
    <li className="rounded-xl border border-[var(--line)] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            {index + 1}.{' '}
            {product
              ? `${PRODUCT_KIND_LABELS[product.kind]}${
                  product.durationDays
                    ? ` · ${formatDays(product.durationDays)} per period`
                    : ''
                }`
              : 'Custom line'}
          </p>
          {product ? (
            <p className="truncate font-medium">{product.name}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_5rem]">
        {product ? null : (
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input
              id={`${id}-name`}
              value={line.name}
              maxLength={120}
              placeholder="e.g. Company website, phase 1"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor={`${id}-description`}>
            Description{' '}
            <span className="font-normal text-[var(--muted)]">(optional)</span>
          </Label>
          <Textarea
            id={`${id}-description`}
            value={line.description}
            maxLength={1000}
            rows={2}
            placeholder={
              product
                ? 'e.g. Special price agreed for your team'
                : 'What the work covers'
            }
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-start-2">
          <Label htmlFor={`${id}-price`}>Unit price (Rp)</Label>
          <Input
            id={`${id}-price`}
            inputMode="numeric"
            value={line.price}
            placeholder="0"
            onChange={(e) =>
              onChange({ price: e.target.value.replace(/[^\d]/g, '') })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-qty`}>Qty</Label>
          <Input
            id={`${id}-qty`}
            inputMode="numeric"
            value={line.quantity}
            disabled={max === 1}
            onChange={(e) =>
              onChange({ quantity: e.target.value.replace(/[^\d]/g, '') })
            }
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={cn(hintClassName)}>
          {storePrice !== null && price !== null && price !== storePrice ? (
            <>
              Store price {formatIdr(storePrice)}{' '}
              <button
                type="button"
                className="cursor-pointer underline"
                onClick={() => onChange({ price: String(storePrice) })}
              >
                Reset
              </button>
            </>
          ) : storePrice !== null ? (
            'Store price'
          ) : null}
        </span>
        <span className="font-medium tabular-nums">
          {formatIdr(lineTotal(line))}
        </span>
      </div>
    </li>
  )
}
