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

/** How a subscription's service is deployed. Only Docker Compose for now. */
/**
 * - editable: the customer sees and can change it; the value is a default.
 * - readOnly: the customer sees it, only an admin sets it.
 * - hidden: the customer never sees it.
 */
export type VariableVisibility = 'editable' | 'readOnly' | 'hidden'

export const VARIABLE_VISIBILITY_LABELS: Record<VariableVisibility, string> = {
  editable: 'Can see and edit',
  readOnly: 'Can see',
  hidden: 'Hidden',
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
export type ProductDeployment = {
  type: 'dockerCompose'
  /** The Dokploy project every deployment of this product goes into. */
  projectId: string
  /** Per customer, e.g. n8n-${USERNAME}. */
  name: string
  composeFile: string
  variables: DeploymentVariable[]
  domains: DeploymentDomain[]
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

/** A rule or disclaimer; text is Markdown. Warnings are drawn in amber. */
export type ProductNotice = {
  tone: 'info' | 'warning'
  text: string
}

export type Product = ProductSummary & {
  pricingText: string
  description: string
  notices: ProductNotice[]
  priceIdr: number
  /** Subscription only. */
  durationDays: number | null
  /** Subscription only. */
  deployment: ProductDeployment | null
  /** One-time only: where buyers get what they bought. */
  accessUrl: string | null
  showOnPricingPage: boolean
  /** Set when soft deleted: hidden from pricing and assignment, owners keep it. */
  deletedAt: string | null
}

export type PricingProduct = ProductSummary & {
  pricingText: string
  description: string
  notices: ProductNotice[]
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
