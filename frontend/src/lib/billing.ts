import { useSyncExternalStore } from 'react'
import { getToken } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { ApiResponse } from '#/lib/api'
import { API_BASE_URL } from '#/lib/config'
import type { ProductKind, ProductSummary } from '#/lib/product'

export type CheckoutItem = { productId: string; quantity: number }

/** One product in the basket or checkout, priced now. */
export type CheckoutLine = {
  product: ProductSummary
  unitPriceIdr: number
  quantity: number
  /** 1 for a one-time product. */
  maxQuantity: number
  durationDays: number | null
  amountIdr: number
  /** Why it cannot be bought now, or null. */
  problem: string | null
}

export type CheckoutQuote = {
  lines: CheckoutLine[]
  totalIdr: number
  canCheckout: boolean
}

export type PaymentStatus =
  'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Unpaid',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export type CheckoutResult = {
  paymentId: string
  invoiceNumber: string
  status: PaymentStatus
  redirectUrl: string | null
  /** Snap token, to pay inside the page. */
  snapToken: string | null
}

/** A store product, or "custom": billed work an admin wrote. */
export type PaymentItemKind = ProductKind | 'custom'

export type PaymentItem = {
  /** Null for a custom line. */
  productId: string | null
  name: string
  description: string | null
  kind: PaymentItemKind
  unitPriceIdr: number
  quantity: number
  durationDays: number | null
  amountIdr: number
}

export type Payment = {
  id: string
  invoiceNumber: string
  status: PaymentStatus
  /** Made at checkout by the user, or by an admin for them. */
  source: 'checkout' | 'admin'
  amountIdr: number
  items: PaymentItem[]
  provider: string
  paymentType: string | null
  /** Where to pay; only while unpaid and not expired. */
  redirectUrl: string | null
  /** Snap token for the inline payment form; same rule as redirectUrl. */
  snapToken: string | null
  expiresAt: string
  paidAt: string | null
  grantedAt: string | null
  needsReview: boolean
  reviewNote: string | null
  failureReason: string | null
  createdAt: string
  user: { id: string; email: string } | null
}

export type PaymentList = {
  items: Payment[]
  page: number
  pageSize: number
  total: number
}

/** Admin status filter: each groups one or more payment statuses. */
export const PAYMENT_GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed', label: 'Closed' },
  { key: 'refunded', label: 'Refunded' },
] as const
export type PaymentGroup = (typeof PAYMENT_GROUPS)[number]['key']

export type AdminPaymentList = PaymentList & {
  counts: Record<PaymentGroup, number>
}

const idr = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** "Rp 50.000" */
export function formatIdr(value: number): string {
  return `Rp ${idr.format(value)}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "3 × 30 days" for a subscription line; empty for a one-time product. */
export function periodLabel(
  quantity: number,
  durationDays: number | null,
): string {
  if (durationDays === null) return ''
  const total = quantity * durationDays
  return quantity > 1
    ? `${quantity} periods × ${durationDays} days (${total} days)`
    : `${durationDays} days`
}

/** Save an invoice PDF; the API needs the bearer token, so a plain link won't do. */
export async function downloadInvoice(path: string, filename: string) {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    let message = 'Could not download the invoice'
    try {
      const body = (await response.json()) as ApiResponse<null>
      message = body.message || message
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new Error(message)
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/* ---- Basket count, shared by the header and the buy buttons ---- */

let basketCount = 0
const listeners = new Set<() => void>()

function setBasketCount(count: number) {
  basketCount = count
  for (const listener of listeners) listener()
}

/** Keep the header badge in step with a basket the page just loaded. */
export function syncBasket(quote: CheckoutQuote) {
  setBasketCount(quote.lines.length)
}

export function useBasketCount(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => basketCount,
    () => 0,
  )
}

export async function refreshBasket(): Promise<void> {
  if (!getToken()) {
    setBasketCount(0)
    return
  }
  try {
    const res = await apiFetch<CheckoutQuote>('/me/basket')
    if (res.success && res.data) syncBasket(res.data)
  } catch {
    // The badge is a hint; leave it as it was.
  }
}

export async function addToBasket(
  productId: string,
  quantity = 1,
): Promise<ApiResponse<CheckoutQuote>> {
  const res = await apiFetch<CheckoutQuote>('/me/basket/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  })
  if (res.success && res.data) syncBasket(res.data)
  return res
}

/* ---- Midtrans Snap, shown inside our page ---- */

type SnapCallbacks = {
  embedId: string
  onSuccess?: () => void
  onPending?: () => void
  onError?: () => void
  onClose?: () => void
}

export type Snap = {
  embed: (token: string, options: SnapCallbacks) => void
  hide: () => void
}

declare global {
  interface Window {
    snap?: Snap
  }
}

type PaymentConfig = {
  provider: string | null
  snap: { scriptUrl: string; clientKey: string } | null
}

let snapLoading: Promise<Snap | null> | null = null

/**
 * Load Midtrans' snap.js once. Null when the server has no Snap set up (for
 * example development without Midtrans keys) or the script cannot load.
 */
export function loadSnap(): Promise<Snap | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.snap) return Promise.resolve(window.snap)
  snapLoading ??= (async () => {
    try {
      const res = await apiFetch<PaymentConfig>('/payments/config')
      const config = res.success ? res.data?.snap : null
      if (!config) return null
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = config.scriptUrl
        script.dataset.clientKey = config.clientKey
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('snap.js failed to load'))
        document.head.appendChild(script)
      })
      return window.snap ?? null
    } catch {
      snapLoading = null
      return null
    }
  })()
  return snapLoading
}
