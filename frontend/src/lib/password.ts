import { m } from '#/paraglide/messages'
/** Keep in sync with backend/src/validation/password.ts */
export const MIN_PASSWORD_LENGTH = 8

export type PasswordRule = {
  /** A getter, so it follows the current language. */
  readonly label: string
  test: (password: string) => boolean
}

/** Each rule a new password must meet. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    get label() {
      return m.pw_rule_length({ count: MIN_PASSWORD_LENGTH })
    },
    test: (password) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    get label() {
      return m.pw_rule_lower()
    },
    test: (password) => /[a-z]/.test(password),
  },
  {
    get label() {
      return m.pw_rule_upper()
    },
    test: (password) => /[A-Z]/.test(password),
  },
  {
    get label() {
      return m.pw_rule_number()
    },
    test: (password) => /[0-9]/.test(password),
  },
  {
    get label() {
      return m.pw_rule_symbol()
    },
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
]

/** "Password needs a number, a symbol", or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (!password) return m.pw_required()
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password))
  if (missing.length === 0) return null
  return m.pw_needs({
    rules: missing
      .map((rule) => rule.label.charAt(0).toLowerCase() + rule.label.slice(1))
      .join(', '),
  })
}
