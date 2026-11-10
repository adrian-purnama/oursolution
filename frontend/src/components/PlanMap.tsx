import PlanBadge from '#/components/PlanBadge'
import { formatDateTime } from '#/lib/plan'
import type { PlanSegment, PlanSummary, UserPlanOverview } from '#/lib/plan'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

type Phase = 'past' | 'current' | 'upcoming'

type Block = {
  key: string
  plan: PlanSummary
  startsAt: string
  endsAt: string | null
  phase: Phase
  isFallback: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Past gaps were default-plan time, but the overview does not say which plan that was. */
const UNKNOWN_DEFAULT: PlanSummary = {
  id: 'default',
  name: 'Default plan',
  color: 'var(--line)',
}

/**
 * History and timeline as one gap-free run of blocks, oldest first.
 * Time between stored periods was the default plan, so it is filled in.
 */
function toBlocks(overview: UserPlanOverview): Block[] {
  const defaultPlan =
    overview.timeline.find((segment) => segment.isFallback)?.plan ??
    UNKNOWN_DEFAULT

  const ordered: { segment: PlanSegment; phase: Phase }[] = [
    ...[...overview.history].reverse().map((segment) => ({
      segment,
      phase: 'past' as const,
    })),
    ...overview.timeline.map((segment) => ({
      segment,
      phase: segment.isCurrent ? ('current' as const) : ('upcoming' as const),
    })),
  ]

  const blocks: Block[] = []
  for (const { segment, phase } of ordered) {
    const previous = blocks.at(-1)
    const gapStart = previous?.endsAt
    if (gapStart && gapStart < segment.startsAt) {
      if (segment.isFallback) {
        // The default stretch already covers the gap; start it earlier.
        blocks.push(blockFrom(segment, phase, gapStart))
        continue
      }
      blocks.push({
        key: `gap-${gapStart}`,
        plan: defaultPlan,
        startsAt: gapStart,
        endsAt: segment.startsAt,
        phase: segment.startsAt <= new Date().toISOString() ? 'past' : phase,
        isFallback: true,
      })
    }
    blocks.push(blockFrom(segment, phase, segment.startsAt))
  }
  return blocks
}

function blockFrom(
  segment: PlanSegment,
  phase: Phase,
  startsAt: string,
): Block {
  return {
    key: `${segment.periodId ?? 'default'}-${segment.startsAt}`,
    plan: segment.plan,
    startsAt,
    endsAt: segment.endsAt,
    phase,
    isFallback: segment.isFallback,
  }
}

/** Relative widths: real durations, with an open end drawn as a share of the rest. */
function weights(blocks: Block[]): number[] {
  const finite = blocks.map((block) =>
    block.endsAt
      ? Math.max(Date.parse(block.endsAt) - Date.parse(block.startsAt), 0)
      : null,
  )
  const span = finite.reduce<number>((sum, ms) => sum + (ms ?? 0), 0)
  const openWeight = Math.max(span * 0.25, 30 * DAY_MS)
  return finite.map((ms) => ms ?? openWeight)
}

function describeRange(block: Block): string {
  const end = block.endsAt ? formatDateTime(block.endsAt) : 'no end'
  return `${formatDateTime(block.startsAt)} – ${end}`
}

function phaseLabels(blocks: Block[]): string[] {
  let seenUpcoming = false
  return blocks.map((block) => {
    if (block.phase === 'past') return 'Past'
    if (block.phase === 'current') return 'Now'
    if (seenUpcoming) return 'Later'
    seenUpcoming = true
    return 'Next'
  })
}

/** A user's plan periods as a strip of blocks, plus what is running now and what comes next. */
export default function PlanMap({ overview }: { overview: UserPlanOverview }) {
  const blocks = toBlocks(overview)
  const blockWeights = weights(blocks)
  const labels = phaseLabels(blocks)
  const { current, timeline } = overview
  const next = timeline.find((segment) => !segment.isCurrent) ?? null

  return (
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className={`mb-1.5 text-xs ${hintClassName}`}>Current plan</dt>
          <dd className="flex flex-wrap items-center gap-2 text-sm">
            <PlanBadge plan={current.plan} />
            <span className="text-[var(--muted)]">
              {current.endsAt
                ? `until ${formatDateTime(current.endsAt)}`
                : 'no end date'}
            </span>
          </dd>
        </div>
        <div>
          <dt className={`mb-1.5 text-xs ${hintClassName}`}>Next plan</dt>
          <dd className="flex flex-wrap items-center gap-2 text-sm">
            {next ? (
              <>
                <PlanBadge plan={next.plan} />
                <span className="text-[var(--muted)]">
                  from {formatDateTime(next.startsAt)}
                </span>
              </>
            ) : (
              <span className="text-[var(--muted)]">Nothing scheduled</span>
            )}
          </dd>
        </div>
      </dl>

      <div aria-hidden className="flex h-7 w-full gap-0.5">
        {blocks.map((block, index) => (
          <div
            key={block.key}
            title={`${block.plan.name}: ${describeRange(block)}`}
            className={cn(
              'h-full min-w-3 rounded-[4px]',
              block.phase === 'past' && 'opacity-35',
              block.phase === 'current' &&
                'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-white',
              // An open end fades out instead of stopping at a date.
              !block.endsAt &&
                '[mask-image:linear-gradient(to_right,black_60%,transparent)]',
            )}
            style={{
              flex: `${blockWeights[index]} 1 0`,
              backgroundColor: block.plan.color,
            }}
          />
        ))}
      </div>

      <ol className="space-y-2">
        {blocks.map((block, index) => (
          <li
            key={block.key}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
              block.phase === 'past' && 'opacity-60',
            )}
          >
            <span
              className={cn(
                'w-10 shrink-0 text-xs font-medium',
                block.phase === 'current'
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--muted)]',
              )}
            >
              {labels[index]}
            </span>
            <PlanBadge plan={block.plan} />
            <span className="text-[var(--muted)]">
              {describeRange(block)}
              {block.isFallback ? ' · default' : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
