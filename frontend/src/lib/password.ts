/** Keep in sync with backend/src/validation/password.ts */
export const MIN_PASSWORD_LENGTH = 8

export type PasswordRule = {
  label: string
  test: (password: string) => boolean
}

/** Each rule a new password must meet. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH,
  },
  { label: 'A lowercase letter', test: (password) => /[a-z]/.test(password) },
  { label: 'An uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { label: 'A number', test: (password) => /[0-9]/.test(password) },
  {
    label: 'A symbol, like ! @ # or ?',
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
]

/** "Password needs a number, a symbol", or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (!password) return 'Password is required'
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password))
  if (missing.length === 0) return null
  return `Password needs ${missing
    .map((rule) => rule.label.charAt(0).toLowerCase() + rule.label.slice(1))
    .join(', ')}`
}
