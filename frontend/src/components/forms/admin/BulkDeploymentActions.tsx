import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  CircleArrowUp,
  Eraser,
  LoaderCircle,
  Power,
  Rocket,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { apiFetch } from '#/lib/api'
import {
  BULK_ACTION_LABELS,
  MAX_BULK_TARGETS,
  RUN_ACTION_LABELS,
} from '#/lib/deployment'
import type { BulkAction, DeploymentBulk } from '#/lib/deployment'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

const BULK_ICONS: Record<BulkAction, LucideIcon> = {
  turnOn: Rocket,
  turnOff: Power,
  erase: Eraser,
  update: CircleArrowUp,
}

/** What each bulk action does and leaves alone, for the confirmation. */
const BULK_RULES: Record<BulkAction, string> = {
  turnOn:
    'Each one is deployed with its own checks. Ones already on, busy, or without an active subscription are left alone.',
  turnOff:
    'Each one is stopped and its address taken offline. Data is kept. Ones already off or busy are left alone.',
  erase:
    'Each one that is off has its data erased for good, and its service removed from Dokploy, Cloudflare and Uptime Kuma. Ones still on are left alone: turn them off first. Every one is checked on its own; this cannot be undone.',
  update:
    'Each running one whose product, variables or overrides changed since it was last deployed is redeployed with the current compose file and environment. Data is kept, but a new image may migrate it for good: try one first. Ones up to date, off, busy or without an active subscription are left alone.',
}

/** The word typed to confirm erasing many at once. */
const ERASE_WORD = 'erase'

/** One deployment that can be selected. */
export type BulkTarget = { key: string; userId: string; productId: string }

/** A deployment's selection key, the same on every admin page. */
export function bulkKey(userId: string, productId: string): string {
  return `${userId}:${productId}`
}

/**
 * Selecting deployments and turning them on, off or erasing them at once.
 * `shown` are the deployments on screen, which "select all" takes; the
 * selection is the caller's, so each card can show its own checkbox.
 */
export default function BulkDeploymentActions({
  shown,
  selected,
  onSelectedChange,
  onDone,
}: {
  shown: BulkTarget[]
  selected: ReadonlySet<string>
  onSelectedChange: (next: Set<string>) => void
  /** Called after an action ran, to reload. */
  onDone: () => Promise<void> | void
}) {
  const [confirm, setConfirm] = useState<BulkAction | null>(null)
  const [eraseWord, setEraseWord] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DeploymentBulk | null>(null)

  const chosen = shown.filter((target) => selected.has(target.key))
  const allShown = shown.length > 0 && chosen.length === shown.length
  const tooMany = chosen.length > MAX_BULK_TARGETS

  async function run(action: BulkAction) {
    setConfirm(null)
    setRunning(true)
    try {
      const response = await apiFetch<DeploymentBulk>(
        '/admin/deployments/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            action,
            targets: chosen.map(({ userId, productId }) => ({
              userId,
              productId,
            })),
          }),
        },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to run the bulk action')
        return
      }
      const bulk = response.data
      setResult(bulk)
      onSelectedChange(new Set())
      const summary = `${bulk.started} started, ${bulk.skipped} left alone`
      if (bulk.refused > 0) toast.error(`${summary}, ${bulk.refused} refused`)
      else toast.success(summary)
      await onDone()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      {result ? (
        <BulkResult bulk={result} onClose={() => setResult(null)} />
      ) : null}

      {shown.length > 0 ? (
        <div
          className={cn(
            cardClassName,
            'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5',
          )}
        >
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              className="bg-white"
              checked={
                allShown ? true : chosen.length > 0 ? 'indeterminate' : false
              }
              aria-label="Select every deployment shown"
              onCheckedChange={(checked) => {
                const next = new Set(selected)
                for (const { key } of shown) {
                  if (checked === true) next.add(key)
                  else next.delete(key)
                }
                onSelectedChange(next)
              }}
            />
            {chosen.length > 0 ? (
              <span className="tabular-nums">{chosen.length} selected</span>
            ) : (
              <span className={hintClassName}>Select all shown</span>
            )}
          </label>
          {chosen.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {tooMany ? (
                <span className="text-xs text-[var(--destructive)]">
                  At most {MAX_BULK_TARGETS} at once
                </span>
              ) : null}
              {(Object.keys(BULK_ACTION_LABELS) as BulkAction[]).map(
                (action) => {
                  const Icon = BULK_ICONS[action]
                  return (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={running || tooMany}
                      className={
                        action === 'erase'
                          ? 'text-[var(--destructive)]'
                          : undefined
                      }
                      onClick={() => {
                        setEraseWord('')
                        setConfirm(action)
                      }}
                    >
                      {running ? (
                        <LoaderCircle className="animate-spin" aria-hidden />
                      ) : (
                        <Icon aria-hidden />
                      )}
                      {BULK_ACTION_LABELS[action]}
                    </Button>
                  )
                },
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={running}
                onClick={() => onSelectedChange(new Set())}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <DialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                confirm &&
                (confirm !== 'erase' || eraseWord.trim() === ERASE_WORD)
              ) {
                void run(confirm)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {confirm ? BULK_ACTION_LABELS[confirm] : ''} {chosen.length}{' '}
                deployment{chosen.length === 1 ? '' : 's'}?
              </DialogTitle>
              <DialogDescription>
                {confirm ? BULK_RULES[confirm] : ''}
              </DialogDescription>
            </DialogHeader>
            {confirm === 'erase' ? (
              <div className="space-y-1.5">
                <Label htmlFor="bulk-erase">
                  Type <span className="font-medium">{ERASE_WORD}</span> to
                  confirm
                </Label>
                <Input
                  id="bulk-erase"
                  value={eraseWord}
                  autoComplete="off"
                  spellCheck={false}
                  className="bg-white"
                  onChange={(event) => setEraseWord(event.target.value)}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={confirm === 'erase' ? 'destructive' : 'default'}
                disabled={
                  confirm === 'erase' && eraseWord.trim() !== ERASE_WORD
                }
              >
                {confirm ? BULK_ACTION_LABELS[confirm] : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** What the last bulk action did, one line per deployment. */
function BulkResult({
  bulk,
  onClose,
}: {
  bulk: DeploymentBulk
  onClose: () => void
}) {
  const totals = [
    `${bulk.started} started`,
    `${bulk.skipped} left alone`,
    ...(bulk.refused > 0 ? [`${bulk.refused} refused`] : []),
  ]
  return (
    <section
      className={`${cardClassName} px-4 py-3 sm:px-5`}
      aria-label="Bulk action result"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ink)]">
            Bulk action done
          </p>
          <p className={`text-xs tabular-nums ${hintClassName}`}>
            {totals.join(' · ')}. Started runs go on in the background.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss bulk action result"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>
      <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3 text-sm">
        {bulk.items.map((item) => (
          <li key={`${item.user.id}-${item.product.id}`} className="min-w-0">
            <p className="truncate text-[var(--ink)]">
              {item.product.name ?? item.product.id}
              <span className="text-[var(--muted)]">
                {' '}
                · {item.user.email ?? item.user.id}
              </span>
            </p>
            <p
              className={cn(
                'text-xs break-words',
                item.outcome === 'refused'
                  ? 'text-[var(--destructive)]'
                  : item.outcome === 'started'
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--muted)]',
              )}
            >
              {item.outcome === 'started'
                ? `Started: ${item.run ? RUN_ACTION_LABELS[item.run] : ''}`
                : `${item.outcome === 'refused' ? 'Refused' : 'Left alone'}: ${item.message ?? ''}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
