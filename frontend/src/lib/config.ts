export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Shown until the branding request returns; keep in sync with the backend default. */
export const DEFAULT_APP_NAME = 'Our Solution'

export const TOKEN_STORAGE_KEY = 'auth_token'

/**
 * The brand name used in the public site's copy. The name and logo in the
 * header and footer come from App Config in the admin area instead.
 */
export const BRAND_NAME = 'Our Solution'

/** Where "Start a project" buttons go: the public contact page. */
export const CONTACT_URL = '/contact'

export const ANSWR_URL = 'https://answr.id'
