import { Link } from '@tanstack/react-router'
import { useBranding } from '#/context/brandingContext'
import { CONTACT_URL } from '#/lib/config'
import { SERVICES } from '#/lib/services'
import type { ServiceSlug } from '#/lib/services'

type FooterLink =
  | {
      label: string
      to: '/' | '/services' | '/pricing' | '/contact' | '/login' | '/register'
    }
  | { label: string; slug: ServiceSlug }
  | { label: string; href: string }

const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Services',
    links: SERVICES.map((service) => ({
      label: service.name,
      slug: service.slug,
    })),
  },
  {
    title: 'Company',
    links: [
      { label: 'Home', to: '/' },
      { label: 'All services', to: '/services' },
      { label: 'Shop', to: '/pricing' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Get started', to: '/register' },
      { label: 'Log in', to: '/login' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()
  const { appName, appLogo } = useBranding()
  const linkClass =
    'text-sm text-[var(--muted)] no-underline transition hover:text-[var(--ink)]'

  return (
    <footer className="border-t border-[var(--line)] bg-white text-[var(--ink)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 grid gap-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="sm:col-span-3 lg:col-span-1">
            <p className="font-display mb-4 inline-flex items-center gap-2.5 text-[17px]">
              {appLogo ? (
                <img src={appLogo} alt="" className="size-8 object-contain" />
              ) : null}
              {appName}
            </p>
            <p className="mb-5 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
              Software solutions, hosting solutions and the answr.id chatbot,
              from one team.
            </p>
            <a
              href={CONTACT_URL}
              className="text-sm font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition hover:decoration-[var(--ink)]"
            >
              Start a project
            </a>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="mb-4 text-sm font-semibold">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {'slug' in link ? (
                      <Link
                        to="/services/$slug"
                        params={{ slug: link.slug }}
                        className={linkClass}
                      >
                        {link.label}
                      </Link>
                    ) : 'to' in link ? (
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
        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            &copy; {year} {appName}. All rights reserved.
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">
            Build · Run · Support
          </p>
        </div>
      </div>
    </footer>
  )
}
