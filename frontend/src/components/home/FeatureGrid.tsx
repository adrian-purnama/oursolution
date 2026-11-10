import {
  CalendarClock,
  Gauge,
  LayoutDashboard,
  Package,
  ServerCog,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Feature = {
  icon: LucideIcon
  title: string
  body: string
}

// Placeholder copy: adjust to what your hosting actually includes.
const FEATURES: Feature[] = [
  {
    icon: ServerCog,
    title: 'Managed apps',
    body: 'We run the servers, updates and certificates. You use the app.',
  },
  {
    icon: CalendarClock,
    title: 'Subscriptions you control',
    body: 'Each product runs for its own period. Extend whenever you like.',
  },
  {
    icon: Package,
    title: 'One-time workflows',
    body: 'Buy ready-made workflows once and keep them for good.',
  },
  {
    icon: LayoutDashboard,
    title: 'One dashboard',
    body: 'See everything you run, what is next, and when it renews.',
  },
  {
    icon: Gauge,
    title: 'Pay per product',
    body: 'No bundles. Pick only what you need and run several at once.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified accounts',
    body: 'Email codes on sign-up and safe password resets, built in.',
  },
]

export default function FeatureGrid() {
  return (
    <section className="border-b border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
            Platform
          </p>
          <h2 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">
            Everything around the app, handled.
          </h2>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="bg-white p-7 transition-colors hover:bg-[#fcfcfb]"
            >
              <span className="mb-5 inline-flex size-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                <Icon className="size-4 text-[var(--ink)]" aria-hidden />
              </span>
              <h3 className="mb-1.5 text-[15px] font-semibold text-[var(--ink)]">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
