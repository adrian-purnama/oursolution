import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  ArrowDownUp,
  Eraser,
  LoaderCircle,
  Power,
  RefreshCw,
  Rocket,
  Search,
  Server,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  BeatBar,
  StateBadge,
  overallCheckState,
} from '#/components/forms/deployment/ServiceStatus'
import ProductImage from '#/components/forms/product/ProductImage'
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
  BUSY_STATES,
  CHECK_STATE_LABELS,
  MAX_BULK_TARGETS,
  RUN_ACTION_LABELS,
  STATE_LABELS,
  formatSince,
  formatUptime,
  runTitle,
  subscriptionLine,
} from '#/lib/deployment'
import type {
  AdminDeploymentRow,
  BulkAction,
  Deployment,
  DeploymentBulk,
  DeploymentSync,
  DeploymentSyncItem,
  ServiceCheckState,
} from '#/lib/deployment'
import { formatDateTime } from '#/lib/product'
import { cardClassName, hintClassName, inputClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** Refreshed this often, so uptime and checks stay current. */
const REFRESH_MS = 60_000

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'off', label: 'Off' },
  { key: 'lapsed', label: 'Not subscribed' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

const CHECK_TEXT: Record<ServiceCheckState, string> = {
  up: 'text-[var(--accent)]',
  down: 'text-[var(--destructive)]',
  pending: 'text-amber-700',
  maintenance: 'text-sky-700',
}

const BULK_ICONS: Record<BulkAction, LucideIcon> = {
  turnOn: Rocket,
  turnOff: Power,
  erase: Eraser,
}

/** What each bulk action does and leaves alone, for the confirmation. */
const BULK_RULES: Record<BulkAction, string> = {
  turnOn:
    'Each one is deployed with its own checks. Ones already on, busy, or without an active subscription are left alone.',
  turnOff:
    'Each one is stopped and its address taken offline. Data is kept. Ones already off or busy are left alone.',
  erase:
    'Each one that is off has its data erased for good, and its service removed from Dokploy, Cloudflare and Uptime Kuma. Ones still on are left alone: turn them off first. Every one is checked on its own; this cannot be undone.',
}

/** The word typed to confirm erasing many at once. */
const ERASE_WORD = 'erase'

function rowKey(row: AdminDeploymentRow): string {
  return `${row.user.id}:${row.deployment.product.id}`
}

/** Down checks or a failed state: something an admin should look at. */
function needsAttention(deployment: Deployment): boolean {
  return (
    deployment.state === 'failed' ||
    deployment.status.some((item) => item.state === 'down')
  )
}

function matches(row: AdminDeploymentRow, filter: FilterKey): boolean {
  const { deployment } = row
  switch (filter) {
    case 'all':
      return true
    case 'running':
      return deployment.state === 'running'
    case 'attention':
      return needsAttention(deployment)
    case 'off':
      return (
        deployment.state === 'stopped' || deployment.state === 'notDeployed'
      )
    case 'lapsed':
      return !deployment.entitled
  }
}

/** The most recent check that came back up, across all hosts. */
function lastUpAt(deployment: Deployment): string | null {
  let latest: string | null = null
  for (const status of deployment.status) {
    for (const beat of status.beats) {
      if (beat.state === 'up' && (!latest || beat.at > latest)) latest = beat.at
    }
  }
  return latest
}

/** Every user's deployments, with their live status, one per line. */
export default function DeploymentsAdminForm() {
  const [rows, setRows] = useState<AdminDeploymentRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  const load = useCallback(async (quiet: boolean) => {
    if (quiet) setRefreshing(true)
    try {
      const response =
        await apiFetch<AdminDeploymentRow[]>('/admin/deployments')
      if (!response.success || !response.data) {
        if (!quiet) setFailed(true)
        toast.error(response.message || 'Failed to load deployments')
        return
      }
      setFailed(false)
      setRows(response.data)
    } catch {
      if (!quiet) setFailed(true)
      toast.error('Unable to reach the server')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const [syncing, setSyncing] = useState(false)
  const [sync, setSync] = useState<DeploymentSync | null>(null)

  /** Checks every deployment against Dokploy and Cloudflare, then reloads. */
  async function handleSync() {
    setSyncing(true)
    try {
      const response = await apiFetch<DeploymentSync>(
        '/admin/deployments/sync',
        { method: 'POST' },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to sync deployments')
        return
      }
      const result = response.data
      setSync(result)
      const summary = `${result.checked} checked, ${result.changed} changed`
      if (result.failed > 0) {
        toast.error(`${summary}, ${result.failed} failed`)
      } else {
        toast.success(`Synced: ${summary}`)
      }
      await load(true)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSyncing(false)
    }
  }

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState<BulkAction | null>(null)
  const [eraseWord, setEraseWord] = useState('')
  const [bulking, setBulking] = useState(false)
  const [bulk, setBulk] = useState<DeploymentBulk | null>(null)

  function toggle(key: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  /** Runs one action on every selected deployment, then reloads. */
  async function handleBulk(action: BulkAction) {
    const targets = (rows ?? [])
      .filter((row) => selected.has(rowKey(row)))
      .map((row) => ({
        userId: row.user.id,
        productId: row.deployment.product.id,
      }))
    setConfirmBulk(null)
    setBulking(true)
    try {
      const response = await apiFetch<DeploymentBulk>(
        '/admin/deployments/bulk',
        { method: 'POST', body: JSON.stringify({ action, targets }) },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to run the bulk action')
        return
      }
      const result = response.data
      setBulk(result)
      setSelected(new Set())
      const summary = `${result.started} started, ${result.skipped} left alone`
      if (result.refused > 0) {
        toast.error(`${summary}, ${result.refused} refused`)
      } else {
        toast.success(summary)
      }
      await load(true)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setBulking(false)
    }
  }

  useEffect(() => {
    void load(false)
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const counts = useMemo(() => {
    const result = {} as Record<FilterKey, number>
    for (const { key } of FILTERS) {
      result[key] = (rows ?? []).filter((row) => matches(row, key)).length
    }
    return result
  }, [rows])

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      if (!matches(row, filter)) return false
      if (!needle) return true
      return [
        row.user.email,
        row.deployment.product.name,
        ...row.deployment.hosts,
        row.deployment.internal?.username ?? '',
      ].some((text) => text.toLowerCase().includes(needle))
    })
  }, [rows, filter, query])

  const shownKeys = shown.map(rowKey)
  const allShown =
    shownKeys.length > 0 && shownKeys.every((key) => selected.has(key))
  const someShown = shownKeys.some((key) => selected.has(key))
  const tooMany = selected.size > MAX_BULK_TARGETS

  if (failed) {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>
          Deployments could not be loaded.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(false)}
        >
          Retry
        </Button>
      </div>
    )
  }
  if (!rows) {
    return (
      <p className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading deployments…
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email, product or address…"
            className={cn(inputClassName, 'pl-10')}
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
          Refresh
        </Button>
        <Button
          type="button"
          disabled={syncing}
          onClick={() => void handleSync()}
          title="Check every deployment's containers and addresses in Dokploy and Cloudflare"
        >
          {syncing ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <ArrowDownUp aria-hidden />
          )}
          {syncing ? 'Syncing…' : 'Sync'}
        </Button>
      </div>

      {sync ? <SyncResult sync={sync} onClose={() => setSync(null)} /> : null}
      {bulk ? <BulkResult bulk={bulk} onClose={() => setBulk(null)} /> : null}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              filter === key
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]/40',
            )}
          >
            {label}
            <span className="ml-1.5 tabular-nums opacity-60">
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <div
          className={cn(
            cardClassName,
            'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-5',
          )}
        >
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allShown ? true : someShown ? 'indeterminate' : false}
              aria-label="Select every deployment shown"
              onCheckedChange={(checked) =>
                setSelected((current) => {
                  const next = new Set(current)
                  for (const key of shownKeys) {
                    if (checked === true) next.add(key)
                    else next.delete(key)
                  }
                  return next
                })
              }
            />
            {selected.size > 0 ? (
              <span className="tabular-nums">{selected.size} selected</span>
            ) : (
              <span className={hintClassName}>Select all shown</span>
            )}
          </label>
          {selected.size > 0 ? (
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
                      disabled={bulking || tooMany}
                      className={
                        action === 'erase'
                          ? 'text-[var(--destructive)]'
                          : undefined
                      }
                      onClick={() => {
                        setEraseWord('')
                        setConfirmBulk(action)
                      }}
                    >
                      {bulking ? (
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
                disabled={bulking}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-12 text-center">
          <Server
            className="mx-auto mb-3 size-6 text-[var(--muted)]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--ink)]">
            {rows.length === 0
              ? 'Nothing deployed yet'
              : 'No deployment matches'}
          </p>
          <p className={`mt-1 ${hintClassName}`}>
            {rows.length === 0
              ? 'Deployments show here once a customer deploys a subscription.'
              : 'Try another filter or search.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => (
            <DeploymentRow
              key={rowKey(row)}
              row={row}
              selected={selected.has(rowKey(row))}
              onSelect={(on) => toggle(rowKey(row), on)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={confirmBulk !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmBulk(null)
        }}
      >
        <DialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                confirmBulk &&
                (confirmBulk !== 'erase' || eraseWord.trim() === ERASE_WORD)
              ) {
                void handleBulk(confirmBulk)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {confirmBulk ? BULK_ACTION_LABELS[confirmBulk] : ''}{' '}
                {selected.size} deployment{selected.size === 1 ? '' : 's'}?
              </DialogTitle>
              <DialogDescription>
                {confirmBulk ? BULK_RULES[confirmBulk] : ''}
              </DialogDescription>
            </DialogHeader>
            {confirmBulk === 'erase' ? (
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
                onClick={() => setConfirmBulk(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={confirmBulk === 'erase' ? 'destructive' : 'default'}
                disabled={
                  confirmBulk === 'erase' && eraseWord.trim() !== ERASE_WORD
                }
              >
                {confirmBulk ? BULK_ACTION_LABELS[confirmBulk] : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** What the last bulk action did: totals, then each one not started. */
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

/** What a sync says about one deployment, or nothing when all is as stored. */
function syncLines(item: DeploymentSyncItem): string[] {
  const lines: string[] = []
  if (item.outcome === 'failed') {
    lines.push(`Could not be checked: ${item.message ?? 'unknown error'}`)
  } else if (item.outcome === 'skipped') {
    lines.push(`Skipped: ${item.message ?? 'busy'}`)
  } else {
    if (item.from !== item.to) {
      lines.push(`${STATE_LABELS[item.from]} → ${STATE_LABELS[item.to]}`)
    }
    if (item.message) lines.push(item.message)
  }
  for (const domain of item.domains) {
    if (domain.issue) lines.push(`${domain.host}: ${domain.issue}`)
  }
  return lines
}

/** The outcome of the last sync: totals, then only what needs a look. */
function SyncResult({
  sync,
  onClose,
}: {
  sync: DeploymentSync
  onClose: () => void
}) {
  const notable = sync.items.flatMap((item) => {
    const lines = syncLines(item)
    return lines.length > 0 ? [{ item, lines }] : []
  })
  const totals = [
    `${sync.checked} checked`,
    `${sync.changed} changed`,
    ...(sync.skipped > 0 ? [`${sync.skipped} skipped`] : []),
    ...(sync.failed > 0 ? [`${sync.failed} failed`] : []),
    `${sync.domainIssues} address ${sync.domainIssues === 1 ? 'issue' : 'issues'}`,
  ]

  return (
    <section
      className={`${cardClassName} px-4 py-3 sm:px-5`}
      aria-label="Sync result"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ink)]">
            Synced with Dokploy
          </p>
          <p className={`text-xs tabular-nums ${hintClassName}`}>
            {totals.join(' · ')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss sync result"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>
      {sync.cloudflareError ? (
        <p className="mt-2 text-xs text-amber-800">
          Addresses were not checked in Cloudflare: {sync.cloudflareError}
        </p>
      ) : null}
      {notable.length === 0 ? (
        <p className={`mt-2 text-xs ${hintClassName}`}>
          Everything matches what is stored.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 border-t border-[var(--line)] pt-3 text-sm">
          {notable.map(({ item, lines }) => (
            <li key={`${item.user.id}-${item.product.id}`} className="min-w-0">
              <p className="truncate text-[var(--ink)]">
                {item.product.name}
                <span className="text-[var(--muted)]">
                  {' '}
                  · {item.user.email}
                </span>
              </p>
              {lines.map((line) => (
                <p
                  key={line}
                  className={cn(
                    'text-xs break-words',
                    item.outcome === 'failed'
                      ? 'text-[var(--destructive)]'
                      : 'text-[var(--muted)]',
                  )}
                >
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DeploymentRow({
  row,
  selected,
  onSelect,
}: {
  row: AdminDeploymentRow
  selected: boolean
  onSelect: (on: boolean) => void
}) {
  const { user, deployment } = row
  const live = deployment.state === 'running'
  const check = live ? overallCheckState(deployment.status) : null
  const uptimes = deployment.status.flatMap((item) =>
    item.uptime === null ? [] : [item.uptime],
  )
  const responses = deployment.status.flatMap((item) =>
    item.responseMs === null ? [] : [item.responseMs],
  )
  const upAt = lastUpAt(deployment)
  const latest = deployment.runs.at(0)
  const charted = deployment.status.find((item) => item.beats.length > 0)
  const busy = BUSY_STATES.includes(deployment.state)

  return (
    <li className="flex items-start gap-3">
      <Checkbox
        className="mt-5 bg-white"
        checked={selected}
        aria-label={`Select ${deployment.product.name} of ${user.email}`}
        onCheckedChange={(checked) => onSelect(checked === true)}
      />
      <Link
        to="/admin/users/$userId"
        params={{ userId: user.id }}
        search={{ tab: 'deployments' }}
        className={cn(
          cardClassName,
          'block min-w-0 flex-1 px-4 py-4 no-underline transition hover:border-[var(--ink)] sm:px-5',
          selected && 'border-[var(--ink)]',
        )}
      >
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <ProductImage
            product={deployment.product}
            className="size-10 shrink-0 rounded-lg border border-[var(--line)]"
            iconClassName="size-4"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[var(--ink)]">
                {deployment.product.name}
              </p>
              <StateBadge state={deployment.state} />
              {!deployment.entitled ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                  Not subscribed
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-[var(--ink)]/80">
              {user.email}
            </p>
            <p className={`text-xs ${hintClassName}`}>
              {subscriptionLine(deployment)}
              {deployment.hosts.length > 0
                ? ` · ${deployment.hosts.join(', ')}`
                : ''}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--line)] pt-3 text-sm sm:grid-cols-4">
          <Field label="Check">
            {check ? (
              <span className={CHECK_TEXT[check]}>
                {CHECK_STATE_LABELS[check]}
              </span>
            ) : (
              <span className="text-[var(--muted)]">
                {live ? 'Not monitored' : '—'}
              </span>
            )}
          </Field>
          <Field label="Uptime, 24 h">
            {uptimes.length > 0 ? formatUptime(Math.min(...uptimes)) : '—'}
          </Field>
          <Field label="Response">
            {responses.length > 0 ? `${Math.max(...responses)} ms` : '—'}
          </Field>
          <Field label="Last up">
            {upAt ? (
              <span title={formatDateTime(upAt)}>{formatSince(upAt)} ago</span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Running for">
            {deployment.runningSince
              ? formatSince(deployment.runningSince)
              : '—'}
          </Field>
          <Field label="Last activity" className="col-span-1 sm:col-span-3">
            {latest ? (
              <span>
                {runTitle(latest)}{' '}
                <span
                  className={
                    latest.status === 'failed'
                      ? 'text-[var(--destructive)]'
                      : 'text-[var(--muted)]'
                  }
                >
                  {latest.status === 'failed'
                    ? 'did not finish'
                    : latest.status === 'running' || busy
                      ? 'in progress'
                      : 'finished'}
                  {latest.automatic ? ', automatic' : ''} ·{' '}
                  {formatDateTime(latest.startedAt)}
                </span>
              </span>
            ) : (
              '—'
            )}
          </Field>
        </dl>

        {charted ? <BeatBar status={charted} className="mt-3" /> : null}
      </Link>
    </li>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 truncate tabular-nums">{children}</dd>
    </div>
  )
}
