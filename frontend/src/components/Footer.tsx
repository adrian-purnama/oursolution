import { Link } from '@tanstack/react-router'
import { useBranding } from '#/context/brandingContext'
import { CONTACT_URL } from '#/lib/config'
import { SHOW_HOME_STATE } from '#/lib/home'
import { SERVICES } from '#/lib/services'
import type { ServiceSlug } from '#/lib/services'
import { m } from '#/paraglide/messages'
import { localizeHref } from '#/paraglide/runtime'

type FooterLink =
  | {
      label: string
      to:
        | '/'
        | '/services'
        | '/pricing'
        | '/contact'
        | '/login'
        | '/register'
        | '/privacy'
        | '/terms'
    }
  | { label: string; slug: ServiceSlug }
  | { label: string; href: string }

/** Built per render so the labels follow the current language. */
const footerColumns = (): { title: string; links: FooterLink[] }[] => [
  {
    title: m.footer_services(),
    links: SERVICES.map((service) => ({
      label: service.name,
      slug: service.slug,
    })),
  },
  {
    title: m.footer_company(),
    links: [
      { label: m.nav_home(), to: '/' },
      { label: m.nav_all_services(), to: '/services' },
      { label: m.nav_shop(), to: '/pricing' },
      { label: m.nav_contact(), to: '/contact' },
      { label: m.nav_privacy(), to: '/privacy' },
      { label: m.nav_terms(), to: '/terms' },
    ],
  },
  {
    title: m.footer_account(),
    links: [
      { label: m.nav_sign_up(), to: '/register' },
      { label: m.nav_log_in(), to: '/login' },
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
              {m.footer_blurb()}
            </p>
            <a
              href={localizeHref(CONTACT_URL)}
              className="text-sm font-medium text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition hover:decoration-[var(--ink)]"
            >
              {m.footer_start_project()}
            </a>
          </div>
          {footerColumns().map((column) => (
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
                      <Link
                        to={link.to}
                        state={link.to === '/' ? SHOW_HOME_STATE : undefined}
                        className={linkClass}
                      >
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
            {m.footer_rights({ year, name: appName })}
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">
            {m.footer_motto()}
          </p>
        </div>
      </div>
    </footer>
  )
}
