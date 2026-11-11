import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { ArrowLeft, ImagePlus, LoaderCircle } from 'lucide-react'
import DeploymentFields, {
  EMPTY_DEPLOYMENT,
  checkDeployment,
  toDeploymentBody,
  toDeploymentDraft,
} from '#/components/forms/admin/DeploymentFields'
import type { DeploymentDraft } from '#/components/forms/admin/DeploymentFields'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch, apiUpload, toAbsoluteMediaUrl } from '#/lib/api'
import { PRODUCT_KIND_LABELS } from '#/lib/product'
import type { Product, ProductKind } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

type DeploymentChoice = 'none' | 'dockerCompose'

const DEPLOYMENT_LABELS: Record<DeploymentChoice, string> = {
  none: 'Nothing to deploy',
  dockerCompose: 'Docker Compose',
}

type Draft = {
  name: string
  kind: ProductKind
  color: string
  pricingText: string
  description: string
  priceIdr: string
  durationDays: string
  accessUrl: string
  showOnPricingPage: boolean
  deployment: DeploymentChoice
  settings: DeploymentDraft
}

const EMPTY_DRAFT: Draft = {
  name: '',
  kind: 'subscription',
  color: '#1a5c4a',
  pricingText: '',
  description: '',
  priceIdr: '0',
  durationDays: '30',
  accessUrl: '',
  showOnPricingPage: true,
  deployment: 'none',
  settings: EMPTY_DEPLOYMENT,
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    kind: product.kind,
    color: product.color,
    pricingText: product.pricingText,
    description: product.description,
    priceIdr: String(product.priceIdr),
    durationDays: String(product.durationDays ?? 30),
    accessUrl: product.accessUrl ?? '',
    showOnPricingPage: product.showOnPricingPage,
    deployment: product.deployment ? product.deployment.type : 'none',
    settings: toDeploymentDraft(product.deployment),
  }
}

const sectionTitleClassName = 'text-sm font-medium'

/** Creates a product, or edits the one with `productId`. */
export default function ProductEditorForm({
  productId,
}: {
  productId?: string
}) {
  const navigate = useNavigate()
  const isNew = productId === undefined

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productId) return
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const response = await apiFetch<Product>(`/admin/products/${productId}`)
        if (run.cancelled) return
        if (!response.success || !response.data) {
          toast.error(response.message || 'Failed to load product')
          return
        }
        setProduct(response.data)
        setDraft(toDraft(response.data))
        setImagePreview(toAbsoluteMediaUrl(response.data.imageUrl))
      } catch {
        if (!run.cancelled) toast.error('Unable to reach the server')
      } finally {
        if (!run.cancelled) setLoading(false)
      }
    })()

    return () => {
      run.cancelled = true
    }
  }, [productId])

  // A picked file previews from a blob URL, which must be released.
  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handleImagePick(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files?.[0] ?? null)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()

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

    const deploys = isSubscription && draft.deployment === 'dockerCompose'
    if (deploys && !draft.settings.projectId) {
      toast.error('Choose the Dokploy project to deploy into')
      return
    }
    if (deploys && !draft.settings.composeFile.trim()) {
      toast.error('The compose file is empty')
      return
    }
    setSaving(true)
    try {
      if (deploys) {
        const check = await checkDeployment(draft.settings)
        if (check && !check.valid) {
          const count = check.issues.filter(
            (issue) => issue.severity === 'error',
          ).length
          toast.error(
            `Fix ${count} ${count === 1 ? 'problem' : 'problems'} in the deployment first`,
          )
          document
            .getElementById('product-deployment')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }

      const body = JSON.stringify({
        name: draft.name.trim(),
        // The kind is fixed once the product exists.
        ...(isNew ? { kind: draft.kind } : {}),
        color: draft.color,
        pricingText: draft.pricingText.trim(),
        description: draft.description.trim(),
        priceIdr,
        ...(isSubscription
          ? {
              durationDays,
              deployment: deploys
                ? {
                    type: 'dockerCompose',
                    projectId: draft.settings.projectId,
                    ...toDeploymentBody(draft.settings),
                  }
                : null,
            }
          : { accessUrl: draft.accessUrl.trim() || null }),
        showOnPricingPage: draft.showOnPricingPage,
      })

      const response = isNew
        ? await apiFetch<Product>('/admin/products', { method: 'POST', body })
        : await apiFetch<Product>(`/admin/products/${productId}`, {
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
          await navigate({ to: '/admin/products' })
          return
        }
      }

      toast.success(isNew ? 'Product created' : 'Product updated')
      await navigate({ to: '/admin/products' })
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-8">
        <Link
          to="/admin/products"
          className={`mb-3 inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Products
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {isNew ? 'New product' : (product?.name ?? 'Edit product')}
        </h1>
        <p className={`mt-2 ${hintClassName}`}>
          A subscription stays active for its duration per checkout. A one-time
          purchase is bought once and kept for good.
        </p>
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading product…
        </div>
      ) : !isNew && !product ? (
        <p className={hintClassName}>This product could not be loaded.</p>
      ) : (
        <form
          className="space-y-10"
          onSubmit={(event) => void handleSave(event)}
        >
          <section className="space-y-5">
            <fieldset className="space-y-1.5">
              <legend className={`mb-1 ${sectionTitleClassName}`}>Type</legend>
              {isNew ? (
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
          </section>

          <section className="space-y-5">
            <h2 className={sectionTitleClassName}>Pricing</h2>
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

            <div className="space-y-1.5">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                value={draft.description}
                maxLength={4000}
                rows={5}
                placeholder="What the buyer gets. Line breaks are kept."
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
              <p className={hintClassName}>
                The card shows the first few lines; the product page shows it
                all.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.showOnPricingPage}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    showOnPricingPage: event.target.checked,
                  })
                }
              />
              <span>
                Show on the pricing page. When hidden, current subscribers can
                still extend, but nobody new can buy it.
              </span>
            </label>
          </section>

          {draft.kind === 'oneTime' ? (
            <section className="space-y-1.5">
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
            </section>
          ) : (
            <section id="product-deployment" className="scroll-mt-20 space-y-5">
              <fieldset className="space-y-1.5">
                <legend className={`mb-1 ${sectionTitleClassName}`}>
                  Deployment
                </legend>
                <p className={`text-xs ${hintClassName}`}>
                  What a subscriber gets deployed.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                  {(['none', 'dockerCompose'] as const).map((choice) => (
                    <label
                      key={choice}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="product-deployment"
                        checked={draft.deployment === choice}
                        onChange={() =>
                          setDraft({ ...draft, deployment: choice })
                        }
                      />
                      {DEPLOYMENT_LABELS[choice]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {draft.deployment === 'dockerCompose' ? (
                <DeploymentFields
                  value={draft.settings}
                  onChange={(settings) => setDraft({ ...draft, settings })}
                />
              ) : null}
            </section>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-5">
            <Button asChild variant="outline">
              <Link to="/admin/products">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save product'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
