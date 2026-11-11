import { userProductService } from "../userProduct/userProduct.service";

/** What a user is allowed to do with a product right now. */
export class EntitlementService {
  /**
   * A subscription's service may be deployed, turned on, restarted or
   * redeployed only while the subscription runs. Turning off is always
   * allowed.
   */
  async canRunService(
    userId: string,
    productId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    return userProductService.hasActiveProduct(userId, productId, now);
  }
}

export const entitlementService = new EntitlementService();
