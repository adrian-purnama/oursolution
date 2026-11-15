import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type {
  CloseTicketOutDto,
  TicketErrorDataDto,
  TicketOutDto,
  TicketPageOutDto,
} from "../../dto/ticket.dto";
import { logger } from "../../logger/logger";
import { TicketImageError } from "../../utils/ticketImage";
import { parseParam } from "../../validation/parseParam";
import {
  parseCloseTicketInDto,
  parseCreateTicketInDto,
  parsePage,
  parseTicketListQuery,
  parseTicketMessageInDto,
  parseTicketStatus,
} from "../../validation/ticket";
import { TicketError, ticketService } from "./ticket.service";

const SOURCE = "modules/ticket/ticket.controller.ts";

function ok<T>(res: Response, status: number, message: string, data: T) {
  return res.status(status).json({
    success: true,
    message,
    data,
  } satisfies ApiResponseDto<T>);
}

/** Known refusals keep their message; anything else stays generic. */
function fail(res: Response, error: unknown, fallback: string, method: string) {
  if (error instanceof TicketError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: { code: error.code },
    } satisfies ApiResponseDto<TicketErrorDataDto>);
  }
  if (error instanceof TicketImageError) {
    return res.status(400).json({
      success: false,
      message: error.message,
      data: { code: "INVALID_IMAGE" },
    } satisfies ApiResponseDto<TicketErrorDataDto>);
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
      data: { code: "INVALID_INPUT" },
    } satisfies ApiResponseDto<TicketErrorDataDto>);
  }
  logger.error(
    error instanceof Error ? error.message : String(error),
    SOURCE,
    method,
  );
  return res.status(500).json({
    success: false,
    message: fallback,
    data: null,
  } satisfies ApiResponseDto);
}

/** Input problems, told apart from server faults. */
class ValidationError extends Error {}

function validate<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "Invalid input",
    );
  }
}

function ticketIdOf(req: Request): string {
  return validate(() =>
    parseParam(req.params.id, { label: "ticket id", objectId: true }),
  );
}

/** Support tickets: the signed-in customer's own, and (admin) everyone's. */
export class TicketController {
  // ---------------------------------------------------------------- customer

  create = async (req: Request, res: Response) => {
    try {
      const input = validate(() => parseCreateTicketInDto(req.body));
      const data = await ticketService.create(
        req.user!.id as string,
        input,
        req.file?.buffer ?? null,
      );
      return ok<TicketOutDto>(res, 201, "Ticket created", data);
    } catch (error) {
      return fail(res, error, "Failed to create the ticket", "create");
    }
  };

  listOwn = async (req: Request, res: Response) => {
    try {
      const data = await ticketService.listOwn(
        req.user!.id as string,
        parsePage(req.query.page),
      );
      return ok<TicketPageOutDto>(res, 200, "Tickets retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load tickets", "listOwn");
    }
  };

  unreadCount = async (req: Request, res: Response) => {
    try {
      const count = await ticketService.unreadCount(req.user!.id as string);
      return ok<{ count: number }>(res, 200, "Unread tickets counted", {
        count,
      });
    } catch (error) {
      return fail(res, error, "Failed to count tickets", "unreadCount");
    }
  };

  getOwn = async (req: Request, res: Response) => {
    try {
      const data = await ticketService.getOwn(
        req.user!.id as string,
        ticketIdOf(req),
      );
      return ok<TicketOutDto>(res, 200, "Ticket retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load the ticket", "getOwn");
    }
  };

  addUserMessage = async (req: Request, res: Response) => {
    try {
      const ticketId = ticketIdOf(req);
      const { body } = validate(() => parseTicketMessageInDto(req.body));
      const data = await ticketService.addUserMessage(
        req.user!.id as string,
        ticketId,
        body,
        req.file?.buffer ?? null,
      );
      return ok<TicketOutDto>(res, 201, "Message sent", data);
    } catch (error) {
      return fail(res, error, "Failed to send the message", "addUserMessage");
    }
  };

  // ---------------------------------------------------------------- photos

  /** No login: the signed link is the permission, and it expires. */
  attachment = async (req: Request, res: Response) => {
    try {
      const messageId = parseParam(req.params.messageId, {
        label: "message id",
        objectId: true,
      });
      const found = await ticketService.openAttachment(
        messageId,
        req.query.exp,
        req.query.sig,
      );
      if (found.status !== "ok") {
        const denied = found.status === "denied";
        return res.status(denied ? 403 : 404).json({
          success: false,
          message: denied ? "Access denied" : "File not found",
          data: null,
        } satisfies ApiResponseDto);
      }
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", `private, max-age=${found.secondsLeft}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      found.stream
        .on("error", () => {
          if (!res.headersSent) res.status(404);
          res.end();
        })
        .pipe(res);
      return undefined;
    } catch {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  // ---------------------------------------------------------------- admin

  listAll = async (req: Request, res: Response) => {
    try {
      const query = validate(() =>
        parseTicketListQuery(req.query as Record<string, unknown>),
      );
      const data = await ticketService.listAll(query);
      return ok<TicketPageOutDto>(res, 200, "Tickets retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load tickets", "listAll");
    }
  };

  getAny = async (req: Request, res: Response) => {
    try {
      const data = await ticketService.getAny(ticketIdOf(req));
      return ok<TicketOutDto>(res, 200, "Ticket retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to load the ticket", "getAny");
    }
  };

  addAdminMessage = async (req: Request, res: Response) => {
    try {
      const ticketId = ticketIdOf(req);
      const { body } = validate(() => parseTicketMessageInDto(req.body));
      const data = await ticketService.addAdminMessage(
        req.user!.id as string,
        ticketId,
        body,
        req.file?.buffer ?? null,
      );
      return ok<TicketOutDto>(res, 201, "Reply sent", data);
    } catch (error) {
      return fail(res, error, "Failed to send the reply", "addAdminMessage");
    }
  };

  close = async (req: Request, res: Response) => {
    try {
      const ticketId = ticketIdOf(req);
      const input = validate(() => parseCloseTicketInDto(req.body));
      const data = await ticketService.close(
        req.user!.id as string,
        ticketId,
        input,
      );
      return ok<CloseTicketOutDto>(
        res,
        200,
        data.summarized ? "Ticket closed and summarized" : "Ticket closed",
        data,
      );
    } catch (error) {
      return fail(res, error, "Failed to close the ticket", "close");
    }
  };

  setStatus = async (req: Request, res: Response) => {
    try {
      const ticketId = ticketIdOf(req);
      const status = validate(() =>
        parseTicketStatus((req.body as { status?: unknown } | undefined)?.status),
      );
      const data = await ticketService.setStatus(
        req.user!.id as string,
        ticketId,
        status,
      );
      return ok<TicketOutDto>(res, 200, "Status updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update the status", "setStatus");
    }
  };
}
