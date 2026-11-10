import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { UserRole } from '#/lib/adminUser'
import type { ApiResponseDto } from '#/lib/api'
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '#/lib/config'
import type { ProductSummary } from '#/lib/product'

export interface AuthUser {
  email: string
  role: UserRole
  /** Products active right now; empty when none is. */
  products: ProductSummary[]
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** True when the signed-in user may open the admin area. */
  isAdmin: boolean
  login: (jwt: string) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

let cachedUser: AuthUser | null | undefined
let bootstrapPromise: Promise<AuthUser | null> | null = null

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(jwt: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, jwt)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  invalidateAuthCache()
}

export function invalidateAuthCache(): void {
  cachedUser = undefined
  bootstrapPromise = null
}

function setCachedUser(user: AuthUser | null): void {
  cachedUser = user
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin'
}

async function fetchValidatedUser(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null

  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const body =
      (await response.json()) as ApiResponseDto<Partial<AuthUser> | null>

    if (
      !response.ok ||
      !body.success ||
      !body.data?.email ||
      !Array.isArray(body.data.products)
    ) {
      clearToken()
      return null
    }

    return {
      email: body.data.email,
      role: body.data.role === 'admin' ? 'admin' : 'user',
      products: body.data.products,
    }
  } catch {
    return null
  }
}

export async function bootstrapAuth(): Promise<AuthUser | null> {
  if (cachedUser !== undefined) return cachedUser

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const user = await fetchValidatedUser()
      setCachedUser(user)
      return user
    })().finally(() => {
      bootstrapPromise = null
    })
  }

  return bootstrapPromise
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    invalidateAuthCache()
    const validatedUser = await bootstrapAuth()
    setUser(validatedUser)
    return validatedUser
  }, [])

  useEffect(() => {
    let cancelled = false

    void bootstrapAuth().then((result) => {
      if (!cancelled) {
        setUser(result)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onFocus() {
      void refreshAuth()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshAuth])

  async function login(jwt: string) {
    setToken(jwt)
    invalidateAuthCache()
    const validatedUser = await bootstrapAuth()
    setUser(validatedUser)
  }

  function logout() {
    clearToken()
    setCachedUser(null)
    setUser(null)
  }

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isAuthenticated: user !== null,
        isLoading,
        isAdmin: isAdminUser(user),
        login,
        logout,
        refreshAuth,
      },
    },
    children,
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
