import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { BASE_VARIANT_ID, formatDays, formatIdr } from '#/lib/product'
import type { Product } from '#/lib/product'

/** A product's variants, the base one first, as admins pick them. */
export function variantOptionsOf(product: Product) {
  return [
    {
      id: BASE_VARIANT_ID,
      name: product.variantName.trim() || product.name,
      priceIdr: product.priceIdr,
      durationDays: product.durationDays,
    },
    ...product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceIdr: variant.priceIdr,
      durationDays: variant.durationDays,
    })),
  ]
}

/**
 * Which variant of a subscription to give. Shows nothing for a product
 * without variants, where the base is the only one.
 */
export default function VariantSelect({
  id,
  product,
  value,
  onChange,
}: {
  id: string
  product: Product | null
  value: string
  /** With the variant's days, so the form can default to them. */
  onChange: (variantId: string, durationDays: number | null) => void
}) {
  if (!product || product.kind !== 'subscription') return null
  if (product.variants.length === 0) return null
  const options = variantOptionsOf(product)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Variant</Label>
      <Select
        value={value}
        onValueChange={(next) =>
          onChange(
            next,
            options.find((option) => option.id === next)?.durationDays ?? null,
          )
        }
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
              <span className="text-[var(--muted)]">
                {' · '}
                {formatIdr(option.priceIdr)}
                {option.durationDays
                  ? ` / ${formatDays(option.durationDays)}`
                  : ''}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
