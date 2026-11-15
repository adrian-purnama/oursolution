import { Types } from "mongoose";

export interface BasketItem {
  productId: Types.ObjectId;
  /** Always 1 for a one-time product; periods for a subscription. */
  quantity: number;
}

/** What a signed-in user means to buy. One per user. */
export interface BasketInterface {
  userId: Types.ObjectId;
  items: BasketItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
