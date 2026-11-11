import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { LoaderCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { ProductMark } from '#/components/ProductBadge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { apiFetch } from '#/lib/api'
import {
  PRODUCT_KIND_LABELS,
  formatDateTime,
  formatDays,
  formatIdr,
} from '#/lib/product'
import type { Product } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

export default function ProductsAdminForm() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [deleting, setDeleting] = useState<Product | null>(null)
  const [removing, setRemoving] = useState(false)
  const [purging, setPurging] = useState<Product | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setFailed(false)
    try {
      const response = await apiFetch<Product[]>('/admin/products')
      if (!response.success || !response.data) {
        setFailed(true)
        toast.error(response.message || 'Failed to load products')
        return
      }
      setProducts(response.data)
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

  async function handleDelete() {
    if (!deleting) return
    setRemoving(true)
    try {
      const response = await apiFetch<null>(`/admin/products/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!response.success) {
        toast.error(response.message || 'Failed to delete product')
        return
      }
      toast.success('Product deleted')
      setDeleting(null)
      await load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRemoving(false)
    }
  }

  async function handleRestore(product: Product) {
    setRestoringId(product.id)
    try {
      const response = await apiFetch<Product>(
        `/admin/products/${product.id}/restore`,
        { method: 'POST' },
      )
      if (!response.success) {
        toast.error(response.message || 'Failed to restore product')
        return
      }
      toast.success(`${product.name} restored`)
      await load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRestoringId(null)
    }
  }

  async function handlePurge() {
    if (!purging) return
    setRemoving(true)
    try {
      const response = await apiFetch<null>(
        `/admin/products/${purging.id}/permanent`,
        { method: 'DELETE' },
      )
      if (!response.success) {
        toast.error(response.message || 'Failed to remove product')
        return
      }
      toast.success('Product removed for good')
      setPurging(null)
      await load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRemoving(false)
    }
  }

  const liveProducts = products.filter((product) => !product.deletedAt)
  const deletedProducts = products.filter((product) => product.deletedAt)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/admin/products/new">
            <Plus aria-hidden />
            New product
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 py-4 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading products…
        </div>
      ) : failed ? (
        <div className={`${cardClassName} px-4 py-8 text-center`}>
          <p className={`mb-3 ${hintClassName}`}>
            Products could not be loaded.
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : liveProducts.length === 0 ? (
        <div className={`${cardClassName} px-4 py-8 text-center`}>
          <p className={`mb-3 ${hintClassName}`}>No products yet.</p>
          <Button asChild variant="outline">
            <Link to="/admin/products/new">Create the first product</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {liveProducts.map((product) => (
            <li
              key={product.id}
              className={`${cardClassName} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}
            >
              <ProductMark product={product} className="size-10 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{product.name}</span>
                  <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    {PRODUCT_KIND_LABELS[product.kind]}
                  </span>
                  {product.deployment ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">
                      Docker Compose
                    </span>
                  ) : null}
                  {product.showOnPricingPage ? null : (
                    <span className={`text-xs ${hintClassName}`}>
                      Hidden from pricing
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-[var(--ink)]">
                  {formatIdr(product.priceIdr)}
                  {product.durationDays
                    ? ` per ${formatDays(product.durationDays)}`
                    : ' once'}
                  {product.pricingText ? (
                    <span className="text-[var(--muted)]">
                      {' · shown as “'}
                      {product.pricingText}
                      {'”'}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="icon">
                  <Link
                    to="/admin/products/$productId"
                    params={{ productId: product.id }}
                    aria-label={`Edit ${product.name}`}
                  >
                    <Pencil aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${product.name}`}
                  onClick={() => setDeleting(product)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !failed && deletedProducts.length > 0 ? (
        <section className="space-y-2 pt-4">
          <h2 className="text-sm font-medium">
            Deleted
            <span className={`ml-2 font-normal ${hintClassName}`}>
              Hidden from pricing and assignment. Owners keep access.
            </span>
          </h2>
          <ul className="space-y-2">
            {deletedProducts.map((product) => (
              <li
                key={product.id}
                className={`${cardClassName} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 opacity-75`}
              >
                <ProductMark
                  product={product}
                  className="size-8 rounded-md grayscale"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{product.name}</span>
                  <p className={`text-xs ${hintClassName}`}>
                    {PRODUCT_KIND_LABELS[product.kind]} · deleted{' '}
                    {product.deletedAt ? formatDateTime(product.deletedAt) : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={restoringId === product.id}
                    onClick={() => void handleRestore(product)}
                  >
                    <RotateCcw aria-hidden />
                    {restoringId === product.id ? 'Restoring…' : 'Restore'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${product.name} for good`}
                    onClick={() => setPurging(product)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={deleting !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?.kind === 'oneTime'
                ? 'It disappears from the pricing page and can no longer be bought or given. People who own it keep access. You can restore it later.'
                : 'It disappears from the pricing page and can no longer be checked out or assigned. Only possible when nobody has it running or scheduled. You can restore it later.'}
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
              {removing ? 'Deleting…' : 'Delete product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={purging !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPurging(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {purging?.name} for good?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Only possible when no period, purchase or
              payment refers to it; otherwise it stays deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPurging(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              onClick={() => void handlePurge()}
            >
              {removing ? 'Removing…' : 'Remove for good'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
