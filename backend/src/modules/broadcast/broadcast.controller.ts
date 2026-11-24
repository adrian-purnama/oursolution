import type { Request, Response } from "express";
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
import { fail, ok } from "../../utils/respond";

/** Admin: email many users at once and see what was sent. */
export class BroadcastController {
  list = async (req: Request, res: Response) => {
    try {
      const { page, pageSize } = parsePageQuery(req.query);
      const data = await broadcastService.list(page, pageSize);
      return ok<BroadcastListOutDto>(res, "Emails retrieved", data);
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
      return ok<BroadcastAudiencePreviewOutDto>(res, "Audience resolved", data);
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
      return ok<BroadcastOutDto>(
        res,
        `Sending to ${data.recipientCount} ${data.recipientCount === 1 ? "person" : "people"}`,
        data,
        201,
      );
    } catch (error) {
      return fail(res, error, "Failed to send the email");
    }
  };
}
