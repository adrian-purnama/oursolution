import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Send } from 'lucide-react'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
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
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

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
  /** Set when the user tried to go on without agreeing, to point at the box. */
  const [needsAgreement, setNeedsAgreement] = useState(false)
  const termsBox = useRef<HTMLLabelElement>(null)

  /** True when the terms are agreed; otherwise points the user at the box. */
  function checkAgreed(): boolean {
    if (agreed) return true
    setNeedsAgreement(true)
    termsBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    toast.error(m.auth_register_agree_toast())
    return false
  }

  async function sendOtp() {
    if (!email.trim()) {
      toast.error(m.auth_register_email_required())
      return
    }

    setSendingOtp(true)

    try {
      const response = await apiFetch<{ email: string }>('/auth/otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), isResetPassword: false }),
      })

      if (!response.success) {
        toast.error(response.message || m.auth_register_otp_failed())
        return
      }

      setOtpSent(true)
      toast.success(m.auth_register_otp_sent())
    } catch {
      toast.error(m.common_error_network())
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      toast.error(m.auth_register_email_required())
      return
    }

    if (!otp.trim() || !password) {
      toast.error(m.auth_register_otp_pw_required())
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

    if (!checkAgreed()) return

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
        toast.error(response.message || m.auth_register_failed())
        return
      }

      await login(response.data.jwt)
      toast.success(response.message || m.auth_register_success())
      const next = safeRedirect(redirect)
      if (next) router.history.push(next)
      else await navigate({ to: '/dashboard' })
    } catch {
      toast.error(m.common_error_network())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${cardClassName} w-full p-6 sm:p-8`}>
      <h1 className="mb-1 text-2xl font-medium text-[var(--ink)]">
        {m.auth_register_title()}
      </h1>
      <p className={`mb-6 ${hintClassName}`}>
        {redirect?.startsWith('/checkout')
          ? m.auth_register_checkout_hint()
          : m.auth_register_hint()}
      </p>

      {/* Agreement first: it covers Google and email sign-up alike. */}
      <label
        ref={termsBox}
        htmlFor="register-terms"
        className={cn(
          'mb-5 flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border p-3.5 transition-colors',
          agreed
            ? 'border-[var(--line)] bg-white'
            : needsAgreement
              ? 'border-[var(--destructive)] bg-red-50'
              : 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,white)]',
        )}
      >
        <Checkbox
          id="register-terms"
          checked={agreed}
          onCheckedChange={(checked) => {
            setAgreed(checked === true)
            setNeedsAgreement(false)
          }}
          className="mt-0.5 size-5 border-[var(--ink)]/40 bg-white"
        />
        <span className="text-sm leading-snug text-[var(--ink)]">
          {m.auth_register_agree_1()}{' '}
          <Link
            to="/terms"
            target="_blank"
            className="font-medium underline"
            onClick={(event) => event.stopPropagation()}
          >
            {m.auth_register_agree_terms()}
          </Link>{' '}
          {m.auth_register_agree_and()}{' '}
          <Link
            to="/privacy"
            target="_blank"
            className="font-medium underline"
            onClick={(event) => event.stopPropagation()}
          >
            {m.auth_register_agree_privacy()}
          </Link>
          .
        </span>
      </label>

      <GoogleButton
        label={m.common_continue_google()}
        mode="signin"
        redirect={redirect}
        onBeforeStart={checkAgreed}
        className="h-11 w-full"
      />

      <div className={`my-5 flex items-center gap-3 text-xs ${hintClassName}`}>
        <span className="h-px flex-1 bg-[var(--line)]" />
        {m.auth_register_or_email()}
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form className="w-full space-y-4" onSubmit={handleRegister}>
        <div className="w-full">
          <label
            htmlFor="register-email"
            className="mb-1 block text-sm text-[var(--ink)]"
          >
            {m.common_email()}
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
            {m.auth_register_otp_label()}
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
              placeholder={
                otpSent
                  ? m.auth_register_otp_enter()
                  : m.auth_register_otp_first()
              }
            />
            <button
              type="button"
              disabled={sendingOtp || !email.trim()}
              onClick={() => void sendOtp()}
              aria-label={
                otpSent
                  ? m.auth_register_otp_resend()
                  : m.auth_register_otp_send()
              }
              className={`${buttonClassName} shrink-0 px-3 py-2 disabled:cursor-not-allowed`}
            >
              {sendingOtp ? (
                '…'
              ) : otpSent ? (
                m.auth_register_resend()
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
            {m.common_password()}
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
            {m.common_confirm_password()}
          </label>
          <PasswordInput
            id="register-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          {confirmPassword && confirmPassword !== password ? (
            <p className="mt-1 text-xs text-[var(--destructive)]">
              {m.common_passwords_mismatch()}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`${buttonClassNameFull} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? m.auth_register_creating() : m.auth_register_create()}
        </button>
      </form>

      <p className={`mt-6 ${hintClassName}`}>
        {m.auth_register_have_account()}{' '}
        <Link
          to="/login"
          search={redirect ? { redirect } : {}}
          className="text-[var(--ink)] underline"
        >
          {m.auth_register_signin()}
        </Link>
      </p>
    </div>
  )
}
