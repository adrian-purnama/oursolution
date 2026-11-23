import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import PasswordInput from '#/components/forms/shared/PasswordInput'
import { apiFetch } from '#/lib/api'
import PasswordChecklist from '#/components/forms/shared/PasswordChecklist'
import { passwordProblem } from '#/lib/password'
import { decodeResetToken } from '#/lib/reset-token'
import {
  buttonClassNameFull,
  cardClassName,
  hintClassName,
  inputClassNameCompact,
} from '#/lib/ui-classes'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

const readOnlyInputClassName = cn(
  inputClassNameCompact,
  'read-only:bg-[var(--surface)] read-only:text-[var(--muted)]',
)

export default function ResetPasswordForm() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_auth/reset-password' })
  const tokenPayload = search.token ? decodeResetToken(search.token) : null
  const email = tokenPayload?.email ?? search.email
  const otp = tokenPayload?.otp ?? search.otp
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const hasRequiredParams = Boolean(email && otp)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!hasRequiredParams) {
      toast.error(m.auth_reset_invalid_toast())
      return
    }

    const problem = passwordProblem(password)
    if (problem) {
      toast.error(problem)
      return
    }

    if (password !== confirmPassword) {
      toast.error(m.common_passwords_mismatch())
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch<{ email: string }>(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ email, otp, password }),
        },
      )

      if (!response.success) {
        toast.error(response.message || m.auth_reset_failed())
        return
      }

      toast.success(response.message || m.auth_reset_success())
      await navigate({ to: '/login' })
    } catch {
      toast.error(m.common_error_network())
    } finally {
      setLoading(false)
    }
  }

  if (!hasRequiredParams) {
    return (
      <div className={`${cardClassName} w-full p-6 sm:p-8`}>
        <h1 className="mb-6 text-2xl font-medium text-[var(--ink)]">
          {m.auth_reset_title()}
        </h1>
        <p className={`mb-6 ${hintClassName}`}>{m.auth_reset_invalid()}</p>
        <Link
          to="/forgot-password"
          className="text-sm text-[var(--ink)] underline"
        >
          {m.auth_reset_request_new()}
        </Link>
      </div>
    )
  }

  return (
    <div className={`${cardClassName} w-full p-6 sm:p-8`}>
      <h1 className="mb-6 text-2xl font-medium text-[var(--ink)]">
        {m.auth_reset_title()}
      </h1>

      <form className="w-full space-y-4" onSubmit={handleSubmit}>
        <div className="w-full">
          <label
            htmlFor="reset-email"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            {m.common_email()}
          </label>
          <input
            id="reset-email"
            type="email"
            readOnly
            value={email}
            className={readOnlyInputClassName}
          />
        </div>

        <div className="w-full">
          <label
            htmlFor="reset-otp"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            {m.auth_reset_otp()}
          </label>
          <input
            id="reset-otp"
            type="text"
            readOnly
            value={otp}
            className={readOnlyInputClassName}
          />
        </div>

        <div className="w-full">
          <label
            htmlFor="reset-password"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            {m.auth_reset_new_password()}
          </label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <PasswordChecklist password={password} />
        </div>

        <div className="w-full">
          <label
            htmlFor="reset-confirm-password"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            {m.common_confirm_password()}
          </label>
          <PasswordInput
            id="reset-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={buttonClassNameFull}
        >
          {loading ? m.auth_reset_resetting() : m.auth_reset_title()}
        </button>
      </form>

      <p className={`mt-6 ${hintClassName}`}>
        <Link to="/login" className="text-[var(--ink)] underline">
          {m.common_back_to_signin()}
        </Link>
      </p>
    </div>
  )
}
