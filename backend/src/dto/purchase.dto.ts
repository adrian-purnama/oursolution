import type { ProductSummaryDto } from "./product.dto";

/** A one-time product a user owns. */
export interface PurchaseOutDto {
  purchaseId: string;
  product: ProductSummaryDto;
  /** Where the owner gets what they bought, if the product has a link. */
  accessUrl: string | null;
  purchasedAt: string;
  source: string;
}

export interface GrantPurchaseInDto {
  productId: string;
}
