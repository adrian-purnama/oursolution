import { m } from '#/paraglide/messages'
import { formatMoney } from '#/lib/billing'
import type { Currency } from '#/lib/billing'
import { getLocale } from '#/paraglide/runtime'
/**
 * - subscription: active for a period (hosting); shown on the plan Gantt chart.
 * - oneTime: bought once and kept for good (e.g. an n8n workflow).
 */
export type ProductKind = 'subscription' | 'oneTime'

/** Getters, so the text follows the current language each time it is read. */
export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  get subscription() {
    return m.product_kind_subscription()
  },
  get oneTime() {
    return m.product_kind_onetime()
  },
}

export type ProductSummary = {
  id: string
  name: string
  kind: ProductKind
  color: string
  /**
   * The cover image, relative to the API, e.g. /media/:id; pass through
   * toAbsoluteMediaUrl.
   */
  imageUrl: string | null
}

/** One product image; `url` is relative to the API like `imageUrl`. */
export type ProductImage = {
  id: string
  url: string
}

/** How a subscription's service is deployed. Only Docker Compose for now. */
/**
 * - editable: the customer sees and can change it; the value is a default.
 * - readOnly: the customer sees it, only an admin sets it.
 * - hidden: the customer never sees it.
 * - setOnce: the customer must fill it before turning the service on and
 *   cannot change it afterwards; they keep seeing it. The value is only an
 *   example shown in the empty field.
 * - setOnceHidden: like setOnce, but hidden from the customer once filled,
 *   e.g. a first admin password.
 */
export type VariableVisibility =
  'editable' | 'readOnly' | 'hidden' | 'setOnce' | 'setOnceHidden'

export const VARIABLE_VISIBILITY_LABELS: Record<VariableVisibility, string> = {
  get editable() {
    return m.var_vis_editable()
  },
  get readOnly() {
    return m.var_vis_readonly()
  },
  get hidden() {
    return m.var_vis_hidden()
  },
  get setOnce() {
    return m.var_vis_setonce()
  },
  get setOnceHidden() {
    return m.var_vis_setonce_hidden()
  },
}

export type DeploymentVariable = {
  key: string
  /** May use built-ins such as ${USERNAME}. */
  value: string
  visibility: VariableVisibility
}

export type DeploymentDomain = {
  serviceName: string
  /** One part, per customer, e.g. n8n-${USERNAME}; the domain is added. */
  subdomain: string
  port: number
}

/** How a subscription's service is deployed. Only Docker Compose for now. */
/** A command customers can run in their service; they see only the label. */
export type DeploymentCommand = {
  /** Empty for a new one; the server gives it an id on save. */
  id: string
  label: string
  /** The compose service whose container it runs in. */
  serviceName: string
  /** Run with `sh -c` inside that container. */
  command: string
}

export type ProductDeployment = {
  type: 'dockerCompose'
  /** The Dokploy project every deployment of this product goes into. */
  projectId: string
  /** Per customer, e.g. n8n-${USERNAME}. */
  name: string
  composeFile: string
  variables: DeploymentVariable[]
  domains: DeploymentDomain[]
  commands: DeploymentCommand[]
}

export type DokployProject = {
  id: string
  name: string
  description: string
}

/** An error blocks saving; a warning is advice. */
export type ComposeIssue = {
  severity: 'error' | 'warning'
  file: 'compose' | 'env' | 'settings'
  /** 1-based; null when it is about the file as a whole. */
  line: number | null
  message: string
  /** Settings only: "name", "variables.<index>" or "domains.<index>". */
  field?: string
}

/** The server's verdict on deployment settings, with the file re-spaced. */
export type DeploymentCheck = {
  valid: boolean
  issues: ComposeIssue[]
  composeFile: string
  /** Service names; empty when the file does not parse that far. */
  services: string[]
  /** The name and each domain's host for a sample customer, when valid. */
  preview: {
    username: string
    /** DEPLOY_DOMAIN, which every host ends with. */
    domain: string
    name: string | null
    hosts: (string | null)[]
  }
}

/** The id of a subscription's base variant: the product's own price and compose. */
export const BASE_VARIANT_ID = 'default'

/**
 * A variant's own deployment settings. The Dokploy project and the name in
 * Dokploy are always the product's.
 */
export type VariantDeployment = {
  composeFile: string
  variables: DeploymentVariable[]
  domains: DeploymentDomain[]
  commands: DeploymentCommand[]
}

/**
 * Another way to buy the same subscription, e.g. more CPU and memory. It
 * has its own price and days and may have its own deployment settings; it
 * shares the product's data, so customers can switch.
 */
export type ProductVariant = {
  /** Empty for a new one; the server gives it an id on save. */
  id: string
  name: string
  specs: string
  /** Shown as its price once chosen; empty shows the price. */
  pricingText: string
  /** Markdown; empty shows the product's description. */
  description: string
  priceIdr: number
  /** Outside Indonesia, in US cents; null when not sold there. */
  priceUsdCents: number | null
  /** Read-only: the Paddle price for it, once synced. */
  paddlePriceId: string | null
  durationDays: number
  /** null deploys the product's settings. */
  deployment: VariantDeployment | null
  /** Legacy: a compose file used with the product's other settings. */
  composeFile: string | null
}

/** A variant as customers see it; the base one comes first. */
export type PricingVariant = {
  id: string
  name: string
  specs: string
  /** Shown as its price once chosen; empty shows the price. */
  pricingText: string
  /** Markdown: its own, else the product's. */
  description: string
  /** In the product's `currency`: whole rupiah, or US cents. */
  price: number
  durationDays: number | null
}

/** Whether a change of variant redeploys the service by itself. */
export type VariantApplyMode = 'auto' | 'manual'

/** When a subscription bought at checkout starts. */
export type CheckoutPlacement = 'after' | 'now'

/** A rule or disclaimer; text is Markdown. Warnings are drawn in amber. */
export type ProductNotice = {
  tone: 'info' | 'warning'
  text: string
}

export type Product = ProductSummary & {
  /** In display order; the first is the cover. */
  images: ProductImage[]
  pricingText: string
  description: string
  notices: ProductNotice[]
  priceIdr: number
  /** Outside Indonesia, in US cents; null when not sold there. */
  priceUsdCents: number | null
  /** Read-only: the Paddle price and product, once synced. */
  paddlePriceId: string | null
  paddleProductId: string | null
  /** Subscription only. */
  durationDays: number | null
  /** Subscription only. */
  deployment: ProductDeployment | null
  /** Subscription only: the base variant's name; "" uses the product's. */
  variantName: string
  variantSpecs: string
  /** Subscription only: variants besides the base one. */
  variants: ProductVariant[]
  /** One-time only: where buyers get what they bought. */
  accessUrl: string | null
  showOnPricingPage: boolean
  /** Set when soft deleted: hidden from pricing and assignment, owners keep it. */
  deletedAt: string | null
}

export type PricingProduct = ProductSummary & {
  /** In display order; the first is the cover. */
  images: ProductImage[]
  pricingText: string
  description: string
  notices: ProductNotice[]
  durationDays: number | null
  /** The visitor's currency; the API sends only their region's prices. */
  currency: Currency
  /** The lowest price they can pay; null when not sold in their region. */
  price: number | null
  /** Subscription only: every variant, the base one first. */
  variants: PricingVariant[]
}

/**
 * What a shop card or product page shows as the price: the admin's text
 * (Indonesia), else the price itself, "from" the cheapest variant.
 */
export function shopPriceText(product: PricingProduct): string {
  if (product.pricingText) return product.pricingText
  if (product.price === null) return m.pricing_contact_us()
  const price = formatMoney(product.price, product.currency)
  const differ = new Set(product.variants.map((variant) => variant.price))
  return differ.size > 1 ? m.pricing_from({ price }) : price
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
  /** The variant it pays for; BASE_VARIANT_ID is the product's own. */
  variantId: string
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

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function formatDays(days: number): string {
  return days === 1 ? m.days_one() : m.days_other({ count: days })
}
