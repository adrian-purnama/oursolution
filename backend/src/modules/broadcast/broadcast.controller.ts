import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type {
  BroadcastAudiencePreviewOutDto,
  BroadcastListOutDto,
  BroadcastOutDto,
} from "../../dto/broadcast.dto";
import {
  parseBroadcastAudience,
  parseSendBroadcastInDto,
} from "../../validation/broadcast";
import { parsePageQuery } from "../../validation/payment";
import { broadcastService } from "./broadcast.service";

function fail(res: Response, error: unknown, fallback: string) {
  return res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** Admin: email many users at once and see what was sent. */
export class BroadcastController {
  list = async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePageQuery(req.query);
      const data = await broadcastService.list(page, pageSize);
      return res.status(200).json({
        success: true,
        message: "Emails retrieved",
        data,
      } satisfies ApiResponseDto<BroadcastListOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to load emails");
    }
  };

  preview = async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const data = await broadcastService.preview(
        parseBroadcastAudience(body.audience),
      );
      return res.status(200).json({
        success: true,
        message: "Audience resolved",
        data,
      } satisfies ApiResponseDto<BroadcastAudiencePreviewOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to resolve the audience");
    }
  };

  send = async (req: Request, res: Response) => {
    try {
      const data = await broadcastService.send(
        parseSendBroadcastInDto(req.body),
        req.user!.id,
      );
      return res.status(201).json({
        success: true,
        message: `Sending to ${data.recipientCount} ${data.recipientCount === 1 ? "person" : "people"}`,
        data,
      } satisfies ApiResponseDto<BroadcastOutDto>);
    } catch (error) {
      return fail(res, error, "Failed to send the email");
    }
  };
}
