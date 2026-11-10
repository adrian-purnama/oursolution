import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '#/context/authContext'
import { useBranding } from '#/context/brandingContext'

export default function FinalCta() {
  const { isAuthenticated } = useAuth()
  const { appName } = useBranding()

  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl bg-[var(--ink)] px-8 py-14 text-white sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[var(--accent)]/40 blur-3xl"
          />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display mb-3 text-3xl sm:text-4xl">
                Deploy your first app on {appName}.
              </h2>
              <p className="text-white/60">
                Create an account, pick a product, and it is on your dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] no-underline transition hover:bg-white/90"
              >
                {isAuthenticated ? 'Open dashboard' : 'Get started'}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-[var(--radius-sm)] border border-white/20 px-5 py-2.5 text-sm font-medium text-white no-underline transition hover:border-white/50"
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
