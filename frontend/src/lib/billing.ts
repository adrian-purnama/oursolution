import { useSyncExternalStore } from 'react'
import { getToken } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { ApiResponse } from '#/lib/api'
import { API_BASE_URL } from '#/lib/config'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import type {
  CheckoutPlacement,
  ProductKind,
  ProductSummary,
  VariantApplyMode,
} from '#/lib/product'

export type CheckoutItem = {
  productId: string
  quantity: number
  /** Subscription only: null or missing is the base variant. */
  variantId?: string | null
  applyVariant?: VariantApplyMode
  placement?: CheckoutPlacement
}

/** A variant a checkout line could buy, priced now. */
export type CheckoutVariantOption = {
  id: string
  name: string
  specs: string
  unitPriceIdr: number
  durationDays: number | null
}

/** What switching now does, as quoted; worked out again when paid. */
export type CheckoutSwitch = {
  creditIdr: number
  bonusDays: number
  endsAt: string
}

/** One product in the basket or checkout, priced now. */
export type CheckoutLine = {
  product: ProductSummary
  unitPriceIdr: number
  quantity: number
  /** 1 for a one-time product. */
  maxQuantity: number
  durationDays: number | null
  amountIdr: number
  /** Subscription only: the variant it buys. */
  variant: { id: string; name: string } | null
  /** Subscription only: every variant it could buy, the base first. */
  variants: CheckoutVariantOption[]
  applyVariant: VariantApplyMode | null
  placement: CheckoutPlacement | null
  /** Switching now: what it does. */
  switch: CheckoutSwitch | null
  /** Why it cannot be bought now, or null. */
  problem: string | null
}

/**
 * What a customer is billed in: "ID" is Indonesia (rupiah, Midtrans), "INTL"
 * everyone else (US dollars, Paddle, renewing by itself).
 */
export type BillingRegion = 'ID' | 'INTL'
/** Amounts are whole rupiah for IDR and cents for USD. */
export type Currency = 'IDR' | 'USD'

export type CheckoutQuote = {
  lines: CheckoutLine[]
  /** In `currency`, like every amount of the quote. */
  totalIdr: number
  canCheckout: boolean
  currency: Currency
  region: BillingRegion
  /** Fixed after the first checkout: only an admin changes it. */
  regionLocked: boolean
}

/** A quote with nothing in it, keeping the region of `from`. */
export function emptyQuote(from: CheckoutQuote): CheckoutQuote {
  return { ...from, lines: [], totalIdr: 0, canCheckout: false }
}

export type BillingRegionInfo = {
  region: BillingRegion
  locked: boolean
  /** False while Paddle is not set up: everyone is billed in Indonesia. */
  international: boolean
}

/** A subscription Paddle renews for the user. */
export type RenewingSubscription = {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled'
  products: { productId: string; name: string }[]
  nextBilledAt: string | null
  cancelsAt: string | null
}

export type PaymentStatus =
  'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  get pending() {
    return m.pay_status_pending()
  },
  get paid() {
    return m.pay_status_paid()
  },
  get failed() {
    return m.pay_status_failed()
  },
  get expired() {
    return m.pay_status_expired()
  },
  get cancelled() {
    return m.pay_status_cancelled()
  },
  get refunded() {
    return m.pay_status_refunded()
  },
}

export type CheckoutResult = {
  paymentId: string
  invoiceNumber: string
  status: PaymentStatus
  provider: string
  redirectUrl: string | null
  /** Snap token, to pay inside the page. */
  snapToken: string | null
  /** Paddle: the transaction Paddle.js opens. */
  paddleTransactionId: string | null
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
  variantId: string | null
  amountIdr: number
}

export type Payment = {
  id: string
  invoiceNumber: string
  status: PaymentStatus
  /** At checkout by the user, by an admin for them, or a Paddle renewal. */
  source: 'checkout' | 'admin' | 'renewal'
  /** Every amount on it: whole rupiah for IDR, cents for USD. */
  currency: Currency
  amountIdr: number
  items: PaymentItem[]
  provider: string
  paymentType: string | null
  /** Where to pay; only while unpaid and not expired. */
  redirectUrl: string | null
  /** Snap token for the inline payment form; same rule as redirectUrl. */
  snapToken: string | null
  /** Paddle transaction for Paddle.js; same rule as redirectUrl. */
  paddleTransactionId: string | null
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
  {
    key: 'all',
    get label() {
      return m.pay_group_all()
    },
  },
  {
    key: 'paid',
    get label() {
      return m.pay_group_paid()
    },
  },
  {
    key: 'pending',
    get label() {
      return m.pay_group_pending()
    },
  },
  {
    key: 'closed',
    get label() {
      return m.pay_group_closed()
    },
  },
  {
    key: 'refunded',
    get label() {
      return m.pay_group_refunded()
    },
  },
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

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** "Rp 50.000" for rupiah, "$9.00" for US cents. */
export function formatMoney(value: number, currency: Currency = 'IDR'): string {
  return currency === 'USD' ? usd.format(value / 100) : formatIdr(value)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(getLocale(), {
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
    ? m.pay_period_multi({ quantity, days: durationDays, total })
    : m.pay_period_single({ days: durationDays })
}

/** Save an invoice PDF; the API needs the bearer token, so a plain link won't do. */
export async function downloadInvoice(path: string, filename: string) {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!response.ok) {
    let message: string = m.pay_invoice_download_failed()
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

/** Add a product; another variant of one already there replaces it. */
export async function addToBasket(
  productId: string,
  quantity = 1,
  variantId: string | null = null,
): Promise<ApiResponse<CheckoutQuote>> {
  const res = await apiFetch<CheckoutQuote>('/me/basket/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, variantId }),
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
  paddle: {
    clientToken: string
    environment: 'sandbox' | 'production'
  } | null
}

let configLoading: Promise<PaymentConfig | null> | null = null

/** The public payment settings, fetched once. */
function paymentConfig(): Promise<PaymentConfig | null> {
  configLoading ??= apiFetch<PaymentConfig>('/payments/config')
    .then((res) => (res.success ? (res.data ?? null) : null))
    .catch(() => {
      configLoading = null
      return null
    })
  return configLoading
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`${src} failed to load`))
    document.head.appendChild(script)
  })
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
      const config = (await paymentConfig())?.snap
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

/* ---- Paddle Checkout, for customers outside Indonesia ---- */

/** What Paddle.js tells the page about an open checkout. */
export type PaddleEvent = { name?: string }

type PaddleJs = {
  Environment: { set: (environment: string) => void }
  Initialize: (options: {
    token: string
    eventCallback: (event: PaddleEvent) => void
  }) => void
  Checkout: {
    open: (options: {
      transactionId: string
      settings?: {
        displayMode?: 'overlay' | 'inline'
        variant?: 'one-page' | 'multi-page'
        theme?: 'light'
        locale?: string
        /** Inline: the class of the element Paddle fills. */
        frameTarget?: string
        frameInitialHeight?: number
        frameStyle?: string
      }
    }) => void
    close: () => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

/** Paddle.js reports to one callback: pages listen through this set. */
const paddleListeners = new Set<(event: PaddleEvent) => void>()
let paddleLoading: Promise<PaddleJs | null> | null = null

/**
 * Load and set up Paddle.js once. Null when the server has no Paddle set
 * up or the script cannot load.
 */
export function loadPaddle(): Promise<PaddleJs | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  paddleLoading ??= (async () => {
    try {
      const config = (await paymentConfig())?.paddle
      if (!config) return null
      if (!window.Paddle) {
        await loadScript('https://cdn.paddle.com/paddle/v2/paddle.js')
      }
      const paddle = window.Paddle
      if (!paddle) return null
      if (config.environment === 'sandbox') paddle.Environment.set('sandbox')
      paddle.Initialize({
        token: config.clientToken,
        eventCallback: (event) => {
          for (const listener of paddleListeners) listener(event)
        },
      })
      return paddle
    } catch {
      paddleLoading = null
      return null
    }
  })()
  return paddleLoading
}

/**
 * Show Paddle's checkout for a transaction inside the page, in the element
 * with class `frameTarget`, on one page. `onEvent` hears what happens
 * ("checkout.loaded", "checkout.completed", ...) until `stop` is called,
 * which also removes the checkout. `opened` is false when Paddle.js is not
 * available, or `signal` was aborted while it loaded (nothing is shown).
 */
export async function openPaddleCheckout(
  transactionId: string,
  frameTarget: string,
  onEvent: (event: PaddleEvent) => void,
  signal?: AbortSignal,
): Promise<{ opened: boolean; stop: () => void }> {
  const paddle = await loadPaddle()
  if (!paddle || signal?.aborted) {
    return { opened: false, stop: () => undefined }
  }
  paddleListeners.add(onEvent)
  paddle.Checkout.open({
    transactionId,
    settings: {
      displayMode: 'inline',
      variant: 'one-page',
      theme: 'light',
      locale: getLocale(),
      frameTarget,
      frameInitialHeight: 450,
      frameStyle:
        'width: 100%; min-width: 312px; background-color: transparent; border: none;',
    },
  })
  return {
    opened: true,
    stop: () => {
      paddleListeners.delete(onEvent)
      try {
        paddle.Checkout.close()
      } catch {
        // Already gone with the page.
      }
    },
  }
}

/** A one-time link to Paddle's page for cancelling renewal or the card. */
export async function openBillingPortal(): Promise<string | null> {
  const res = await apiFetch<{ url: string }>('/me/billing-portal', {
    method: 'POST',
  })
  if (!res.success || !res.data) throw new Error(res.message)
  return res.data.url
}

/** Stop a subscription renewing after the period already paid for. */
export async function cancelRenewal(id: string): Promise<void> {
  const res = await apiFetch(`/me/subscriptions/${id}/cancel`, {
    method: 'POST',
  })
  if (!res.success) throw new Error(res.message)
}

/** Take back a cancellation that has not taken effect yet. */
export async function resumeRenewal(id: string): Promise<void> {
  const res = await apiFetch(`/me/subscriptions/${id}/resume`, {
    method: 'POST',
  })
  if (!res.success) throw new Error(res.message)
}

/** The Paddle transaction to open in checkout to change the card. */
export async function cardTransactionId(id: string): Promise<string> {
  const res = await apiFetch<{ transactionId: string }>(
    `/me/subscriptions/${id}/card`,
    { method: 'POST' },
  )
  if (!res.success || !res.data) throw new Error(res.message)
  return res.data.transactionId
}

/** A variant a renewing subscription can move to. */
export type UpgradeChoice = {
  variantId: string
  name: string
  priceCents: number
}

/** What moving to a variant costs now. */
export type UpgradePreview = {
  variantId: string
  name: string
  currency: string
  amountCents: number
  credit: boolean
  nextBilledAt: string | null
  renewalCents: number
}

export async function upgradeChoices(id: string): Promise<UpgradeChoice[]> {
  const res = await apiFetch<UpgradeChoice[]>(`/me/subscriptions/${id}/upgrade`)
  if (!res.success || !res.data) throw new Error(res.message)
  return res.data
}

export async function previewUpgrade(
  id: string,
  variantId: string,
): Promise<UpgradePreview> {
  const res = await apiFetch<UpgradePreview>(
    `/me/subscriptions/${id}/upgrade/preview`,
    { method: 'POST', body: JSON.stringify({ variantId }) },
  )
  if (!res.success || !res.data) throw new Error(res.message)
  return res.data
}

export async function applyUpgrade(
  id: string,
  variantId: string,
): Promise<void> {
  const res = await apiFetch(`/me/subscriptions/${id}/upgrade`, {
    method: 'POST',
    body: JSON.stringify({ variantId }),
  })
  if (!res.success) throw new Error(res.message)
}
