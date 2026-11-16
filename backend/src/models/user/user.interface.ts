export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserInterface {
  email: string;
  /** Missing for an account made with Google that never set a password. */
  hashedPassword?: string;
  /** The linked Google account's id ("sub"). Signs this user in with Google. */
  googleId?: string | null;
  isBlocked: boolean;
  /** "admin" opens the admin area; what a user can use comes from their active products. */
  role: UserRole;
  /** Bumped to invalidate every token issued before the change. */
  tokenVersion?: number;
  /**
   * USERNAME in deployments: from the email, with a number added when
   * another user already has it. Set at the first deploy, then fixed.
   */
  deployUsername?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
