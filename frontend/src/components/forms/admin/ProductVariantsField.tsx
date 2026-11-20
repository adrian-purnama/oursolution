import { Plus, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { formatDays, formatIdr } from '#/lib/product'
import type { ProductVariant } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

/** The most variants a product may have besides its base one. */
export const MAX_VARIANTS = 10

/** A variant as typed; numbers stay text until saved. */
export type VariantDraft = {
  /** Empty for a new one. */
  id: string
  name: string
  specs: string
  priceIdr: string
  durationDays: string
  /** Off: it deploys the product's compose file. */
  ownCompose: boolean
  composeFile: string
}

export type VariantsDraft = {
  /** The base variant: the product's own price, days and compose file. */
  baseName: string
  baseSpecs: string
  variants: VariantDraft[]
}

export const EMPTY_VARIANTS: VariantsDraft = {
  baseName: '',
  baseSpecs: '',
  variants: [],
}

export function toVariantsDraft(product: {
  variantName: string
  variantSpecs: string
  variants: ProductVariant[]
}): VariantsDraft {
  return {
    baseName: product.variantName,
    baseSpecs: product.variantSpecs,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      specs: variant.specs,
      priceIdr: String(variant.priceIdr),
      durationDays: String(variant.durationDays),
      ownCompose: variant.composeFile !== null,
      composeFile: variant.composeFile ?? '',
    })),
  }
}

/** What the API takes, or a problem to show, naming the variant at fault. */
export function toVariantsBody(
  draft: VariantsDraft,
): { body: Record<string, unknown> } | { problem: string } {
  const variants: (Omit<ProductVariant, 'id'> & { id?: string })[] = []
  for (const [index, variant] of draft.variants.entries()) {
    const label = variant.name.trim() || `Variant ${index + 1}`
    const priceIdr = Number(variant.priceIdr)
    const durationDays = Number(variant.durationDays)
    if (!variant.name.trim()) {
      return { problem: `Variant ${index + 1} needs a name` }
    }
    if (!Number.isInteger(priceIdr) || priceIdr < 0) {
      return {
        problem: `${label}: the price must be a whole number of rupiah, 0 or more`,
      }
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      return {
        problem: `${label}: the duration must be a whole number of days, 1 or more`,
      }
    }
    if (variant.ownCompose && !variant.composeFile.trim()) {
      return { problem: `${label}: its compose file is empty` }
    }
    variants.push({
      ...(variant.id ? { id: variant.id } : {}),
      name: variant.name.trim(),
      specs: variant.specs.trim(),
      priceIdr,
      durationDays,
      composeFile: variant.ownCompose ? variant.composeFile : null,
    })
  }
  if (variants.length > 0 && !draft.baseName.trim()) {
    return {
      problem: 'Name the base variant, so customers can tell them apart',
    }
  }
  return {
    body: {
      variantName: draft.baseName.trim(),
      variantSpecs: draft.baseSpecs.trim(),
      variants,
    },
  }
}

const NEW_VARIANT: VariantDraft = {
  id: '',
  name: '',
  specs: '',
  priceIdr: '0',
  durationDays: '30',
  ownCompose: false,
  composeFile: '',
}

/**
 * The ways to buy one subscription, e.g. "2 cores / 2 GB" and "4 cores /
 * 4 GB". The base variant is the product's own price, days and compose
 * file; each other variant has its own price and days, and may have its own
 * compose file.
 */
export default function ProductVariantsField({
  value,
  onChange,
  basePriceIdr,
  baseDurationDays,
  deploys,
  baseComposeFile,
}: {
  value: VariantsDraft
  onChange: (value: VariantsDraft) => void
  basePriceIdr: string
  baseDurationDays: string
  /** Whether the product deploys a compose file at all. */
  deploys: boolean
  baseComposeFile: string
}) {
  function setVariant(index: number, patch: Partial<VariantDraft>) {
    onChange({
      ...value,
      variants: value.variants.map((variant, at) =>
        at === index ? { ...variant, ...patch } : variant,
      ),
    })
  }

  const basePrice = Number(basePriceIdr)
  const baseDays = Number(baseDurationDays)

  return (
    <div className="space-y-6">
      <p className={`text-xs ${hintClassName}`}>
        Variants are other ways to buy this subscription, such as more CPU and
        memory. Customers pick one and can switch later. They keep their data,
        so every variant must mount the same volumes as the product's compose
        file.
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Base variant</h3>
        <p className={`text-xs ${hintClassName}`}>
          {Number.isInteger(basePrice) && Number.isInteger(baseDays)
            ? `${formatIdr(basePrice)} per ${formatDays(baseDays)}, deploying the product's compose file. Change these on the Pricing and Deployment tabs.`
            : 'The price and days from the Pricing tab.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="variant-base-name">Name</Label>
            <Input
              id="variant-base-name"
              value={value.baseName}
              maxLength={60}
              placeholder="2 cores / 2 GB"
              onChange={(event) =>
                onChange({ ...value, baseName: event.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="variant-base-specs">Specs</Label>
            <Input
              id="variant-base-specs"
              value={value.baseSpecs}
              maxLength={300}
              placeholder="Good for up to 5 players"
              onChange={(event) =>
                onChange({ ...value, baseSpecs: event.target.value })
              }
            />
          </div>
        </div>
      </section>

      {value.variants.map((variant, index) => {
        const id = `variant-${index}`
        return (
          <section
            key={variant.id || `new-${index}`}
            className="space-y-4 border-t border-[var(--line)] pt-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">
                {variant.name.trim() || `Variant ${index + 1}`}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[var(--muted)]"
                onClick={() =>
                  onChange({
                    ...value,
                    variants: value.variants.filter((_, at) => at !== index),
                  })
                }
              >
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-name`}>Name</Label>
                <Input
                  id={`${id}-name`}
                  value={variant.name}
                  maxLength={60}
                  placeholder="4 cores / 4 GB"
                  onChange={(event) =>
                    setVariant(index, { name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-specs`}>Specs</Label>
                <Input
                  id={`${id}-specs`}
                  value={variant.specs}
                  maxLength={300}
                  onChange={(event) =>
                    setVariant(index, { specs: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-price`}>Price charged (IDR)</Label>
                <Input
                  id={`${id}-price`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={variant.priceIdr}
                  onChange={(event) =>
                    setVariant(index, { priceIdr: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-days`}>Days per checkout</Label>
                <Input
                  id={`${id}-days`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={variant.durationDays}
                  onChange={(event) =>
                    setVariant(index, { durationDays: event.target.value })
                  }
                />
              </div>
            </div>

            {deploys ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={variant.ownCompose}
                    onChange={(event) =>
                      setVariant(index, {
                        ownCompose: event.target.checked,
                        // Start from the product's, which usually differs
                        // only in limits.
                        composeFile:
                          event.target.checked && !variant.composeFile
                            ? baseComposeFile
                            : variant.composeFile,
                      })
                    }
                  />
                  Its own compose file
                </label>
                {variant.ownCompose ? (
                  <>
                    <Textarea
                      aria-label={`${variant.name || `Variant ${index + 1}`}: compose file`}
                      value={variant.composeFile}
                      rows={12}
                      spellCheck={false}
                      className="font-mono text-xs"
                      onChange={(event) =>
                        setVariant(index, { composeFile: event.target.value })
                      }
                    />
                    <p className={`text-xs ${hintClassName}`}>
                      Uses the product's variables, domains and commands.
                      Checked when you save.
                    </p>
                  </>
                ) : (
                  <p className={`text-xs ${hintClassName}`}>
                    Deploys the product's compose file.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.variants.length >= MAX_VARIANTS}
        onClick={() =>
          onChange({
            ...value,
            variants: [
              ...value.variants,
              { ...NEW_VARIANT, durationDays: baseDurationDays || '30' },
            ],
          })
        }
      >
        <Plus aria-hidden />
        Add variant
      </Button>
    </div>
  )
}
