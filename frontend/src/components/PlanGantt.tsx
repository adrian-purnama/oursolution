import type { ReactNode } from 'react'
import ProductBadge from '#/components/ProductBadge'
import { formatDateTime } from '#/lib/product'
import type { ProductPeriod, UserPlan, UserProductRow } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_TICK_LABELS = 10

type Range = { start: number; end: number }

/** The time span drawn: every period, today, and some room ahead. */
function chartWindow(plan: UserPlan, now: number): Range {
  const points = plan.rows.flatMap((row) =>
    row.periods.flatMap((period) => [
      Date.parse(period.startsAt),
      ...(period.endsAt ? [Date.parse(period.endsAt)] : []),
    ]),
  )
  const start = Math.min(now - 7 * DAY_MS, ...points)
  const end = Math.max(now + 30 * DAY_MS, ...points)
  const pad = (end - start) * 0.03
  return { start: start - pad, end: end + pad }
}

type Tick = { at: number; label: string }

/** Week, month or year marks depending on how long the window is. */
function ticks({ start, end }: Range): Tick[] {
  const spanDays = (end - start) / DAY_MS
  const result: Tick[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  if (spanDays <= 70) {
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7)) // next Monday
    const format = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
    })
    for (; cursor.getTime() <= end; cursor.setDate(cursor.getDate() + 7)) {
      result.push({ at: cursor.getTime(), label: format.format(cursor) })
    }
  } else if (spanDays <= 3 * 365) {
    cursor.setDate(1)
    cursor.setMonth(cursor.getMonth() + 1)
    const month = new Intl.DateTimeFormat(undefined, { month: 'short' })
    const monthYear = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: 'numeric',
    })
    for (; cursor.getTime() <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      const label =
        result.length === 0 || cursor.getMonth() === 0
          ? monthYear.format(cursor)
          : month.format(cursor)
      result.push({ at: cursor.getTime(), label })
    }
  } else {
    cursor.setMonth(0, 1)
    cursor.setFullYear(cursor.getFullYear() + 1)
    for (
      ;
      cursor.getTime() <= end;
      cursor.setFullYear(cursor.getFullYear() + 1)
    ) {
      result.push({ at: cursor.getTime(), label: String(cursor.getFullYear()) })
    }
  }

  const every = Math.ceil(result.length / MAX_TICK_LABELS)
  return result.filter((_, index) => index % every === 0)
}

function percent(at: number, { start, end }: Range): number {
  return Math.min(Math.max(((at - start) / (end - start)) * 100, 0), 100)
}

function describePeriod(period: ProductPeriod): string {
  const end = period.endsAt ? formatDateTime(period.endsAt) : 'no end'
  return `${formatDateTime(period.startsAt)} – ${end}`
}

/** One line on where a product stands: running, coming, or stopped. */
function rowStatus(row: UserProductRow, now: number): string {
  const current = row.periods.find((period) => period.isCurrent)
  if (current) {
    return current.endsAt
      ? `Active until ${formatDateTime(current.endsAt)}`
      : 'Active, no end date'
  }
  const next = row.periods.find((period) => Date.parse(period.startsAt) > now)
  if (next) return `Starts ${formatDateTime(next.startsAt)}`
  const last = row.periods.at(-1)
  return last?.endsAt ? `Ended ${formatDateTime(last.endsAt)}` : 'Inactive'
}

/**
 * A user's plan as a Gantt chart: one row per product, bars for the time
 * each one is active. Gaps are time the product is not active.
 */
export default function PlanGantt({
  plan,
  rowActions,
  emptyText = 'No products yet.',
}: {
  plan: UserPlan
  /** Extra controls on a product's row, e.g. an admin "Stop now". */
  rowActions?: (row: UserProductRow) => ReactNode
  emptyText?: string
}) {
  if (plan.rows.length === 0) {
    return <p className={hintClassName}>{emptyText}</p>
  }

  const now = Date.parse(plan.now)
  const range = chartWindow(plan, now)
  const nowAt = percent(now, range)
  const marks = ticks(range)

  return (
    <div className="space-y-1">
      {/* Axis: labels sit over the timeline column only. */}
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
        <div className="hidden sm:block" />
        <div className="relative h-5 text-[10px] text-[var(--muted)]">
          {marks.map((tick) => (
            <span
              key={tick.at}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${percent(tick.at, range)}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="space-y-3 sm:space-y-1.5">
        {plan.rows.map((row) => (
          <li
            key={row.product.id}
            className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[12rem_1fr] sm:gap-4"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <ProductBadge product={row.product} />
                <p
                  className={cn(
                    'mt-0.5 truncate text-[11px]',
                    row.active ? 'text-[var(--ink)]' : 'text-[var(--muted)]',
                  )}
                >
                  {rowStatus(row, now)}
                </p>
              </div>
              {rowActions ? (
                <div className="shrink-0">{rowActions(row)}</div>
              ) : null}
            </div>

            <div
              role="img"
              aria-label={`${row.product.name}: ${
                row.periods.map(describePeriod).join('; ') || 'no periods'
              }`}
              className="relative h-7 overflow-hidden rounded-md bg-[var(--surface)]"
            >
              {marks.map((tick) => (
                <span
                  key={tick.at}
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-[var(--line)]"
                  style={{ left: `${percent(tick.at, range)}%` }}
                />
              ))}

              {row.periods.map((period) => {
                const left = percent(Date.parse(period.startsAt), range)
                const right = period.endsAt
                  ? percent(Date.parse(period.endsAt), range)
                  : 100
                const isPast =
                  period.endsAt !== null && Date.parse(period.endsAt) <= now
                return (
                  <span
                    key={period.periodId}
                    title={`${row.product.name}: ${describePeriod(period)}`}
                    className={cn(
                      'absolute inset-y-1 rounded-[4px]',
                      isPast && 'opacity-35',
                      // An open end fades out instead of stopping at a date.
                      !period.endsAt &&
                        '[mask-image:linear-gradient(to_right,black_75%,transparent)]',
                    )}
                    style={{
                      left: `${left}%`,
                      width: `max(${right - left}%, 4px)`,
                      backgroundColor: row.product.color,
                    }}
                  />
                )
              })}

              <span
                aria-hidden
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--ink)]"
                style={{ left: `${nowAt}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
        <div className="hidden sm:block" />
        <div className="relative h-4 text-[10px] font-medium text-[var(--ink)]">
          <span
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${nowAt}%` }}
          >
            Today
          </span>
        </div>
      </div>
    </div>
  )
}
