import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import PasswordInput from '#/components/forms/shared/PasswordInput'
import { apiFetch } from '#/lib/api'
import { useAuth } from '#/context/authContext'
import { safeRedirect } from '#/lib/redirect'
import {
  buttonClassNameFull,
  cardClassName,
  hintClassName,
  inputClassNameCompact,
} from '#/lib/ui-classes'

interface LoginResponse {
  email: string
  jwt: string
}

/** `redirect`: where to continue after signing in, e.g. the checkout. */
export default function LoginForm({ redirect }: { redirect?: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      toast.error('Email and password are required')
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      })

      if (!response.success || !response.data?.jwt) {
        toast.error(response.message || 'Login failed')
        return
      }

      await login(response.data.jwt)
      toast.success(response.message || 'Logged in successfully')
      const next = safeRedirect(redirect)
      if (next) router.history.push(next)
      else await navigate({ to: '/dashboard' })
    } catch {
      toast.error('Unable to reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${cardClassName} w-full p-6 sm:p-8`}>
      <h1 className="mb-6 text-2xl font-medium text-[var(--ink)]">Sign in</h1>
      {redirect?.startsWith('/checkout') ? (
        <p className={`-mt-3 mb-6 ${hintClassName}`}>
          Sign in to continue to checkout.
        </p>
      ) : null}

      <form className="w-full space-y-4" onSubmit={handleSubmit}>
        <div className="w-full">
          <label
            htmlFor="login-email"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassNameCompact}
          />
        </div>

        <div className="w-full">
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-sm text-[var(--ink)]"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className={`${hintClassName} underline hover:text-[var(--ink)]`}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        <label className={`flex items-center gap-2 ${hintClassName}`}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={loading}
          className={buttonClassNameFull}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className={`mt-6 ${hintClassName}`}>
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          search={redirect ? { redirect } : {}}
          className="text-[var(--ink)] underline"
        >
          Register
        </Link>
      </p>
    </div>
  )
}
