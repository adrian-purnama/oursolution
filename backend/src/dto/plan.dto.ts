export interface PlanOutDto {
  id: string;
  name: string;
  color: string;
  pricingText: string;
  priceIdr: number;
  showOnPricingPage: boolean;
  isDefault: boolean;
}

/** What the public pricing page gets: no internal price. */
export interface PricingPlanOutDto {
  id: string;
  name: string;
  color: string;
  pricingText: string;
}

/** The small form used wherever a plan is only being labelled. */
export interface PlanSummaryDto {
  id: string;
  name: string;
  color: string;
}

export interface CreatePlanDto {
  name: string;
  color: string;
  pricingText: string;
  priceIdr: number;
  showOnPricingPage: boolean;
  isDefault: boolean;
}

export type UpdatePlanDto = Partial<CreatePlanDto>;
