import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import GoogleButton from '#/components/forms/auth/GoogleButton'
import PasswordChecklist from '#/components/forms/shared/PasswordChecklist'
import PasswordInput from '#/components/forms/shared/PasswordInput'
import { Checkbox } from '#/components/ui/checkbox'
import { apiFetch } from '#/lib/api'
import { passwordProblem } from '#/lib/password'
import { useAuth } from '#/context/authContext'
import { safeRedirect } from '#/lib/redirect'
import {
  buttonClassName,
  buttonClassNameFull,
  cardClassName,
  hintClassName,
  inputClassNameCompact,
} from '#/lib/ui-classes'

interface RegisterResponse {
  email: string
  jwt: string
}

/** `redirect`: where to continue once the account exists, e.g. the checkout. */
export default function RegisterForm({ redirect }: { redirect?: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [agreed, setAgreed] = useState(false)

  async function sendOtp() {
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    setSendingOtp(true)

    try {
      const response = await apiFetch<{ email: string }>('/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), isResetPassword: false }),
      })

      if (!response.success) {
        toast.error(response.message || 'Failed to send OTP')
        return
      }

      setOtpSent(true)
      toast.success('OTP sent to your email')
    } catch {
      toast.error('Unable to reach the server. Please try again.')
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    if (!otp.trim() || !password) {
      toast.error('OTP and password are required')
      return
    }

    const problem = passwordProblem(password)
    if (problem) {
      toast.error(problem)
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!agreed) {
      toast.error('Please agree to the terms of service and privacy policy')
      return
    }

    setLoading(true)

    try {
      const response = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          password,
        }),
      })

      if (!response.success || !response.data?.jwt) {
        toast.error(response.message || 'Registration failed')
        return
      }

      await login(response.data.jwt)
      toast.success(response.message || 'Account created successfully')
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
      <h1 className="mb-6 text-2xl font-medium text-[var(--ink)]">Register</h1>
      {redirect?.startsWith('/checkout') ? (
        <p className={`-mt-3 mb-6 ${hintClassName}`}>
          Create an account to continue to checkout.
        </p>
      ) : null}

      <form className="w-full space-y-4" onSubmit={handleRegister}>
        <div className="w-full">
          <label
            htmlFor="register-email"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            Email
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClassNameCompact}
          />
        </div>

        <div className="w-full">
          <label
            htmlFor="register-otp"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            OTP
          </label>
          <div className="flex gap-2">
            <input
              id="register-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className={inputClassNameCompact}
              placeholder={otpSent ? 'Enter code' : 'Send OTP first'}
            />
            <button
              type="button"
              disabled={sendingOtp || !email.trim()}
              onClick={() => void sendOtp()}
              aria-label={otpSent ? 'Resend OTP' : 'Send OTP'}
              className={`${buttonClassName} shrink-0 px-3 py-2 disabled:cursor-not-allowed`}
            >
              {sendingOtp ? (
                '…'
              ) : otpSent ? (
                'Resend'
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="w-full">
          <label
            htmlFor="register-password"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            Password
          </label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
          <PasswordChecklist id="register-password-rules" password={password} />
        </div>

        <div className="w-full">
          <label
            htmlFor="register-confirm-password"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            Confirm password
          </label>
          <PasswordInput
            id="register-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {confirmPassword && confirmPassword !== password ? (
            <p className="mt-1 text-xs text-[var(--destructive)]">
              Passwords do not match
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="register-terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="register-terms"
            className="text-sm leading-snug text-[var(--muted)]"
          >
            I agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              className="text-[var(--ink)] underline"
            >
              terms of service
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="text-[var(--ink)] underline"
            >
              privacy policy
            </Link>
            .
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !agreed}
          className={`${buttonClassNameFull} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <div className={`my-5 flex items-center gap-3 text-xs ${hintClassName}`}>
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <GoogleButton
        label="Sign up with Google"
        mode="signin"
        redirect={redirect}
        disabled={!agreed}
      />
      {!agreed ? (
        <p className={`mt-2 text-center text-xs ${hintClassName}`}>
          Tick the box above to agree to the terms first.
        </p>
      ) : null}

      <p className={`mt-6 ${hintClassName}`}>
        Already have an account?{' '}
        <Link
          to="/login"
          search={redirect ? { redirect } : {}}
          className="text-[var(--ink)] underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
