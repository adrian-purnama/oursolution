import type { Request, Response } from "express";
import type {
  AdminUserDetailOutDto,
  AdminUserOutDto,
} from "../../dto/adminUser.dto";
import {
  parseCreateAdminUserDto,
  parseEmailSearchQuery,
  parseUpdateAdminUserDto,
} from "../../validation/adminUser";
import type { ContactDetails } from "../../models/appconfig/appconfig.interface";
import { parseContactDetails } from "../../validation/contact";
import { parseRouteId } from "../../validation/parseParam";
import { AdminService } from "./admin.service";
import { fail, ok, refuse } from "../../utils/respond";

type AppConfigPayload = {
  appName: string;
  openLogin: boolean;
  openRegister: boolean;
  appLogo: string | null;
  contact: ContactDetails;
};

export class AdminController {
  constructor(private readonly adminService = new AdminService()) {}

  getAppConfig = async (_req: Request, res: Response) => {
    try {
      const data = this.adminService.getAppConfig();

      return ok<AppConfigPayload>(res, "App config retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to get app config");
    }
  };

  updateAppConfig = async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: {
        contact?: ContactDetails;
        appName?: string;
        openLogin?: boolean;
        openRegister?: boolean;
      } = {};

      if ("appName" in body) {
        if (typeof body.appName !== "string" || !body.appName.trim()) {
          return refuse(res, 400, "appName must be a non-empty string");
        }
        patch.appName = body.appName.trim();
      }

      if ("openLogin" in body) {
        if (typeof body.openLogin !== "boolean") {
          return refuse(res, 400, "openLogin must be a boolean");
        }
        patch.openLogin = body.openLogin;
      }

      if ("openRegister" in body) {
        if (typeof body.openRegister !== "boolean") {
          return refuse(res, 400, "openRegister must be a boolean");
        }
        patch.openRegister = body.openRegister;
      }

      if ("contact" in body) {
        try {
          patch.contact = parseContactDetails(body.contact);
        } catch (error) {
          return fail(res, error, "Invalid contact details");
        }
      }

      if (
        patch.contact === undefined &&
        patch.appName === undefined &&
        patch.openLogin === undefined &&
        patch.openRegister === undefined
      ) {
        return refuse(res, 400, "No valid fields to update");
      }

      const data = await this.adminService.updateAppConfig(patch);

      return ok<AppConfigPayload>(res, "App config updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update app config");
    }
  };

  updateAppLogo = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return refuse(res, 400, "file required");
      }

      const result = await this.adminService.updateAppLogo({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });

      return ok<{ id: string; url: string }>(res, "App logo updated", {
        id: result.id.toString(),
        url: result.url,
      });
    } catch (error) {
      return fail(res, error, "Failed to update app logo");
    }
  };

  getUser = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const data = await this.adminService.getUserDetail(id);
      return ok<AdminUserDetailOutDto>(res, "User retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to get user");
    }
  };

  searchUsers = async (req: Request, res: Response) => {
    try {
      const query = parseEmailSearchQuery(req.query.email);
      const data = await this.adminService.searchUsersByEmail(query);
      return ok<AdminUserOutDto[]>(res, "Users retrieved", data);
    } catch (error) {
      return fail(res, error, "Failed to search users");
    }
  };

  createUser = async (req: Request, res: Response) => {
    try {
      const input = parseCreateAdminUserDto(req.body);
      const data = await this.adminService.createUser(input);
      return ok<AdminUserOutDto>(res, "User created", data, 201);
    } catch (error) {
      return fail(res, error, "Failed to create user");
    }
  };

  updateUser = async (req: Request, res: Response) => {
    try {
      const id = parseRouteId(req.params.id);
      const patch = parseUpdateAdminUserDto(req.body);
      const data = await this.adminService.updateUser(id, patch);
      return ok<AdminUserOutDto>(res, "User updated", data);
    } catch (error) {
      return fail(res, error, "Failed to update user");
    }
  };
}
