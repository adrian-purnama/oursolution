import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'

/** On /contact: hosting needs no conversation, just an account and a plan. */
export default function HostingSignup() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <img
          src="/oursolution-hosting-logo.png"
          alt="Our Solution Hosting"
          width={1419}
          height={289}
          className="mb-4 h-auto w-48"
        />
        <h2 className="text-lg font-semibold">Here for hosting?</h2>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          No need to wait for us. Create an account, pick a plan and your app is
          set up for you.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        {isAuthenticated ? null : (
          <Button asChild>
            <Link to="/register">
              Register
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant={isAuthenticated ? 'default' : 'outline'}
          className="border-[var(--line)]"
        >
          <Link to="/pricing">See hosting plans</Link>
        </Button>
      </div>
    </section>
  )
}
