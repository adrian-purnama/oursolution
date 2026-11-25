import type { ReactNode } from 'react'
import { CHECK_STATE_LABELS, STATE_LABELS } from '#/lib/deployment'
import type {
  DeploymentState,
  ServiceCheckState,
  ServiceStatus,
} from '#/lib/deployment'
import { formatDateTime } from '#/lib/product'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

const STATE_DOT: Record<DeploymentState, string> = {
  notDeployed: 'bg-[var(--line)]',
  deploying: 'bg-amber-500 animate-pulse',
  running: 'bg-[var(--accent)]',
  stopping: 'bg-amber-500 animate-pulse',
  stopped: 'bg-[var(--muted)]',
  restarting: 'bg-amber-500 animate-pulse',
  erasing: 'bg-amber-500 animate-pulse',
  runningCommand: 'bg-amber-500 animate-pulse',
  failed: 'bg-[var(--destructive)]',
}

export function StateBadge({ state }: { state: DeploymentState }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 text-xs">
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', STATE_DOT[state])}
      />
      {STATE_LABELS[state]}
    </span>
  )
}

export const CHECK_COLOR: Record<ServiceCheckState, string> = {
  up: 'bg-[var(--accent)]',
  down: 'bg-[var(--destructive)]',
  pending: 'bg-amber-500',
  maintenance: 'bg-[var(--muted)]',
}

/** The worst of several addresses' states: one down means down. */
export function overallCheckState(
  statuses: ServiceStatus[],
): ServiceCheckState | null {
  const order: ServiceCheckState[] = ['down', 'pending', 'maintenance', 'up']
  return (
    order.find((state) => statuses.some((item) => item.state === state)) ?? null
  )
}

/** The latest checks as short ovals, oldest on the left. */
export function BeatBar({
  status,
  className,
}: {
  status: ServiceStatus
  className?: string
}) {
  return (
    <div
      className={cn('flex h-3.5 gap-[3px]', className)}
      role="img"
      aria-label={m.svc_status_aria({
        count: status.beats.length,
        host: status.host,
      })}
    >
      {status.beats.map((beat) => (
        <span
          key={beat.at}
          title={`${CHECK_STATE_LABELS[beat.state]} · ${formatDateTime(beat.at)}`}
          className={cn(
            'min-w-0 flex-1 rounded-full transition-opacity hover:opacity-60',
            CHECK_COLOR[beat.state],
          )}
        />
      ))}
    </div>
  )
}

/** How many grey ovals stand in before a service has any checks. */
const EMPTY_BEATS = 30

/** The same row of ovals, all grey: no checks yet, or not monitored. */
export function EmptyBeatBar({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-3.5 gap-[3px]', className)} aria-hidden>
      {Array.from({ length: EMPTY_BEATS }, (_, index) => (
        <span
          key={index}
          className="min-w-0 flex-1 rounded-full bg-[var(--line)]"
        />
      ))}
    </div>
  )
}

/** A small label over a larger value. */
export function Stat({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('min-w-0 bg-white px-3 py-3 sm:px-5 sm:py-4', className)}
    >
      <dt className="text-[11px] leading-tight text-[var(--muted)] sm:text-xs">
        {label}
      </dt>
      <dd className="mt-1 truncate text-base font-medium tracking-tight tabular-nums sm:text-lg">
        {children}
      </dd>
    </div>
  )
}
