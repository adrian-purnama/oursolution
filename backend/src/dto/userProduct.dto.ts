import type { ProductSummaryDto } from "./product.dto";

/** One stored stretch of time during which a product is active for a user. */
export interface ProductPeriodOutDto {
  periodId: string;
  startsAt: string;
  /** null means no end. */
  endsAt: string | null;
  isCurrent: boolean;
  source: string;
}

/** One product's row in a user's plan: its periods, oldest first. */
export interface UserProductRowOutDto {
  product: ProductSummaryDto;
  /** True when a period covers now. */
  active: boolean;
  /** Recent finished periods, then the running one, then scheduled ones. */
  periods: ProductPeriodOutDto[];
}

/** A user's plan: every product they have, had recently, or will have. */
export interface UserPlanOutDto {
  /** Server time the plan was read at, so the client draws "now" consistently. */
  now: string;
  /** Active products first, then by name. */
  rows: UserProductRowOutDto[];
}

/** How long a newly assigned period lasts. */
export type PeriodEndSpec =
  | { kind: "none" }
  | { kind: "days"; days: number }
  | { kind: "date"; at: Date }
  | { kind: "currentEnd" };

export interface AssignProductDto {
  productId: string;
  end: PeriodEndSpec;
}
