import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CircleX,
  LoaderCircle,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import DeploymentFields, {
  checkDeployment,
  toDeploymentBody,
} from '#/components/forms/admin/DeploymentFields'
import ProductImagesField, {
  saveProductImages,
  toImageItems,
} from '#/components/forms/admin/ProductImagesField'
import type { ImageItem } from '#/components/forms/admin/ProductImagesField'
import ProductVariantsField, {
  ProblemDot,
  VariantPicker,
  emptyVariants,
  isBase,
  priceLine,
  settingsToCheck,
  toVariantDrafts,
  toVariantsBody,
  usdProblem,
  variantLabel,
  variantProblems,
} from '#/components/forms/admin/ProductVariantsField'
import type {
  EditorTab,
  Problem,
  VariantDraft,
} from '#/components/forms/admin/ProductVariantsField'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import { PRODUCT_KIND_LABELS, formatIdr } from '#/lib/product'
import type { Product, ProductKind, ProductNotice } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

type DeploymentChoice = 'none' | 'dockerCompose'

/** Inactive panels stay mounted so their state and ids survive tab switches. */
const tabPanelClassName = 'space-y-5 data-[state=inactive]:hidden'

const DEPLOYMENT_LABELS: Record<DeploymentChoice, string> = {
  none: 'Nothing to deploy',
  dockerCompose: 'Docker Compose',
}

const TAB_LABELS: Record<EditorTab, string> = {
  general: 'General',
  pricing: 'Pricing',
  variants: 'Variants',
  delivery: 'Deployment',
}

type Draft = {
  name: string
  kind: ProductKind
  color: string
  notices: ProductNotice[]
  accessUrl: string
  showOnPricingPage: boolean
  deployment: DeploymentChoice
  /** The base variant first: the product's own price, days and settings. */
  variants: VariantDraft[]
}

function emptyDraft(): Draft {
  return {
    name: '',
    kind: 'subscription',
    color: '#035bfe',
    notices: [],
    accessUrl: '',
    showOnPricingPage: true,
    deployment: 'none',
    variants: emptyVariants(),
  }
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    kind: product.kind,
    color: product.color,
    notices: product.notices,
    accessUrl: product.accessUrl ?? '',
    showOnPricingPage: product.showOnPricingPage,
    deployment: product.deployment ? product.deployment.type : 'none',
    variants: toVariantDrafts(product),
  }
}

/** What the USD price does, under every USD field. */
const USD_HINT =
  'USD prices are billed by Paddle, with tax added where required. Subscriptions renew automatically every period. Empty: sold only in Indonesia.'

/** Everything that is missing or odd, for every tab. */
function problemsOf(draft: Draft): Problem[] {
  const problems: Problem[] = []
  if (!draft.name.trim()) {
    problems.push({
      tab: 'general',
      severity: 'error',
      message: 'The product needs a name',
    })
  }
  if (!draft.variants[0].description.trim()) {
    problems.push({
      tab: 'general',
      variantKey: draft.variants[0].key,
      severity: 'warning',
      message: 'No description yet. The product page tells buyers nothing',
    })
  }
  if (draft.kind === 'subscription') {
    problems.push(
      ...variantProblems(draft.variants, draft.deployment === 'dockerCompose'),
    )
  } else {
    const price = Number(draft.variants[0].priceIdr)
    if (
      !Number.isInteger(price) ||
      price < 0 ||
      !draft.variants[0].priceIdr.trim()
    ) {
      problems.push({
        tab: 'pricing',
        severity: 'error',
        message: 'The price must be a whole number of rupiah, 0 or more',
      })
    }
    const usd = usdProblem(draft.variants[0].priceUsd)
    if (usd) {
      problems.push({
        tab: 'pricing',
        severity: 'error',
        message: usd.charAt(0).toUpperCase() + usd.slice(1),
      })
    }
  }
  return problems
}

/** A tab's problems, each a link to the variant it is about. */
function ProblemList({
  problems,
  onOpen,
}: {
  problems: Problem[]
  onOpen?: (problem: Problem) => void
}) {
  if (problems.length === 0) return null
  const errors = problems.filter((problem) => problem.severity === 'error')
  const ordered = [
    ...errors,
    ...problems.filter((problem) => problem.severity === 'warning'),
  ]
  return (
    <div
      className="overflow-hidden rounded-md border border-[var(--line)] bg-white"
      aria-live="polite"
    >
      <p className="border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium">
        {errors.length > 0
          ? `${errors.length} ${errors.length === 1 ? 'thing' : 'things'} to fix before saving`
          : `${problems.length} ${problems.length === 1 ? 'warning' : 'warnings'}. You can still save`}
      </p>
      <ul className="divide-y divide-[var(--line)]">
        {ordered.map((problem, index) => {
          const isError = problem.severity === 'error'
          const Icon = isError ? CircleX : TriangleAlert
          const body: ReactNode = (
            <>
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${isError ? 'text-[var(--destructive)]' : 'text-amber-600'}`}
                aria-label={isError ? 'Error' : 'Warning'}
              />
              <span className="min-w-0">{problem.message}</span>
            </>
          )
          return (
            <li key={index}>
              {onOpen && problem.variantKey ? (
                <button
                  type="button"
                  className="flex w-full gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface)]"
                  onClick={() => onOpen(problem)}
                >
                  {body}
                </button>
              ) : (
                <div className="flex gap-2 px-3 py-2 text-sm">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
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
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [images, setImages] = useState<ImageItem[]>([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<EditorTab>('general')
  const [selectedKey, setSelectedKey] = useState('')

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

  const isSubscription = draft.kind === 'subscription'
  const deploys = isSubscription && draft.deployment === 'dockerCompose'
  const variants = isSubscription ? draft.variants : draft.variants.slice(0, 1)
  const many = variants.length > 1
  const base = variants[0]
  const selected =
    variants.find((variant) => variant.key === selectedKey) ?? base
  const selectedIndex = variants.indexOf(selected)
  const problems = problemsOf(draft)
  const problemsIn = (at: EditorTab) =>
    problems.filter((problem) => problem.tab === at)
  const errorCount = problems.filter(
    (problem) => problem.severity === 'error',
  ).length

  function setVariants(next: VariantDraft[]) {
    setDraft({ ...draft, variants: next })
  }

  function setVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants(
      draft.variants.map((variant) =>
        variant.key === key ? { ...variant, ...patch } : variant,
      ),
    )
  }

  /** Shows a tab, and in it the given variant. */
  function open(at: EditorTab, variantKey?: string) {
    setTab(at)
    if (variantKey) setSelectedKey(variantKey)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()

    const blocking = problems.find((problem) => problem.severity === 'error')
    if (blocking) {
      open(blocking.tab, blocking.variantKey)
      toast.error(blocking.message)
      return
    }

    const notices = draft.notices
      .map((notice) => ({ ...notice, text: notice.text.trim() }))
      .filter((notice) => notice.text)
    setSaving(true)
    try {
      if (deploys) {
        // The server judges the compose files; ask before saving so the
        // admin lands on the variant at fault.
        for (const [index, variant] of variants.entries()) {
          if (!isBase(variant) && !variant.ownDeployment) continue
          const check = await checkDeployment(settingsToCheck(variant, base))
          if (check && !check.valid) {
            const count = check.issues.filter(
              (issue) => issue.severity === 'error',
            ).length
            open('delivery', variant.key)
            const where = many
              ? `${variantLabel(variant, index)}'s deployment`
              : 'the deployment'
            toast.error(
              `Fix ${count} ${count === 1 ? 'problem' : 'problems'} in ${where} first`,
            )
            document
              .getElementById('product-deployment')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
          }
        }
      }

      const pricing = toVariantsBody(variants, deploys)
      const body = JSON.stringify({
        name: draft.name.trim(),
        // The kind is fixed once the product exists.
        ...(isNew ? { kind: draft.kind } : {}),
        color: draft.color,
        pricingText: pricing.pricingText,
        description: pricing.description,
        notices,
        priceIdr: pricing.priceIdr,
        priceUsdCents: pricing.priceUsdCents,
        ...(isSubscription
          ? {
              ...pricing,
              deployment: deploys
                ? {
                    type: 'dockerCompose',
                    projectId: base.settings.projectId,
                    ...toDeploymentBody(base.settings),
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

  const tabs: EditorTab[] = isSubscription
    ? ['general', 'pricing', 'variants', 'delivery']
    : ['general', 'pricing', 'delivery']

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
          className="space-y-8"
          onSubmit={(event) => void handleSave(event)}
        >
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as EditorTab)}
          >
            <TabsList className="mb-6 max-w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((at) => (
                <TabsTrigger key={at} value={at} className="gap-1.5">
                  {at === 'delivery' && !isSubscription
                    ? 'Access'
                    : TAB_LABELS[at]}
                  {at === 'variants' && many ? ` (${variants.length})` : ''}
                  <ProblemDot problems={problemsIn(at)} />
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent
              value="general"
              forceMount
              className={tabPanelClassName}
            >
              <ProblemList problems={problemsIn('general')} />

              <fieldset className="space-y-1.5">
                <legend className={`mb-1 ${sectionTitleClassName}`}>
                  Type
                </legend>
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
                    aria-invalid={
                      !draft.name.trim() &&
                      problemsIn('general').some(
                        (problem) => problem.severity === 'error',
                      )
                    }
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

              <div className="space-y-3 border-t border-[var(--line)] pt-5">
                <VariantPicker
                  variants={variants}
                  selected={selected.key}
                  onSelect={setSelectedKey}
                  problems={problemsIn('general')}
                  describe={(variant) =>
                    isBase(variant)
                      ? 'Product description'
                      : variant.description.trim()
                        ? 'Own description'
                        : 'Same as base'
                  }
                />

                <div className="space-y-1.5">
                  <Label htmlFor="product-description">
                    {many
                      ? `Description: ${variantLabel(selected, selectedIndex)}`
                      : 'Description'}
                  </Label>
                  <Textarea
                    id="product-description"
                    value={selected.description}
                    maxLength={4000}
                    rows={many ? 8 : 5}
                    placeholder={
                      isBase(selected)
                        ? 'What the buyer gets.\n\n- **Bold**, _italic_, [links](https://…)\n- Lists, headings (## Title), tables'
                        : `Leave empty to show ${variantLabel(base, 0)}'s description.\n\nOr describe what this variant gives, in Markdown.`
                    }
                    onChange={(event) =>
                      setVariant(selected.key, {
                        description: event.target.value,
                      })
                    }
                  />
                  <p className={`text-xs ${hintClassName}`}>
                    {!many
                      ? 'Supports Markdown.'
                      : isBase(selected)
                        ? 'Supports Markdown. Shown before a variant is picked, and for variants without their own.'
                        : 'Supports Markdown. Shown once a customer picks this variant.'}
                  </p>
                </div>

                <NoticesField
                  value={draft.notices}
                  onChange={(notices) => setDraft({ ...draft, notices })}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="pricing"
              forceMount
              className={tabPanelClassName}
            >
              <ProblemList problems={problemsIn('pricing')} />

              {many ? (
                <fieldset className="space-y-2">
                  <legend className={`mb-1 ${sectionTitleClassName}`}>
                    Price per variant
                  </legend>
                  <div
                    className={`hidden gap-3 px-3 text-xs sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] ${hintClassName}`}
                    aria-hidden
                  >
                    <span>Variant</span>
                    <span>Price charged (IDR)</span>
                    <span>Outside ID (USD)</span>
                    <span>Days per checkout</span>
                  </div>
                  {variants.map((variant, index) => {
                    const mine = problemsIn('pricing').filter(
                      (problem) => problem.variantKey === variant.key,
                    )
                    const label = variantLabel(variant, index)
                    const price = Number(variant.priceIdr)
                    const days = Number(variant.durationDays)
                    const per30 =
                      Number.isInteger(price) &&
                      Number.isInteger(days) &&
                      days > 0
                        ? formatIdr(Math.round((price / days) * 30))
                        : null
                    const errorAbout = (word: string) =>
                      mine.some(
                        (problem) =>
                          problem.severity === 'error' &&
                          problem.message.includes(word),
                      )
                    return (
                      <div
                        key={variant.key}
                        className="grid grid-cols-2 items-center gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem]"
                      >
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {label}
                            <ProblemDot problems={mine} />
                          </p>
                          <p className={`truncate text-xs ${hintClassName}`}>
                            {per30 ? `About ${per30} per 30 days` : 'Not set'}
                          </p>
                        </div>
                        <Input
                          aria-label={`${label}: price charged (IDR)`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={variant.priceIdr}
                          aria-invalid={errorAbout('price')}
                          onChange={(event) =>
                            setVariant(variant.key, {
                              priceIdr: event.target.value,
                            })
                          }
                        />
                        <Input
                          aria-label={`${label}: price outside Indonesia (USD)`}
                          type="number"
                          inputMode="decimal"
                          min={0.5}
                          step={0.01}
                          placeholder="Not sold"
                          value={variant.priceUsd}
                          aria-invalid={errorAbout('USD')}
                          onChange={(event) =>
                            setVariant(variant.key, {
                              priceUsd: event.target.value,
                            })
                          }
                        />
                        <Input
                          aria-label={`${label}: days per checkout`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={variant.durationDays}
                          aria-invalid={errorAbout('days')}
                          onChange={(event) =>
                            setVariant(variant.key, {
                              durationDays: event.target.value,
                            })
                          }
                        />
                        <div className="col-span-2 space-y-1 sm:col-span-4">
                          <Input
                            aria-label={`${label}: pricing text`}
                            value={variant.pricingText}
                            maxLength={120}
                            placeholder={
                              index === 0
                                ? 'Pricing text, e.g. From Rp 49.000 / month'
                                : `Pricing text. Empty shows ${Number.isInteger(price) ? formatIdr(price) : 'the price'}`
                            }
                            onChange={(event) =>
                              setVariant(variant.key, {
                                pricingText: event.target.value,
                              })
                            }
                          />
                          {index === 0 ? (
                            <p className={`text-xs ${hintClassName}`}>
                              Also the text on the product card in the shop.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  <p className={`text-xs ${hintClassName}`}>{USD_HINT}</p>
                  <p className={`text-xs ${hintClassName}`}>
                    Name variants and add more on the{' '}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-[var(--ink)]"
                      onClick={() => open('variants')}
                    >
                      Variants tab
                    </button>
                    .
                  </p>
                </fieldset>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="product-price">Price charged (IDR)</Label>
                    <Input
                      id="product-price"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={base.priceIdr}
                      onChange={(event) =>
                        setVariant(base.key, { priceIdr: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="product-price-usd">
                      Price outside Indonesia (USD)
                    </Label>
                    <Input
                      id="product-price-usd"
                      type="number"
                      inputMode="decimal"
                      min={0.5}
                      step={0.01}
                      placeholder="Not sold outside Indonesia"
                      value={base.priceUsd}
                      aria-invalid={Boolean(usdProblem(base.priceUsd))}
                      onChange={(event) =>
                        setVariant(base.key, { priceUsd: event.target.value })
                      }
                    />
                    <p className={`text-xs ${hintClassName}`}>
                      {base.paddlePriceId
                        ? `On Paddle as ${base.paddlePriceId}. `
                        : ''}
                      {USD_HINT}
                    </p>
                  </div>
                  {isSubscription ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="product-duration">
                        Days per checkout
                      </Label>
                      <Input
                        id="product-duration"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={base.durationDays}
                        onChange={(event) =>
                          setVariant(base.key, {
                            durationDays: event.target.value,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {many ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="product-pricing-text">Pricing text</Label>
                  <Input
                    id="product-pricing-text"
                    value={base.pricingText}
                    maxLength={120}
                    placeholder="Rp 99.000 / month"
                    onChange={(event) =>
                      setVariant(base.key, { pricingText: event.target.value })
                    }
                  />
                  <p className={`text-xs ${hintClassName}`}>
                    Shown on the product card in the shop.
                  </p>
                </div>
              )}

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
            </TabsContent>

            {isSubscription ? (
              <TabsContent
                value="variants"
                forceMount
                className={tabPanelClassName}
              >
                <ProductVariantsField
                  value={draft.variants}
                  onChange={setVariants}
                  problems={problems}
                  deploys={deploys}
                  onOpen={open}
                />
              </TabsContent>
            ) : null}

            <TabsContent
              value="delivery"
              forceMount
              className={tabPanelClassName}
            >
              {!isSubscription ? (
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
                <section
                  id="product-deployment"
                  className="scroll-mt-20 space-y-6"
                >
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

                  {deploys ? (
                    <ProblemList
                      problems={problemsIn('delivery')}
                      onOpen={(problem) =>
                        setSelectedKey(problem.variantKey ?? '')
                      }
                    />
                  ) : null}

                  {deploys && !many ? (
                    <DeploymentFields
                      value={base.settings}
                      onChange={(settings) =>
                        setVariant(base.key, { settings })
                      }
                    />
                  ) : null}

                  {deploys && many ? (
                    <>
                      <div className="space-y-3">
                        <p className={`text-xs ${hintClassName}`}>
                          Shared by every variant, so a customer who switches
                          keeps the same service.
                        </p>
                        <DeploymentFields
                          section="shared"
                          value={base.settings}
                          onChange={(settings) =>
                            setVariant(base.key, { settings })
                          }
                        />
                      </div>

                      <div className="space-y-4 border-t border-[var(--line)] pt-6">
                        <div className="space-y-2">
                          <h3 className={sectionTitleClassName}>
                            Settings per variant
                          </h3>
                          <VariantPicker
                            variants={variants}
                            selected={selected.key}
                            onSelect={setSelectedKey}
                            problems={problemsIn('delivery')}
                            describe={(variant) =>
                              isBase(variant) || variant.ownDeployment
                                ? 'Own settings'
                                : 'Same as base'
                            }
                          />
                        </div>

                        {isBase(selected) ? (
                          <p className={`text-xs ${hintClassName}`}>
                            The base variant&apos;s settings. Other variants can
                            reuse them or have their own.
                          </p>
                        ) : (
                          <fieldset className="space-y-2">
                            <legend className="sr-only">
                              {variantLabel(selected, selectedIndex)}:
                              deployment settings
                            </legend>
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name={`variant-${selected.key}-deployment`}
                                  checked={!selected.ownDeployment}
                                  onChange={() =>
                                    setVariant(selected.key, {
                                      ownDeployment: false,
                                    })
                                  }
                                />
                                Same as {variantLabel(base, 0)}
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name={`variant-${selected.key}-deployment`}
                                  checked={selected.ownDeployment}
                                  onChange={() =>
                                    setVariant(selected.key, {
                                      ownDeployment: true,
                                      // Start from the base's, which
                                      // usually differs only in limits.
                                      settings: base.settings,
                                    })
                                  }
                                />
                                Its own settings
                              </label>
                            </div>
                            <p className={`text-xs ${hintClassName}`}>
                              {selected.ownDeployment
                                ? "Its own compose file, environment, domains and commands. It must mount the same volumes as the base variant's, so customers who switch keep their data."
                                : `Deploys exactly what ${variantLabel(base, 0)} deploys, at ${priceLine(selected)}.`}
                            </p>
                          </fieldset>
                        )}

                        {isBase(selected) || selected.ownDeployment ? (
                          <DeploymentFields
                            key={selected.key}
                            section="service"
                            value={settingsToCheck(selected, base)}
                            onChange={(settings) =>
                              setVariant(selected.key, { settings })
                            }
                          />
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </section>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-5">
            {errorCount > 0 ? (
              <button
                type="button"
                className="mr-auto flex items-center gap-1.5 text-sm text-[var(--destructive)] underline-offset-2 hover:underline"
                onClick={() => {
                  const first = problems.find(
                    (problem) => problem.severity === 'error',
                  )
                  if (first) open(first.tab, first.variantKey)
                }}
              >
                <CircleX className="size-4" aria-hidden />
                {errorCount} {errorCount === 1 ? 'thing' : 'things'} to fix
              </button>
            ) : null}
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
