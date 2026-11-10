import { Link } from '@tanstack/react-router'
import { useAuth } from '#/context/authContext'
import { useBranding } from '#/context/brandingContext'

export default function FinalCta() {
  const { isAuthenticated } = useAuth()
  const { appName } = useBranding()

  return (
    <section className="border-t border-dashed border-white/10 text-white">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <h2 className="font-display mb-8 max-w-3xl text-4xl leading-tight tracking-tight sm:text-5xl">
          Ready when you are. Start with {appName} today.
        </h2>
        <Link
          to={isAuthenticated ? '/dashboard' : '/register'}
          className="inline-block bg-[var(--paper)] px-6 py-3 text-sm font-semibold text-[var(--ink)] no-underline transition hover:bg-[var(--accent-paper)]"
        >
          {isAuthenticated ? 'Open dashboard' : 'Create your account'}
        </Link>
      </div>
    </section>
  )
}
