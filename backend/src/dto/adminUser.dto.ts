import type { UserRole } from "../models/user/user.interface";

export interface AdminUserOutDto {
  id: string;
  email: string;
  isBlocked: boolean;
  role: UserRole;
}

export interface CreateAdminUserDto {
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateAdminUserDto {
  password?: string;
  isBlocked?: boolean;
  role?: UserRole;
}

export interface AdminUserDetailOutDto extends AdminUserOutDto {
  accountCreatedAt: string;
}
