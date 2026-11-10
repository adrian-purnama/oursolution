import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import DeployConsole from '#/components/home/DeployConsole'
import { useAuth } from '#/context/authContext'

const primaryCta =
  'inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white no-underline transition hover:opacity-90'
const secondaryCta =
  'inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--ink)] no-underline transition hover:border-[var(--ink)]/30'

export default function HeroSection() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="relative overflow-hidden border-b border-[var(--line)]">
      <div
        aria-hidden
        className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs text-[var(--muted)]">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Managed hosting · n8n ready
          </p>
          <h1 className="font-display mb-5 max-w-xl text-5xl leading-[1.04] text-[var(--ink)] sm:text-6xl">
            Hosting for the tools you run every day.
          </h1>
          <p className="mb-9 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            Launch managed apps like n8n, pick up ready-made workflows, and
            manage every subscription from one dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className={primaryCta}
            >
              {isAuthenticated ? 'Open dashboard' : 'Start deploying'}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/pricing" className={secondaryCta}>
              View pricing
            </Link>
          </div>
          <p className="mt-8 font-mono text-xs text-[var(--muted)]">
            Pay per product · Extend anytime · No setup calls
          </p>
        </div>

        <DeployConsole />
      </div>
    </section>
  )
}
