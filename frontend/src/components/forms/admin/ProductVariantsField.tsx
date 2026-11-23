import { Copy, Plus, Trash2 } from 'lucide-react'
import {
  EMPTY_DEPLOYMENT,
  toDeploymentDraft,
} from '#/components/forms/admin/DeploymentFields'
import type { DeploymentDraft } from '#/components/forms/admin/DeploymentFields'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { BASE_VARIANT_ID, formatDays, formatIdr } from '#/lib/product'
import type { Product, ProductVariant } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

/** The most variants a product may have besides its base one. */
export const MAX_VARIANTS = 10

/**
 * One way to buy the subscription, as typed. The first in the list is the
 * base variant: the product's own price, days and deployment. Numbers stay
 * text until saved.
 */
export type VariantDraft = {
  /** Local and stable, for React keys and picking one; never sent. */
  key: string
  /** BASE_VARIANT_ID for the base, empty for a new one. */
  id: string
  name: string
  specs: string
  /**
   * Shown as its price once chosen. The base's is the product's own, also
   * on the shop card; another's may be empty to show its price.
   */
  pricingText: string
  /**
   * Markdown. The base's is the product's own; another's may be empty to
   * show the base's.
   */
  description: string
  priceIdr: string
  /** US dollars as typed, e.g. "9" or "9.50"; empty: not sold outside Indonesia. */
  priceUsd: string
  /** Read-only: the Paddle price it is synced to. */
  paddlePriceId: string | null
  durationDays: string
  /** Off: deploys the base variant's settings. Always on for the base. */
  ownDeployment: boolean
  /** Its own settings; the project and name are always the base's. */
  settings: DeploymentDraft
}

let nextKey = 0
export function newVariantKey(): string {
  nextKey += 1
  return `v${nextKey}`
}

export function isBase(variant: VariantDraft): boolean {
  return variant.id === BASE_VARIANT_ID
}

/** What a variant is called in the editor, named or not. */
export function variantLabel(variant: VariantDraft, index: number): string {
  return (
    variant.name.trim() ||
    (index === 0 ? 'Base variant' : `Variant ${index + 1}`)
  )
}

export function emptyVariants(): VariantDraft[] {
  return [
    {
      key: newVariantKey(),
      id: BASE_VARIANT_ID,
      name: '',
      specs: '',
      pricingText: '',
      description: '',
      priceIdr: '0',
      priceUsd: '',
      paddlePriceId: null,
      durationDays: '30',
      ownDeployment: true,
      settings: EMPTY_DEPLOYMENT,
    },
  ]
}

function ownSettingsOf(
  variant: ProductVariant,
  base: DeploymentDraft,
): DeploymentDraft | null {
  if (variant.deployment) {
    return {
      ...toDeploymentDraft({
        type: 'dockerCompose',
        projectId: base.projectId,
        name: base.name,
        ...variant.deployment,
      }),
    }
  }
  // Saved before variants had settings of their own: only a compose file.
  if (variant.composeFile) return { ...base, composeFile: variant.composeFile }
  return null
}

export function toVariantDrafts(product: Product): VariantDraft[] {
  const base = toDeploymentDraft(product.deployment)
  return [
    {
      key: newVariantKey(),
      id: BASE_VARIANT_ID,
      name: product.variantName,
      specs: product.variantSpecs,
      pricingText: product.pricingText,
      description: product.description,
      priceIdr: String(product.priceIdr),
      priceUsd: usdText(product.priceUsdCents),
      paddlePriceId: product.paddlePriceId,
      durationDays: String(product.durationDays ?? 30),
      ownDeployment: true,
      settings: base,
    },
    ...product.variants.map((variant) => {
      const own = ownSettingsOf(variant, base)
      return {
        key: newVariantKey(),
        id: variant.id,
        name: variant.name,
        specs: variant.specs,
        pricingText: variant.pricingText,
        description: variant.description,
        priceIdr: String(variant.priceIdr),
        priceUsd: usdText(variant.priceUsdCents),
        paddlePriceId: variant.paddlePriceId,
        durationDays: String(variant.durationDays),
        ownDeployment: own !== null,
        settings: own ?? base,
      }
    }),
  ]
}

/** A variant's settings with the base's project and name, as checked. */
export function settingsToCheck(
  variant: VariantDraft,
  base: VariantDraft,
): DeploymentDraft {
  return {
    ...variant.settings,
    projectId: base.settings.projectId,
    name: base.settings.name,
  }
}

/** The product fields the variants make up. Run `findProblems` first. */
export function toVariantsBody(variants: VariantDraft[], deploys: boolean) {
  const [base, ...others] = variants
  return {
    pricingText: base.pricingText.trim(),
    description: base.description.trim(),
    priceIdr: Number(base.priceIdr),
    priceUsdCents: usdCents(base.priceUsd),
    durationDays: Number(base.durationDays),
    variantName: others.length > 0 ? base.name.trim() : '',
    variantSpecs: others.length > 0 ? base.specs.trim() : '',
    variants: others.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      name: variant.name.trim(),
      specs: variant.specs.trim(),
      pricingText: variant.pricingText.trim(),
      description: variant.description.trim(),
      priceIdr: Number(variant.priceIdr),
      priceUsdCents: usdCents(variant.priceUsd),
      durationDays: Number(variant.durationDays),
      deployment:
        deploys && variant.ownDeployment
          ? {
              composeFile: variant.settings.composeFile,
              variables: variant.settings.variables,
              domains: variant.settings.domains,
              commands: variant.settings.commands,
            }
          : null,
      composeFile: null,
    })),
  }
}

/** Where a problem shows: which editor tab, and which variant in it. */
export type EditorTab = 'general' | 'pricing' | 'variants' | 'delivery'

export type Problem = {
  tab: EditorTab
  /** The variant it is about, by its local key. */
  variantKey?: string
  /** Errors block saving; warnings are advice. */
  severity: 'error' | 'warning'
  message: string
}

function isWholeNumber(text: string, min: number): boolean {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) && value >= min
}

/** Cents shown as dollars for the editor: 900 is "9.00"; null is empty. */
export function usdText(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2)
}

/** What the admin typed, in cents; empty is null (not sold outside Indonesia). */
export function usdCents(text: string): number | null {
  return text.trim() === '' ? null : Math.round(Number(text) * 100)
}

/** Why a typed USD price is refused, or null when it is fine or empty. */
export function usdProblem(text: string): string | null {
  if (text.trim() === '') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0.5) {
    return 'the USD price must be at least 0.50, or empty to sell only in Indonesia'
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    return 'the USD price can have at most 2 decimals'
  }
  return null
}

/**
 * What is missing or odd in the variants, as the admin types. The server
 * checks the compose files themselves.
 */
export function variantProblems(
  variants: VariantDraft[],
  deploys: boolean,
): Problem[] {
  const problems: Problem[] = []
  const many = variants.length > 1
  const [base] = variants
  const seen = new Map<string, number>()

  variants.forEach((variant, index) => {
    const label = many ? `${variantLabel(variant, index)}: ` : ''
    const variantKey = variant.key

    if (many) {
      const name = variant.name.trim().toLowerCase()
      if (!name) {
        problems.push({
          tab: 'variants',
          variantKey,
          severity: 'error',
          message:
            index === 0
              ? 'The base variant needs a name, so customers can tell the variants apart'
              : `Variant ${index + 1} needs a name`,
        })
      } else if (seen.has(name)) {
        problems.push({
          tab: 'variants',
          variantKey,
          severity: 'error',
          message: `${variantLabel(variant, index)} has the same name as another variant`,
        })
      } else {
        seen.set(name, index)
      }
      if (!variant.specs.trim()) {
        problems.push({
          tab: 'variants',
          variantKey,
          severity: 'warning',
          message: `${label}no specs yet. Customers compare variants by them`,
        })
      }
    }

    const usd = usdProblem(variant.priceUsd)
    if (usd) {
      problems.push({
        tab: 'pricing',
        variantKey,
        severity: 'error',
        message: `${label}${usd}`,
      })
    }
    if (!isWholeNumber(variant.priceIdr, 0)) {
      problems.push({
        tab: 'pricing',
        variantKey,
        severity: 'error',
        message: `${label}the price must be a whole number of rupiah, 0 or more`,
      })
    } else if (Number(variant.priceIdr) === 0) {
      problems.push({
        tab: 'pricing',
        variantKey,
        severity: 'warning',
        message: `${label}the price is Rp 0, so it is free`,
      })
    }
    if (!isWholeNumber(variant.durationDays, 1)) {
      problems.push({
        tab: 'pricing',
        variantKey,
        severity: 'error',
        message: `${label}days per checkout must be a whole number, 1 or more`,
      })
    }

    if (!deploys) return
    if (index === 0 || variant.ownDeployment) {
      if (!variant.settings.composeFile.trim()) {
        problems.push({
          tab: 'delivery',
          variantKey,
          severity: 'error',
          message: `${label}the compose file is empty`,
        })
      }
    }
    if (index > 0 && variant.ownDeployment) {
      const keys = new Set(variant.settings.variables.map(({ key }) => key))
      const missing = base.settings.variables
        .map(({ key }) => key)
        .filter((key) => key && !keys.has(key))
      if (missing.length > 0) {
        problems.push({
          tab: 'delivery',
          variantKey,
          severity: 'warning',
          message: `${label}${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} set on the base variant but not here`,
        })
      }
    }
  })

  // With one variant there is no "Name: " in front, so start in capitals.
  for (const problem of problems) {
    problem.message =
      problem.message.charAt(0).toUpperCase() + problem.message.slice(1)
  }

  if (deploys && !base.settings.projectId) {
    problems.push({
      tab: 'delivery',
      severity: 'error',
      message: 'Choose the Dokploy project to deploy into',
    })
  }
  return problems
}

/** A dot that says a tab or variant has something to look at. */
export function ProblemDot({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null
  const error = problems.some((problem) => problem.severity === 'error')
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${error ? 'bg-[var(--destructive)]' : 'bg-amber-500'}`}
      aria-label={error ? 'Has problems' : 'Has warnings'}
    />
  )
}

/** Picks the variant a tab shows. Hidden while there is only one. */
export function VariantPicker({
  variants,
  selected,
  onSelect,
  problems,
  describe,
}: {
  variants: VariantDraft[]
  selected: string
  onSelect: (key: string) => void
  /** This tab's problems, to mark the variants that have some. */
  problems: Problem[]
  /** A short line under each name, e.g. its price. */
  describe?: (variant: VariantDraft) => string
}) {
  if (variants.length < 2) return null
  return (
    <div
      role="tablist"
      aria-label="Variant"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {variants.map((variant, index) => {
        const active = variant.key === selected
        return (
          <button
            key={variant.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(variant.key)}
            className={`flex min-w-0 shrink-0 flex-col items-start rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${
              active
                ? 'border-[var(--ink)] bg-white'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--muted)]'
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              {variantLabel(variant, index)}
              <ProblemDot
                problems={problems.filter(
                  (problem) => problem.variantKey === variant.key,
                )}
              />
            </span>
            {describe ? (
              <span className={`text-xs ${hintClassName}`}>
                {describe(variant)}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** "Rp 99.000 / 30 days", or a hint when the numbers are not ready. */
export function priceLine(variant: VariantDraft): string {
  const price = Number(variant.priceIdr)
  const days = Number(variant.durationDays)
  if (
    !isWholeNumber(variant.priceIdr, 0) ||
    !isWholeNumber(variant.durationDays, 1)
  ) {
    return 'Price not set'
  }
  return `${formatIdr(price)} / ${formatDays(days)}`
}

/**
 * The Variants tab: which ways to buy there are, what each is called and
 * what it gives. Price and deployment are on their own tabs, per variant.
 */
export default function ProductVariantsField({
  value,
  onChange,
  problems,
  deploys,
  onOpen,
}: {
  value: VariantDraft[]
  onChange: (value: VariantDraft[]) => void
  problems: Problem[]
  deploys: boolean
  /** Shows a variant on another tab. */
  onOpen: (tab: EditorTab, variantKey: string) => void
}) {
  const many = value.length > 1

  function set(key: string, patch: Partial<VariantDraft>) {
    onChange(
      value.map((variant) =>
        variant.key === key ? { ...variant, ...patch } : variant,
      ),
    )
  }

  function add(from?: VariantDraft) {
    const source = from ?? value[value.length - 1]
    onChange([
      ...value,
      {
        key: newVariantKey(),
        id: '',
        name: from ? `${from.name.trim()} copy`.trim() : '',
        specs: from?.specs ?? '',
        // The base's texts are the product's; a copy of it starts on them.
        pricingText: from && !isBase(from) ? from.pricingText : '',
        description: from && !isBase(from) ? from.description : '',
        priceIdr: source.priceIdr,
        priceUsd: source.priceUsd,
        // A new variant gets its own Paddle price when saved.
        paddlePriceId: null,
        durationDays: source.durationDays,
        // A copy keeps its own settings; a new one starts on the base's.
        ownDeployment: from ? from.ownDeployment : false,
        settings: from ? from.settings : value[0].settings,
      },
    ])
  }

  return (
    <div className="space-y-5">
      <p className={`text-xs ${hintClassName}`}>
        Variants are other ways to buy this subscription, such as more CPU and
        memory. Customers pick one and can switch later, keeping their data.
        Each variant gets its own price on the Pricing tab
        {deploys ? ' and its own settings on the Deployment tab' : ''}.
      </p>

      {!many ? (
        <div className="rounded-md border border-dashed border-[var(--line)] px-4 py-5 text-sm">
          <p className="font-medium">One variant</p>
          <p className={`mt-1 ${hintClassName}`}>
            Customers buy this product as it is. Add a variant to let them
            choose, e.g. “2 cores / 2 GB” and “4 cores / 4 GB”.
          </p>
        </div>
      ) : null}

      {many
        ? value.map((variant, index) => {
            const id = `variant-${variant.key}`
            const own = problems.filter(
              (problem) => problem.variantKey === variant.key,
            )
            const mine = own.filter((problem) => problem.tab === 'variants')
            const elsewhere = own.filter(
              (problem) => problem.tab !== 'variants',
            )
            return (
              <section
                key={variant.key}
                className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      {variantLabel(variant, index)}
                      {index === 0 ? (
                        <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--muted)]">
                          Base
                        </span>
                      ) : null}
                    </h3>
                    <p className={`mt-0.5 text-xs ${hintClassName}`}>
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => onOpen('pricing', variant.key)}
                      >
                        {priceLine(variant)}
                      </button>
                      {deploys ? (
                        <>
                          {' · '}
                          <button
                            type="button"
                            className="underline-offset-2 hover:underline"
                            onClick={() => onOpen('delivery', variant.key)}
                          >
                            {index === 0 || variant.ownDeployment
                              ? 'Own deployment'
                              : 'Same deployment as the base'}
                          </button>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Duplicate ${variantLabel(variant, index)}`}
                      disabled={value.length > MAX_VARIANTS}
                      onClick={() => add(variant)}
                    >
                      <Copy aria-hidden />
                    </Button>
                    {index > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${variantLabel(variant, index)}`}
                        onClick={() =>
                          onChange(
                            value.filter(({ key }) => key !== variant.key),
                          )
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-name`}>Name</Label>
                    <Input
                      id={`${id}-name`}
                      value={variant.name}
                      maxLength={60}
                      aria-invalid={mine.some(
                        (problem) =>
                          problem.severity === 'error' &&
                          problem.message.includes('name'),
                      )}
                      placeholder={
                        index === 0 ? '2 cores / 2 GB' : '4 cores / 4 GB'
                      }
                      onChange={(event) =>
                        set(variant.key, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-specs`}>Specs</Label>
                    <Input
                      id={`${id}-specs`}
                      value={variant.specs}
                      maxLength={300}
                      placeholder="Good for up to 5 players"
                      onChange={(event) =>
                        set(variant.key, { specs: event.target.value })
                      }
                    />
                  </div>
                </div>

                {elsewhere.length > 0 ? (
                  <ul className="space-y-1 text-xs">
                    {elsewhere.map((problem, at) => (
                      <li key={at}>
                        <button
                          type="button"
                          className={`text-left underline-offset-2 hover:underline ${problem.severity === 'error' ? 'text-[var(--destructive)]' : 'text-amber-700'}`}
                          onClick={() => onOpen(problem.tab, variant.key)}
                        >
                          {problem.tab === 'pricing' ? 'Pricing' : 'Deployment'}
                          : {problem.message.replace(/^[^:]+: /, '')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })
        : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length > MAX_VARIANTS}
        onClick={() => add()}
      >
        <Plus aria-hidden />
        {many ? 'Add variant' : 'Add a second variant'}
      </Button>
    </div>
  )
}
