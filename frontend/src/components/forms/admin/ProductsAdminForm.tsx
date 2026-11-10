import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
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
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { apiFetch, apiUpload, toAbsoluteMediaUrl } from '#/lib/api'
import {
  PRODUCT_KIND_LABELS,
  formatDateTime,
  formatDays,
  formatIdr,
} from '#/lib/product'
import type { Product, ProductKind } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

type Draft = {
  name: string
  kind: ProductKind
  color: string
  pricingText: string
  priceIdr: string
  durationDays: string
  accessUrl: string
  showOnPricingPage: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  kind: 'subscription',
  color: '#1a5c4a',
  pricingText: '',
  priceIdr: '0',
  durationDays: '30',
  accessUrl: '',
  showOnPricingPage: true,
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    kind: product.kind,
    color: product.color,
    pricingText: product.pricingText,
    priceIdr: String(product.priceIdr),
    durationDays: String(product.durationDays ?? 30),
    accessUrl: product.accessUrl ?? '',
    showOnPricingPage: product.showOnPricingPage,
  }
}

export default function ProductsAdminForm() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  /** null = closed, 'new' = creating, otherwise the product being edited. */
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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

  // A picked file previews from a blob URL, which must be released.
  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function open(target: Product | 'new') {
    setDraft(target === 'new' ? EMPTY_DRAFT : toDraft(target))
    setImageFile(null)
    setImagePreview(
      target === 'new' ? null : toAbsoluteMediaUrl(target.imageUrl),
    )
    setEditing(target)
  }

  function handleImagePick(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files?.[0] ?? null)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!editing) return

    const priceIdr = Number(draft.priceIdr)
    const durationDays = Number(draft.durationDays)
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!Number.isInteger(priceIdr) || priceIdr < 0) {
      toast.error('Price must be a whole number of rupiah, 0 or more')
      return
    }
    const isSubscription = draft.kind === 'subscription'
    if (
      isSubscription &&
      (!Number.isInteger(durationDays) || durationDays < 1)
    ) {
      toast.error('Duration must be a whole number of days, 1 or more')
      return
    }

    const body = JSON.stringify({
      name: draft.name.trim(),
      // The kind is fixed once the product exists.
      ...(editing === 'new' ? { kind: draft.kind } : {}),
      color: draft.color,
      pricingText: draft.pricingText.trim(),
      priceIdr,
      ...(isSubscription
        ? { durationDays }
        : { accessUrl: draft.accessUrl.trim() || null }),
      showOnPricingPage: draft.showOnPricingPage,
    })

    setSaving(true)
    try {
      const response =
        editing === 'new'
          ? await apiFetch<Product>('/admin/products', { method: 'POST', body })
          : await apiFetch<Product>(`/admin/products/${editing.id}`, {
              method: 'PATCH',
              body,
            })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to save product')
        return
      }

      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        const upload = await apiUpload<Product>(
          `/admin/products/${response.data.id}/image`,
          formData,
        )
        if (!upload.success) {
          toast.error(upload.message || 'Product saved, but the image failed')
          setEditing(null)
          await load()
          return
        }
      }

      toast.success(editing === 'new' ? 'Product created' : 'Product updated')
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
        <Button type="button" onClick={() => open('new')}>
          <Plus aria-hidden />
          New product
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
          <Button type="button" variant="outline" onClick={() => open('new')}>
            Create the first product
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${product.name}`}
                  onClick={() => open(product)}
                >
                  <Pencil aria-hidden />
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
        open={editing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditing(null)
        }}
      >
        <DialogContent>
          <form
            className="space-y-5"
            onSubmit={(event) => void handleSave(event)}
          >
            <DialogHeader>
              <DialogTitle>
                {editing === 'new' ? 'New product' : 'Edit product'}
              </DialogTitle>
              <DialogDescription>
                A subscription stays active for its duration per checkout. A
                one-time purchase is bought once and kept for good.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Product image preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlus
                    className="size-5 text-[var(--muted)]"
                    aria-hidden
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-image">Image</Label>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="block text-sm file:mr-3 file:rounded-md file:border file:border-[var(--line)] file:bg-white file:px-3 file:py-1.5 file:text-sm"
                />
                <p className={`text-xs ${hintClassName}`}>
                  Public. Shown on the pricing page.
                </p>
              </div>
            </div>

            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-sm font-medium">Type</legend>
              {editing === 'new' ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {(['subscription', 'oneTime'] as const).map((kind) => (
                    <label
                      key={kind}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="product-kind"
                        checked={draft.kind === kind}
                        onChange={() => setDraft({ ...draft, kind })}
                      />
                      {PRODUCT_KIND_LABELS[kind]}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm">
                  {PRODUCT_KIND_LABELS[draft.kind]}
                  <span className={`block text-xs ${hintClassName}`}>
                    The type cannot be changed once the product exists.
                  </span>
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={draft.name}
                  maxLength={60}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-color">Color</Label>
                <input
                  id="product-color"
                  type="color"
                  value={draft.color}
                  onChange={(event) =>
                    setDraft({ ...draft, color: event.target.value })
                  }
                  className="block h-9 w-16 cursor-pointer rounded-md border border-[var(--line)] bg-white p-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">Price charged (IDR)</Label>
                <Input
                  id="product-price"
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
              {draft.kind === 'subscription' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="product-duration">Days per checkout</Label>
                  <Input
                    id="product-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={draft.durationDays}
                    onChange={(event) =>
                      setDraft({ ...draft, durationDays: event.target.value })
                    }
                  />
                </div>
              ) : null}
            </div>

            {draft.kind === 'oneTime' ? (
              <div className="space-y-1.5">
                <Label htmlFor="product-access-url">Access link</Label>
                <Input
                  id="product-access-url"
                  type="url"
                  value={draft.accessUrl}
                  placeholder="https://…"
                  onChange={(event) =>
                    setDraft({ ...draft, accessUrl: event.target.value })
                  }
                />
                <p className={`text-xs ${hintClassName}`}>
                  Only owners see it, on their profile. Optional.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="product-pricing-text">Pricing text</Label>
              <Input
                id="product-pricing-text"
                value={draft.pricingText}
                maxLength={120}
                placeholder="Rp 99.000 / month"
                onChange={(event) =>
                  setDraft({ ...draft, pricingText: event.target.value })
                }
              />
            </div>

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
              Show on the pricing page. When hidden, current subscribers can
              still extend, but nobody new can buy it.
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
