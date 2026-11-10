import { Link } from '@tanstack/react-router'
import { useAuth } from '#/context/authContext'
import { useBranding } from '#/context/brandingContext'

const primaryCta =
  'inline-block bg-[var(--paper)] px-6 py-3 text-sm font-semibold text-[var(--ink)] no-underline transition hover:bg-[var(--accent-paper)]'
const secondaryCta =
  'inline-block border border-[var(--border)] px-6 py-3 text-sm text-white no-underline transition hover:border-white/40'

export default function HeroSection() {
  const { isAuthenticated } = useAuth()
  const { appName } = useBranding()

  return (
    <section className="relative overflow-hidden text-[var(--paper)]">
      <video
        autoPlay
        muted
        playsInline
        loop
        aria-hidden
        className="absolute inset-0 z-0 h-full w-full object-cover opacity-40 motion-reduce:hidden"
      >
        <source src="/hero-animation.mp4" type="video/mp4" />
      </video>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-[var(--ink)] to-transparent sm:h-32"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
        <p className="mb-6 text-xs tracking-[0.25em] text-white/50 uppercase">
          {appName}
        </p>
        <h1 className="font-display mb-6 max-w-4xl text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
          One account for everything you <em className="italic">run</em>.
        </h1>
        <p className="mb-10 max-w-xl text-base leading-relaxed text-white/70">
          Sign up, choose your products and manage it all from a single
          dashboard. No setup calls, no waiting.
        </p>
        <div className="flex flex-wrap gap-4">
          {isAuthenticated ? (
            <Link to="/dashboard" className={primaryCta}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className={primaryCta}>
                Get started
              </Link>
              <Link to="/login" className={secondaryCta}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
