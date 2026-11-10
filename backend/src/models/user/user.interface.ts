export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserInterface {
  email: string;
  hashedPassword: string;
  isBlocked: boolean;
  /** "admin" opens the admin area; what a user can use comes from their active products. */
  role: UserRole;
  /** Bumped to invalidate every token issued before the change. */
  tokenVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
