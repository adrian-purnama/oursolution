import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '#/lib/api'
import {
  buttonClassNameFull,
  cardClassName,
  hintClassName,
  inputClassNameCompact,
} from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      toast.error(m.auth_forgot_email_required())
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch<{ email: string }>('/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), isResetPassword: true }),
      })

      if (!response.success) {
        toast.error(response.message || m.auth_forgot_failed())
        return
      }

      setSent(true)
      toast.success(response.message || m.auth_forgot_sent_toast())
    } catch {
      toast.error(m.common_error_network())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${cardClassName} w-full p-6 sm:p-8`}>
      <h1 className="mb-6 text-2xl font-medium text-[var(--ink)]">
        {m.auth_forgot_title()}
      </h1>

      {sent ? (
        <p className={`leading-relaxed ${hintClassName}`}>
          {m.auth_forgot_sent()}
        </p>
      ) : (
        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          <div className="w-full">
            <label
              htmlFor="forgot-email"
              className="mb-1 block text-sm text-[var(--ink)]"
            >
              {m.common_email()}
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassNameCompact}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={buttonClassNameFull}
          >
            {loading ? m.auth_forgot_sending() : m.auth_forgot_send()}
          </button>
        </form>
      )}

      <p className={`mt-6 ${hintClassName}`}>
        <Link to="/login" className="text-[var(--ink)] underline">
          {m.common_back_to_signin()}
        </Link>
      </p>
    </div>
  )
}
