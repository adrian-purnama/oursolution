import type {
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from "../dto/adminUser.dto";
import { normalizeEmail } from "../utils/email";
import { USER_ROLES, type UserRole } from "../models/user/user.interface";
import { passwordProblem } from "./password";

export function parseEmailSearchQuery(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

export function parseCreateAdminUserDto(body: unknown): CreateAdminUserDto {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const raw = body as Record<string, unknown>;

  const email = normalizeEmail(raw.email);
  if (!email) throw new Error("Invalid email");

  const problem = passwordProblem(raw.password);
  if (problem) throw new Error(problem);

  const role = raw.role ?? "user";
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new Error("role must be one of: " + USER_ROLES.join(", "));
  }

  return { email, password: raw.password as string, role: role as UserRole };
}

export function parseUpdateAdminUserDto(body: unknown): UpdateAdminUserDto {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }

  const raw = body as Record<string, unknown>;
  const patch: UpdateAdminUserDto = {};

  if ("password" in raw) {
    const problem = passwordProblem(raw.password);
    if (problem) {
      throw new Error(problem);
    }
    patch.password = raw.password as string;
  }

  if ("isBlocked" in raw) {
    if (typeof raw.isBlocked !== "boolean") {
      throw new Error("isBlocked must be a boolean");
    }
    patch.isBlocked = raw.isBlocked;
  }

  if ("role" in raw) {
    if (!USER_ROLES.includes(raw.role as UserRole)) {
      throw new Error("role must be one of: " + USER_ROLES.join(", "));
    }
    patch.role = raw.role as UserRole;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields to update");
  }

  return patch;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
