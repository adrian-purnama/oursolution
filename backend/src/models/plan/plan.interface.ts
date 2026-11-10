export interface PlanInterface {
  name: string;
  /** Hex color, e.g. "#1a5c4a". */
  color: string;
  /** Free text shown on the pricing page, e.g. "Rp 99.000 / month". */
  pricingText: string;
  /** Amount actually charged, in whole rupiah. */
  priceIdr: number;
  showOnPricingPage: boolean;
  /** Exactly one plan is the default: what a user is on when nothing else applies. */
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
