export type PlanSummary = {
  id: string
  name: string
  color: string
}

export type Plan = PlanSummary & {
  pricingText: string
  priceIdr: number
  showOnPricingPage: boolean
  isDefault: boolean
}

export type PricingPlan = PlanSummary & {
  pricingText: string
}

/** One stretch of a user's plan timeline. */
export type PlanSegment = {
  /** null for a default-plan stretch that is not stored. */
  periodId: string | null
  plan: PlanSummary
  startsAt: string
  /** null means no end. */
  endsAt: string | null
  isCurrent: boolean
  /** True when the default plan is filling a gap. */
  isFallback: boolean
  source: string | null
}

export type UserPlanOverview = {
  current: PlanSegment
  timeline: PlanSegment[]
  history: PlanSegment[]
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
