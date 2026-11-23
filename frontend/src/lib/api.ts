import { getToken } from '#/context/authContext'
import { API_BASE_URL } from '#/lib/config'

export interface ApiResponseDto<T = null> {
  success: boolean
  message: string
  data: T
}

/** What the API actually returns: `data` is null whenever `success` is false. */
export type ApiResponse<T> = ApiResponseDto<T | null>

/**
 * Where the browser says it is. The API prices by Cloudflare's country
 * header and falls back on this when that is missing.
 */
function browserTimezone(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const timezone = browserTimezone()
  if (timezone) headers.set('X-Client-Timezone', timezone)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  let body: ApiResponse<T>
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('Invalid server response')
  }

  return body
}

/** Multipart upload    does not set Content-Type so the browser can add the boundary. */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { method?: 'POST' | 'PATCH' } = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers()
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: formData,
  })

  let body: ApiResponse<T>
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('Invalid server response')
  }

  return body
}

export function toAbsoluteMediaUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE_URL}${path}`
}
