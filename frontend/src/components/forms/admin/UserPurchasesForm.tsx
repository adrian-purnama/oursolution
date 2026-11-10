import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle } from 'lucide-react'
import PurchaseList from '#/components/PurchaseList'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
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
import type { Product, Purchase } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** Admin: the one-time products a user owns, with give and take back. */
export default function UserPurchasesForm({ userId }: { userId: string }) {
  const { refreshAuth } = useAuth()

  const [purchases, setPurchases] = useState<Purchase[] | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [revoking, setRevoking] = useState<Purchase | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const [purchasesRes, productsRes] = await Promise.all([
          apiFetch<Purchase[]>(`/admin/users/${userId}/purchases`),
          apiFetch<Product[]>('/admin/products'),
        ])
        if (run.cancelled) return
        if (!purchasesRes.success || !purchasesRes.data) {
          toast.error(purchasesRes.message || 'Failed to load purchases')
          return
        }
        setPurchases(purchasesRes.data)
        if (productsRes.success && productsRes.data) {
          setProducts(
            productsRes.data.filter(
              (product) => product.kind === 'oneTime' && !product.deletedAt,
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

  async function apply(path: string, init: RequestInit, message: string) {
    const response = await apiFetch<Purchase[]>(path, init)
    if (!response.success || !response.data) {
      toast.error(response.message || 'Something went wrong')
      return false
    }
    setPurchases(response.data)
    toast.success(message)
    // The edited user may be you, and what you own shows in your session.
    await refreshAuth()
    return true
  }

  async function handleGive(event: FormEvent) {
    event.preventDefault()
    if (!productId) {
      toast.error('Choose a product')
      return
    }
    setSaving(true)
    try {
      const done = await apply(
        `/admin/users/${userId}/purchases`,
        { method: 'POST', body: JSON.stringify({ productId }) },
        'Product given',
      )
      if (done) setProductId('')
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke() {
    if (!revoking) return
    setRevokeBusy(true)
    try {
      const done = await apply(
        `/admin/users/${userId}/purchases/${revoking.purchaseId}`,
        { method: 'DELETE' },
        `${revoking.product.name} taken back`,
      )
      if (done) setRevoking(null)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRevokeBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading purchases…
      </div>
    )
  }

  if (!purchases) {
    return <p className={hintClassName}>Purchases could not be loaded.</p>
  }

  const ownedIds = new Set(purchases.map((purchase) => purchase.product.id))
  const givable = products.filter((product) => !ownedIds.has(product.id))

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Purchases</h2>
        <p className={`mt-1 ${hintClassName}`}>
          One-time products this user owns. They never expire.
        </p>
      </div>

      <PurchaseList
        purchases={purchases}
        emptyText="This user owns no one-time products."
        actions={(purchase) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRevoking(purchase)}
          >
            Take back
          </Button>
        )}
      />

      <form
        className={`${cardClassName} flex flex-wrap items-end gap-3 p-4`}
        onSubmit={(event) => void handleGive(event)}
      >
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="give-product">Give a one-time product</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="give-product" className="w-full">
              <SelectValue
                placeholder={
                  givable.length > 0
                    ? 'Choose a product'
                    : 'Nothing left to give'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {givable.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={saving || !productId}>
          {saving ? 'Giving…' : 'Give product'}
        </Button>
      </form>

      <Dialog
        open={revoking !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRevoking(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take back {revoking?.product.name}?</DialogTitle>
            <DialogDescription>
              The user loses access to it. Any payment for it stays on record
              and is not refunded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevoking(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revokeBusy}
              onClick={() => void handleRevoke()}
            >
              {revokeBusy ? 'Taking back…' : 'Take back'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
