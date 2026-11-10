import type { Request, Response } from "express";
import type {
  AdminUserDetailOutDto,
  AdminUserOutDto,
} from "../../dto/adminUser.dto";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import {
  parseEmailSearchQuery,
  parseUpdateAdminUserDto,
} from "../../validation/adminUser";
import { parseRouteId } from "../../validation/parseParam";
import { AdminService } from "./admin.service";

type AppConfigPayload = {
  appName: string;
  openLogin: boolean;
  openRegister: boolean;
  appLogo: string | null;
};

export class AdminController {
  constructor(private readonly adminService = new AdminService()) {}

  getAppConfig = async (_req: Request, res: Response) => {
    try {
      const data = this.adminService.getAppConfig();

      return res.status(200).json({
        success: true,
        message: "App config retrieved",
        data,
      } satisfies ApiResponseDto<AppConfigPayload>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to get app config",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  updateAppConfig = async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: {
        appName?: string;
        openLogin?: boolean;
        openRegister?: boolean;
      } = {};

      if ("appName" in body) {
        if (typeof body.appName !== "string" || !body.appName.trim()) {
          return res.status(400).json({
            success: false,
            message: "appName must be a non-empty string",
            data: null,
          } satisfies ApiResponseDto);
        }
        patch.appName = body.appName.trim();
      }

      if ("openLogin" in body) {
        if (typeof body.openLogin !== "boolean") {
          return res.status(400).json({
            success: false,
            message: "openLogin must be a boolean",
            data: null,
          } satisfies ApiResponseDto);
        }
        patch.openLogin = body.openLogin;
      }

      if ("openRegister" in body) {
        if (typeof body.openRegister !== "boolean") {
          return res.status(400).json({
            success: false,
            message: "openRegister must be a boolean",
            data: null,
          } satisfies ApiResponseDto);
        }
        patch.openRegister = body.openRegister;
      }

      if (
        patch.appName === undefined &&
        patch.openLogin === undefined &&
        patch.openRegister === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
          data: null,
        } satisfies ApiResponseDto);
      }

      const data = await this.adminService.updateAppConfig(patch);

      return res.status(200).json({
        success: true,
        message: "App config updated",
        data,
      } satisfies ApiResponseDto<AppConfigPayload>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update app config",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  updateAppLogo = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "file required",
          data: null,
        } satisfies ApiResponseDto);
      }

      const result = await this.adminService.updateAppLogo({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      return res.status(200).json({
        success: true,
        message: "App logo updated",
        data: {
          id: result.id.toString(),
          url: result.url,
        },
      } satisfies ApiResponseDto<{ id: string; url: string }>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update app logo",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  getUser = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const data = await this.adminService.getUserDetail(id);
      return res.status(200).json({
        success: true,
        message: "User retrieved",
        data,
      } satisfies ApiResponseDto<AdminUserDetailOutDto>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to get user",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  searchUsers = async (req: Request, res: Response) => {
    try {
      const query = parseEmailSearchQuery(req.query.email);
      const data = await this.adminService.searchUsersByEmail(query);
      return res.status(200).json({
        success: true,
        message: "Users retrieved",
        data,
      } satisfies ApiResponseDto<AdminUserOutDto[]>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to search users",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  updateUser = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const patch = parseUpdateAdminUserDto(req.body);
      const data = await this.adminService.updateUser(id, patch);
      return res.status(200).json({
        success: true,
        message: "User updated",
        data,
      } satisfies ApiResponseDto<AdminUserOutDto>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update user",
        data: null,
      } satisfies ApiResponseDto);
    }
  };
}
