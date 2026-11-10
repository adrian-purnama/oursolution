import { Link, useRouterState } from '@tanstack/react-router'
import { useBranding } from '#/context/brandingContext'
import { cn } from '#/lib/utils'

type FooterLink =
  | { label: string; to: '/' | '/pricing' | '/login' | '/register' }
  | { label: string; href: string }

const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Register', to: '/register' },
      { label: 'Login', to: '/login' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()
  const { appName } = useBranding()
  const isHome = useRouterState({
    select: (state) => state.location.pathname === '/',
  })

  const linkClass = isHome
    ? 'text-sm text-white/60 no-underline transition hover:text-white'
    : 'text-sm text-[var(--muted)] no-underline transition hover:text-[var(--ink)]'

  return (
    <footer
      className={cn(
        isHome
          ? 'bg-[var(--ink)] text-white'
          : 'border-t border-[var(--line)] bg-white text-[var(--ink)]',
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 grid gap-10 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-4 text-sm font-semibold">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {'to' in link ? (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className={cn(
            'border-t pt-8',
            isHome ? 'border-white/10' : 'border-[var(--line)]',
          )}
        >
          <p
            className={cn(
              'text-sm',
              isHome ? 'text-white/40' : 'text-[var(--muted)]',
            )}
          >
            &copy; {year} {appName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
