import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '#/context/authContext'
import { hintClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

/** Top of /pricing: the Our Solution Hosting logo and one line about it. */
export default function PricingHero() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="relative overflow-hidden border-b border-[var(--line)]">
      <div
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
      />
      {isAuthenticated && (
        <div className="relative mx-auto max-w-6xl px-6 pt-6">
          <Link
            to="/dashboard"
            className={`inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {m.nav_dashboard()}
          </Link>
        </div>
      )}
      <div className="relative mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
        <h1>
          <img
            src="/oursolution-hosting-logo.png"
            alt="Our Solution Hosting"
            width={1419}
            height={289}
            className="mx-auto h-auto w-72 max-w-full sm:w-96"
          />
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[var(--muted)]">
          {m.pricing_hero_copy()}
        </p>
      </div>
    </section>
  )
}
