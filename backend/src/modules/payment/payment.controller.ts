import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { CheckoutOutDto } from "../../dto/payment.dto";
import { parseCheckoutInDto } from "../../validation/product";
import { AlreadyOwnedError } from "../purchase/purchase.service";
import { PlanScheduleError } from "../userProduct/userProduct.planner";
import { paymentService } from "./payment.service";

export class PaymentController {
  checkout = async (req: Request, res: Response) => {
    try {
      const { productId } = parseCheckoutInDto(req.body);
      const data = await paymentService.checkout(req.user!.id, productId);
      return res.status(200).json({
        success: true,
        message:
          data.status === "paid" ? "Product activated" : "Payment started",
        data,
      } satisfies ApiResponseDto<CheckoutOutDto>);
    } catch (error) {
      const conflict =
        error instanceof PlanScheduleError ||
        error instanceof AlreadyOwnedError;
      return res.status(conflict ? 409 : 400).json({
        success: false,
        message: error instanceof Error ? error.message : "Checkout failed",
        data: null,
      } satisfies ApiResponseDto);
    }
  };
}
