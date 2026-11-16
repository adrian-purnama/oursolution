import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import DeploymentFields, {
  EMPTY_DEPLOYMENT,
  checkDeployment,
  toDeploymentBody,
  toDeploymentDraft,
} from '#/components/forms/admin/DeploymentFields'
import type { DeploymentDraft } from '#/components/forms/admin/DeploymentFields'
import ProductImagesField, {
  saveProductImages,
  toImageItems,
} from '#/components/forms/admin/ProductImagesField'
import type { ImageItem } from '#/components/forms/admin/ProductImagesField'
import { Button } from '#/components/ui/button'
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
import { PRODUCT_KIND_LABELS } from '#/lib/product'
import type { Product, ProductKind, ProductNotice } from '#/lib/product'
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
  notices: ProductNotice[]
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
  color: '#135ef5',
  pricingText: '',
  description: '',
  notices: [],
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
    notices: product.notices,
    priceIdr: String(product.priceIdr),
    durationDays: String(product.durationDays ?? 30),
    accessUrl: product.accessUrl ?? '',
    showOnPricingPage: product.showOnPricingPage,
    deployment: product.deployment ? product.deployment.type : 'none',
    settings: toDeploymentDraft(product.deployment),
  }
}

const sectionTitleClassName = 'text-sm font-medium'

const NOTICE_TONE_LABELS: Record<ProductNotice['tone'], string> = {
  info: 'Note',
  warning: 'Warning',
}

/** Rules and disclaimers buyers and subscribers read, in order. */
function NoticesField({
  value,
  onChange,
}: {
  value: ProductNotice[]
  onChange: (notices: ProductNotice[]) => void
}) {
  function set(index: number, patch: Partial<ProductNotice>) {
    onChange(
      value.map((notice, at) =>
        at === index ? { ...notice, ...patch } : notice,
      ),
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className={`mb-1 ${sectionTitleClassName}`}>Notices</legend>
      <p className={`text-xs ${hintClassName}`}>
        Rules and disclaimers, shown on the product page and on the customer's
        service. Supports Markdown, e.g. [contact us](https://…). Warnings stand
        out in amber.
      </p>
      {value.map((notice, index) => (
        <div
          key={index}
          className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
        >
          <Select
            value={notice.tone}
            onValueChange={(tone) =>
              set(index, { tone: tone as ProductNotice['tone'] })
            }
          >
            <SelectTrigger
              aria-label={`Notice ${index + 1}: kind`}
              className="w-full bg-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['info', 'warning'] as const).map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {NOTICE_TONE_LABELS[tone]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label={`Notice ${index + 1}: text`}
            value={notice.text}
            maxLength={1000}
            rows={2}
            placeholder="If you forget your password, it cannot be recovered."
            onChange={(event) => set(index, { text: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove notice ${index + 1}`}
            onClick={() => onChange(value.filter((_, at) => at !== index))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= 20}
        onClick={() => onChange([...value, { tone: 'info', text: '' }])}
      >
        <Plus aria-hidden />
        Add notice
      </Button>
    </fieldset>
  )
}

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
  const [images, setImages] = useState<ImageItem[]>([])
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
        setImages(toImageItems(response.data.images))
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
    const notices = draft.notices
      .map((notice) => ({ ...notice, text: notice.text.trim() }))
      .filter((notice) => notice.text)
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
        notices,
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

      const imageError = await saveProductImages(response.data, images)
      if (imageError) {
        toast.error(`Product saved, but: ${imageError}`)
        await navigate({ to: '/admin/products' })
        return
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
          Subscriptions run per period. One-time purchases are kept for good.
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

            <ProductImagesField value={images} onChange={setImages} />

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
                placeholder={
                  'What the buyer gets.\n\n- **Bold**, _italic_, [links](https://…)\n- Lists, headings (## Title), tables'
                }
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
              <p className={hintClassName}>Supports Markdown.</p>
            </div>

            <NoticesField
              value={draft.notices}
              onChange={(notices) => setDraft({ ...draft, notices })}
            />

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
                Show in the shop. Hidden products can still be extended.
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
