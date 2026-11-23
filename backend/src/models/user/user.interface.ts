/**
 * Who bills a customer: "ID" is Indonesia (rupiah, Midtrans), "INTL" is
 * everyone else (US dollars, Paddle).
 */
export const BILLING_REGIONS = ["ID", "INTL"] as const;
export type BillingRegion = (typeof BILLING_REGIONS)[number];

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
  /** Where the user is billed. Null until chosen: treated as "ID". */
  billingRegion?: BillingRegion | null;
  /**
   * Set at the first checkout: from then on only an admin changes the
   * region, so prices cannot be picked by switching.
   */
  billingRegionLocked?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
