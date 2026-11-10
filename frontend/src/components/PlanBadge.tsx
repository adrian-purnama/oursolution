import type { PlanSummary } from '#/lib/plan'
import { cn } from '#/lib/utils'

/** A plan's name with its color as a dot, so the text stays readable on any color. */
export default function PlanBadge({
  plan,
  className,
}: {
  plan: PlanSummary
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 text-xs font-medium text-[var(--ink)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: plan.color }}
      />
      {plan.name}
    </span>
  )
}
