import { formatDateTime, formatDays } from '#/lib/product'
import type { ProductSummary } from '#/lib/product'

export type RedeemActivation = 'onRedeem' | 'date'
export type RedeemCodeStatus = 'available' | 'redeemed' | 'expired'
export type RedeemCodeGroup = 'all' | RedeemCodeStatus

export const REDEEM_CODE_GROUPS: { key: RedeemCodeGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Not redeemed' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'expired', label: 'Expired' },
]

export type RedeemCodeUser = { id: string; email: string }

export type RedeemCode = {
  id: string
  code: string
  /** null when the product was erased. */
  product: ProductSummary | null
  /** Subscriptions: the variant given; null is the base one. */
  variant: { id: string; name: string } | null
  activation: RedeemActivation
  activatesAt: string | null
  durationDays: number | null
  endsAt: string | null
  validUntil: string | null
  status: RedeemCodeStatus
  createdAt: string
  createdBy: RedeemCodeUser | null
  redeemedAt: string | null
  redeemedBy: RedeemCodeUser | null
}

export type RedeemCodeList = {
  items: RedeemCode[]
  page: number
  pageSize: number
  total: number
  counts: Record<RedeemCodeGroup, number>
}

export type RedeemResult = {
  product: ProductSummary
  startsAt: string
  endsAt: string | null
}

/** "On redeem" or the set start date. */
export function redeemStartText(code: RedeemCode): string {
  return code.activation === 'date' && code.activatesAt
    ? `From ${formatDateTime(code.activatesAt)}`
    : 'From redeem'
}

/** How long the product lasts once given. */
export function redeemLengthText(code: RedeemCode): string {
  if (code.product?.kind === 'oneTime') return 'Owned for good'
  if (code.durationDays !== null) return formatDays(code.durationDays)
  if (code.endsAt) return `Until ${formatDateTime(code.endsAt)}`
  return 'No end'
}

/** `XXXX-XXXX-XXXX` as the user types: upper case, dashes added. */
export function formatRedeemInput(value: string): string {
  const plain = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
  return plain.match(/.{1,4}/g)?.join('-') ?? ''
}

/** A `datetime-local` value as an ISO string, or null when empty. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}
