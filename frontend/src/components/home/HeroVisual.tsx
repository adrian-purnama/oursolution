import {
  Activity,
  BarChart3,
  Check,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from 'lucide-react'
import { BRAND_NAME } from '#/lib/config'
import { cn } from '#/lib/utils'

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: Package, label: 'Orders', active: false },
  { icon: Users, label: 'Customers', active: false },
  { icon: BarChart3, label: 'Reports', active: false },
  { icon: Settings, label: 'Settings', active: false },
]

const STATS = [
  { label: 'Orders today', value: '128', note: '+12 since yesterday' },
  { label: 'Waiting for approval', value: '9', note: '3 older than a day' },
  { label: 'Average handling', value: '4m 10s', note: 'Was 26m on paper' },
]

/** Bar heights (percent) for the example week. */
const WEEK = [
  { day: 'Mon', value: 46 },
  { day: 'Tue', value: 62 },
  { day: 'Wed', value: 54 },
  { day: 'Thu', value: 78 },
  { day: 'Fri', value: 91 },
  { day: 'Sat', value: 40 },
  { day: 'Sun', value: 28 },
]

const ACTIVITY = [
  { text: 'Order #2041 approved', time: '2m ago' },
  { text: 'Invoice sent to Sari Logistics', time: '14m ago' },
  { text: 'Stock synced from warehouse', time: '1h ago' },
]

const PIPELINE = ['Build', 'Tests', 'Deploy']

const floatCard =
  'absolute hidden rounded-xl border border-[var(--line)] bg-white p-4 text-left shadow-[0_1px_2px_rgba(12,12,11,0.05),0_24px_48px_-20px_rgba(12,12,11,0.28)] xl:block'

/**
 * An example of what a client gets: their own app in the middle, with the
 * release pipeline and monitoring we run around it. Purely illustrative.
 */
export default function HeroVisual() {
  return (
    <div
      role="img"
      aria-label={`Example: a custom order management app, with its release pipeline and monitoring run by ${BRAND_NAME}`}
      className="relative mx-auto max-w-5xl"
    >
      <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[var(--line)] bg-white text-left shadow-[0_1px_2px_rgba(12,12,11,0.04),0_40px_80px_-32px_rgba(12,12,11,0.3)]">
        {/* Browser bar */}
        <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
            <span className="size-2.5 rounded-full bg-[var(--line)]" />
          </span>
          <span className="mx-auto w-full max-w-xs truncate rounded-md border border-[var(--line)] bg-white px-3 py-1 text-center font-mono text-[11px] text-[var(--muted)]">
            orders.yourcompany.com
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)]">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="grid md:grid-cols-[12.5rem_1fr]">
          <div className="hidden border-r border-[var(--line)] bg-[var(--surface)]/60 p-4 md:block">
            <p className="mb-5 flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--ink)] text-[11px] text-white">
                Y
              </span>
              Your Company
            </p>
            <ul className="space-y-1">
              {NAV.map(({ icon: Icon, label, active }) => (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
                    active
                      ? 'bg-white font-medium text-[var(--ink)] shadow-[0_1px_2px_rgba(12,12,11,0.06)]'
                      : 'text-[var(--muted)]',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <p className="text-base font-semibold">Orders overview</p>
              <p className="font-mono text-[11px] text-[var(--muted)]">
                Updated just now
              </p>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-[var(--line)] p-4"
                >
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    {stat.label}
                  </p>
                  <p className="font-display mb-1 text-2xl">{stat.value}</p>
                  <p className="text-[11px] text-[var(--accent)]">
                    {stat.note}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-[var(--line)] p-4">
                <p className="mb-4 text-xs text-[var(--muted)]">
                  Orders this week
                </p>
                <div className="flex h-28 items-end gap-2.5">
                  {WEEK.map((bar) => (
                    <div
                      key={bar.day}
                      className="flex h-full flex-1 flex-col justify-end gap-1.5"
                    >
                      <div
                        className={cn(
                          'rounded-t-sm',
                          bar.day === 'Fri'
                            ? 'bg-[var(--accent)]'
                            : 'bg-[var(--accent)]/20',
                        )}
                        style={{ height: `${bar.value}%` }}
                      />
                      <span className="text-center font-mono text-[10px] text-[var(--muted)]">
                        {bar.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden rounded-lg border border-[var(--line)] p-4 sm:block">
                <p className="mb-3 text-xs text-[var(--muted)]">
                  Recent activity
                </p>
                <ul className="space-y-3">
                  {ACTIVITY.map((item) => (
                    <li key={item.text} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">
                          {item.text}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {item.time}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What we run around it: releases on the left, monitoring on the right. */}
      <div className={cn(floatCard, 'top-24 -left-24 w-56')}>
        <p className="mb-3 font-mono text-[11px] text-[var(--muted)]">
          Release v2.4
        </p>
        <ul className="space-y-2.5">
          {PIPELINE.map((step) => (
            <li key={step} className="flex items-center gap-2.5 text-[13px]">
              <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                <Check className="size-3" aria-hidden />
              </span>
              {step}
              <span className="ml-auto font-mono text-[10px] text-[var(--muted)]">
                passed
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn(floatCard, '-right-24 bottom-8 w-60')}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] text-[var(--muted)]">
            Monitoring
          </p>
          <Activity className="size-3.5 text-[var(--accent)]" aria-hidden />
        </div>
        <p className="mb-3 text-[13px] font-medium">All systems normal</p>
        <svg
          viewBox="0 0 200 40"
          className="h-10 w-full text-[var(--accent)]"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 28 L20 26 L40 29 L60 22 L80 25 L100 18 L120 21 L140 14 L160 17 L180 10 L200 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0 28 L20 26 L40 29 L60 22 L80 25 L100 18 L120 21 L140 14 L160 17 L180 10 L200 12 L200 40 L0 40 Z"
            fill="currentColor"
            opacity="0.1"
          />
        </svg>
        <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
          Backups on · updates managed
        </p>
      </div>
    </div>
  )
}
