export type UserRole = 'user' | 'admin'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  admin: 'Admin',
}

export type AdminUser = {
  id: string
  email: string
  isBlocked: boolean
  role: UserRole
}

export type AdminUserDetail = AdminUser & {
  accountCreatedAt: string
}
