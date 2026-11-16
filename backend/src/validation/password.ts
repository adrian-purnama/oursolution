export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt ignores everything past 72 bytes, so longer input is rejected. */
export const MAX_PASSWORD_BYTES = 72;

/** Each rule a new password must meet. Keep in sync with frontend/src/lib/password.ts */
export const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  {
    label: `at least ${MIN_PASSWORD_LENGTH} characters`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH,
  },
  { label: "a lowercase letter", test: (password) => /[a-z]/.test(password) },
  { label: "an uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { label: "a number", test: (password) => /[0-9]/.test(password) },
  {
    label: "a symbol",
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
];

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || !password) {
    return "Password is required";
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes`;
  }
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password));
  if (missing.length > 0) {
    return `Password needs ${missing.map((rule) => rule.label).join(", ")}`;
  }
  return null;
}
