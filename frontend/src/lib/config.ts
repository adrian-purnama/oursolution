export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Shown until the branding request returns; keep in sync with the backend default. */
export const DEFAULT_APP_NAME = 'Adrian Template'

export const TOKEN_STORAGE_KEY = 'auth_token'
