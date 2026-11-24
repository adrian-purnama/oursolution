import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { m } from '#/paraglide/messages'

/** On /contact: hosting needs no conversation, just an account and a plan. */
export default function HostingSignup() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <img
          src="/oursolution-hosting-logo.png"
          alt={m.hosting_signup_logo_alt()}
          width={1419}
          height={289}
          className="mb-4 h-auto w-48"
        />
        <h2 className="text-lg font-semibold">{m.hosting_signup_title()}</h2>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          {m.hosting_signup_copy()}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        {isAuthenticated ? null : (
          <Button asChild>
            <Link to="/register">
              {m.hosting_signup_register()}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant={isAuthenticated ? 'default' : 'outline'}
          className="border-[var(--line)]"
        >
          <Link to="/pricing">{m.hosting_signup_plans()}</Link>
        </Button>
      </div>
    </section>
  )
}
