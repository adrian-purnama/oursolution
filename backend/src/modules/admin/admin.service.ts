import * as bcrypt from "bcrypt";
import { Types } from "mongoose";
import type {
  AdminUserDetailOutDto,
  AdminUserOutDto,
  UpdateAdminUserDto,
} from "../../dto/adminUser.dto";
import type { UserRole } from "../../models/user/user.interface";
import { UserModel } from "../../models/user/user.model";
import { normalizeImage } from "../../utils/image";
import { escapeRegex } from "../../validation/adminUser";
import {
  appConfigService,
  type ChangeAppLogoInput,
} from "../appConfig/appConfig.service";

export type UpdateAppConfigInput = {
  appName?: string;
  openLogin?: boolean;
  openRegister?: boolean;
};

function toAdminUser(doc: {
  id: string;
  email: string;
  isBlocked: boolean;
  role: UserRole;
}): AdminUserOutDto {
  return {
    id: doc.id,
    email: doc.email,
    isBlocked: Boolean(doc.isBlocked),
    role: doc.role,
  };
}

export class AdminService {
  getAppConfig() {
    return appConfigService.getAppConfig();
  }

  async updateAppConfig(input: UpdateAppConfigInput) {
    if (input.appName !== undefined) {
      await appConfigService.changeAppName(input.appName);
    }
    if (input.openLogin !== undefined) {
      await appConfigService.changeOpenLogin(input.openLogin);
    }
    if (input.openRegister !== undefined) {
      await appConfigService.changeOpenRegister(input.openRegister);
    }
    return appConfigService.getAppConfig();
  }

  async updateAppLogo(input: ChangeAppLogoInput) {
    // Re-encoding strips anything that is not pixel data (scripts in SVG,
    // polyglot files) and ignores the client-supplied content type.
    const image = await normalizeImage(input.buffer);
    return appConfigService.changeAppLogo({
      buffer: image.buffer,
      filename: "app-logo.png",
      contentType: image.contentType,
    });
  }

  async searchUsersByEmail(query: string): Promise<AdminUserOutDto[]> {
    const trimmed = query.trim();
    const filter = trimmed
      ? { email: { $regex: escapeRegex(trimmed), $options: "i" } }
      : {};

    const users = await UserModel.find(filter)
      .sort({ email: 1 })
      .limit(50)
      .exec();

    return users.map((user) => toAdminUser(user));
  }

  async updateUser(
    id: string,
    patch: UpdateAdminUserDto,
  ): Promise<AdminUserOutDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    // Never leave the app without an admin who can sign in.
    const isActiveAdmin = user.role === "admin" && !user.isBlocked;
    const losesAdmin =
      patch.isBlocked === true ||
      (patch.role !== undefined && patch.role !== "admin");
    if (isActiveAdmin && losesAdmin) {
      const activeAdmins = await UserModel.countDocuments({
        role: "admin",
        isBlocked: false,
      }).exec();
      if (activeAdmins <= 1) {
        throw new Error("Cannot block or demote the last admin");
      }
    }

    // A new password or a block signs the user out everywhere.
    const revokesSessions =
      patch.password !== undefined ||
      (patch.isBlocked === true && !user.isBlocked);

    if (patch.password !== undefined) {
      user.hashedPassword = await bcrypt.hash(patch.password, 10);
    }
    if (patch.isBlocked !== undefined) {
      user.isBlocked = patch.isBlocked;
    }
    if (patch.role !== undefined) {
      user.role = patch.role;
    }
    if (revokesSessions) {
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    await user.save();
    return toAdminUser(user);
  }

  async getUserDetail(id: string): Promise<AdminUserDetailOutDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user id");
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    const createdAt =
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : user._id.getTimestamp().toISOString();

    return {
      ...toAdminUser(user),
      accountCreatedAt: createdAt,
    };
  }
}
