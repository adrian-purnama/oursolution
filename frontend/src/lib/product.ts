/**
 * - subscription: active for a period (hosting); shown on the plan Gantt chart.
 * - oneTime: bought once and kept for good (e.g. an n8n workflow).
 */
export type ProductKind = 'subscription' | 'oneTime'

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  subscription: 'Subscription',
  oneTime: 'One-time purchase',
}

export type ProductSummary = {
  id: string
  name: string
  kind: ProductKind
  color: string
  /** Relative to the API, e.g. /media/:id; pass through toAbsoluteMediaUrl. */
  imageUrl: string | null
}

export type Product = ProductSummary & {
  pricingText: string
  priceIdr: number
  /** Subscription only. */
  durationDays: number | null
  /** One-time only: where buyers get what they bought. */
  accessUrl: string | null
  showOnPricingPage: boolean
  /** Set when soft deleted: hidden from pricing and assignment, owners keep it. */
  deletedAt: string | null
}

export type PricingProduct = ProductSummary & {
  pricingText: string
  durationDays: number | null
}

/** A one-time product a user owns. */
export type Purchase = {
  purchaseId: string
  product: ProductSummary
  accessUrl: string | null
  purchasedAt: string
  source: string
}

/** One stored stretch of time during which a subscription is active for a user. */
export type ProductPeriod = {
  periodId: string
  startsAt: string
  /** null means no end. */
  endsAt: string | null
  isCurrent: boolean
  source: string
}

/** One subscription's row in a user's plan: its periods, oldest first. */
export type UserProductRow = {
  product: ProductSummary
  active: boolean
  periods: ProductPeriod[]
}

/** A user's plan: every subscription they have, had recently, or will have. */
export type UserPlan = {
  /** Server time the plan was read at. */
  now: string
  rows: UserProductRow[]
}

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatIdr(amount: number): string {
  return idrFormatter.format(amount)
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

export function formatDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}
