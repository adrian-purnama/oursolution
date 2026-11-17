import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Link } from '@tanstack/react-router'
import {
  CalendarPlus,
  CalendarX,
  Check,
  Circle,
  Copy,
  Eraser,
  Trash2,
  ExternalLink,
  Globe,
  LoaderCircle,
  Power,
  RefreshCw,
  RotateCcw,
  Rocket,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ProductMark } from '#/components/ProductBadge'
import ProductNotices from '#/components/ProductNotices'
import {
  BeatBar,
  CHECK_COLOR,
  Stat,
  StateBadge,
  overallCheckState,
} from '#/components/forms/deployment/ServiceStatus'
import { Button } from '#/components/ui/button'
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
  BUSY_STATES,
  CHECK_STATE_LABELS,
  RUN_ACTION_HINTS,
  RUN_ACTION_LABELS,
  STATE_LABELS,
  actionLabel,
  expiryOf,
  formatSince,
  formatUptime,
  subscriptionLine,
} from '#/lib/deployment'
import type {
  Deployment,
  DeploymentRun,
  RunAction,
  RunStep,
} from '#/lib/deployment'
import { formatDateTime } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

const POLL_MS = 3000
/** While the service runs, its status is refreshed this often. */
const STATUS_POLL_MS = 60_000

const ACTION_ICONS: Record<RunAction, LucideIcon> = {
  deploy: Rocket,
  redeploy: RefreshCw,
  restart: RotateCcw,
  turnOff: Power,
  reset: Eraser,
  wipe: Trash2,
}

function StepIcon({ status }: { status: RunStep['status'] }) {
  const base =
    'flex size-6 shrink-0 items-center justify-center rounded-full border'
  if (status === 'done') {
    return (
      <span
        className={`${base} border-[var(--accent)] bg-[var(--accent)] text-white`}
      >
        <Check className="size-3.5" aria-label="Done" />
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span
        className={`${base} border-[var(--destructive)] bg-[var(--destructive)] text-white`}
      >
        <X className="size-3.5" aria-label="Failed" />
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className={`${base} border-[var(--ink)] bg-white`}>
        <LoaderCircle className="size-3.5 animate-spin" aria-label="Working" />
      </span>
    )
  }
  return (
    <span className={`${base} border-[var(--line)] bg-white`}>
      <Circle
        className="size-2 fill-[var(--line)] text-[var(--line)]"
        aria-label="Waiting"
      />
    </span>
  )
}

/** The steps of a run, top to bottom, joined by a line. */
function Stepper({ run, admin }: { run: DeploymentRun; admin: boolean }) {
  return (
    <ol className="space-y-0">
      {run.steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
          {index < run.steps.length - 1 ? (
            <span
              aria-hidden
              className={cn(
                'absolute top-6 bottom-0 left-3 w-px -translate-x-1/2',
                step.status === 'done'
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--line)]',
              )}
            />
          ) : null}
          <StepIcon status={step.status} />
          <div className="min-w-0 pt-0.5">
            <p
              className={cn(
                'text-sm',
                step.status === 'pending'
                  ? 'text-[var(--muted)]'
                  : 'font-medium',
              )}
            >
              {step.label}
            </p>
            {admin && step.internalLabel ? (
              <p className={`text-xs ${hintClassName}`}>{step.internalLabel}</p>
            ) : null}
            {step.status === 'failed' ? (
              <p className="mt-1 text-sm break-words text-[var(--destructive)]">
                {admin && step.error
                  ? step.error
                  : 'Something went wrong here. Our team has been notified and will look into it.'}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * One deployment: where it stands, its addresses, the customer's settings,
 * the buttons, and the steps of the latest run, refreshed while it runs.
 * Customers see friendly step names; admins also see what failed and why.
 */
export default function DeploymentPanel({
  apiBase,
  productId,
  admin = false,
  initial,
  onChange,
}: {
  /** "/me/deployments", or "/admin/users/:id/deployments". */
  apiBase: string
  productId: string
  admin?: boolean
  initial?: Deployment
  onChange?: (deployment: Deployment) => void
}) {
  const [deployment, setDeployment] = useState<Deployment | null>(
    initial ?? null,
  )
  const [loading, setLoading] = useState(!initial)
  const [failed, setFailed] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState<RunAction | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  /** The erasing action waiting for the product name to be typed. */
  const [confirmErase, setConfirmErase] = useState<'reset' | 'wipe' | null>(
    null,
  )
  const [eraseName, setEraseName] = useState('')

  const url = `${apiBase}/${productId}`

  const accept = useCallback(
    (next: Deployment, keepEdits: boolean) => {
      setDeployment(next)
      onChange?.(next)
      if (!keepEdits) {
        setValues(
          Object.fromEntries(
            next.variables
              .filter((variable) => variable.editable)
              .map((variable) => [variable.key, variable.value]),
          ),
        )
        setDirty(false)
      }
    },
    [onChange],
  )

  const load = useCallback(
    async (quiet: boolean, keepEdits: boolean) => {
      if (!quiet) setLoading(true)
      try {
        const response = await apiFetch<Deployment>(url)
        if (!response.success || !response.data) {
          if (!quiet) {
            setFailed(true)
            toast.error(response.message || 'Failed to load')
          }
          return
        }
        setFailed(false)
        accept(response.data, keepEdits)
      } catch {
        if (!quiet) {
          setFailed(true)
          toast.error('Unable to reach the server')
        }
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [url, accept],
  )

  useEffect(() => {
    if (initial) accept(initial, false)
    else void load(false, false)
    // Only on mount: `initial` is a starting point, not a live value.
  }, [url])

  const latest = deployment?.runs[0] ?? null
  const busy =
    deployment !== null &&
    (BUSY_STATES.includes(deployment.state) || latest?.status === 'running')

  // Follow a run until it finishes.
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => void load(true, true), POLL_MS)
    return () => window.clearInterval(timer)
  }, [busy, load])

  // Keep the status fresh while the service runs.
  const running = deployment?.state === 'running' && !busy
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(
      () => void load(true, true),
      STATUS_POLL_MS,
    )
    return () => window.clearInterval(timer)
  }, [running, load])

  async function saveValues(): Promise<boolean> {
    setSaving(true)
    try {
      const response = await apiFetch<Deployment>(`${url}/values`, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to save')
        return false
      }
      accept(response.data, false)
      return true
    } catch {
      toast.error('Unable to reach the server')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (await saveValues()) {
      toast.success(
        deployment?.state === 'notDeployed'
          ? 'Saved'
          : 'Saved. Redeploy to apply the changes',
      )
    }
  }

  async function start(action: RunAction) {
    setConfirmOff(false)
    setConfirmErase(null)
    // A first deploy takes what was just typed.
    if (dirty && action === 'deploy' && !(await saveValues())) return
    setStarting(action)
    try {
      const response = await apiFetch<Deployment>(`${url}/actions`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Could not start')
        await load(true, true)
        return
      }
      accept(response.data, true)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setStarting(null)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }
  if (failed || !deployment) {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>This could not be loaded.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(false, false)}
        >
          Retry
        </Button>
      </div>
    )
  }

  const { state } = deployment
  const live = state === 'running'
  const editable = deployment.variables.filter((variable) => variable.editable)
  const shown = deployment.variables.filter(
    (variable) => admin || !variable.editable,
  )
  const primary: RunAction | null = deployment.actions.includes('deploy')
    ? 'deploy'
    : null
  const secondary = deployment.actions.filter(
    (action) => action !== primary && action !== 'wipe',
  )
  const wipe = admin ? deployment.internal?.wipe : undefined
  const locked = busy || starting !== null
  const expiry = expiryOf(deployment)
  /** Customers can renew from here; admins grant time elsewhere. */
  const extendable = !admin && expiry !== null

  const check = live ? overallCheckState(deployment.status) : null
  const uptimes = deployment.status.flatMap((item) =>
    item.uptime === null ? [] : [item.uptime],
  )
  const responses = deployment.status.flatMap((item) =>
    item.responseMs === null ? [] : [item.responseMs],
  )
  const charted = deployment.status.filter((item) => item.beats.length > 0)
  // A run that is going on or went wrong is shown in full; the rest is history.
  const featured = latest && latest.status !== 'succeeded' ? latest : null
  const history = featured ? deployment.runs.slice(1) : deployment.runs

  function ask(action: RunAction) {
    if (action === 'turnOff') setConfirmOff(true)
    else if (action === 'reset' || action === 'wipe') {
      setEraseName('')
      setConfirmErase(action)
    } else void start(action)
  }

  async function copy(host: string) {
    try {
      await navigator.clipboard.writeText(`https://${host}`)
      toast.success('Address copied')
    } catch {
      toast.error('Could not copy the address')
    }
  }

  return (
    <div className="space-y-6">
      <ProductNotices notices={deployment.notices}>
        <section className={`${cardClassName} overflow-hidden`}>
          <header className="flex flex-wrap items-start gap-4 p-5">
            <ProductMark
              product={deployment.product}
              className="size-12 rounded-lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-medium tracking-tight">
                  {deployment.product.name}
                </h2>
                <StateBadge state={state} />
              </div>
              <p
                className={cn(
                  'mt-0.5',
                  expiry?.kind === 'expired'
                    ? 'text-sm text-[var(--destructive)]'
                    : expiry?.kind === 'expiring'
                      ? 'text-sm text-amber-700'
                      : hintClassName,
                )}
              >
                {subscriptionLine(deployment)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {extendable && expiry.kind === 'expired' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="text-[var(--destructive)] disabled:opacity-100"
                >
                  <CalendarX aria-hidden />
                  Expired
                </Button>
              ) : null}
              {extendable ? (
                <Button
                  asChild
                  variant={expiry.kind === 'expired' ? 'default' : 'outline'}
                >
                  <Link
                    to="/checkout"
                    search={{ productId: deployment.product.id }}
                    className="no-underline"
                  >
                    <CalendarPlus aria-hidden />
                    Extend
                  </Link>
                </Button>
              ) : null}
              {primary ? (
                <Button
                  type="button"
                  disabled={locked}
                  onClick={() => void start(primary)}
                >
                  {starting === primary ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Rocket aria-hidden />
                  )}
                  {actionLabel(primary, state)}
                </Button>
              ) : null}
              {live && deployment.hosts[0] ? (
                <Button asChild>
                  <a
                    href={`https://${deployment.hosts[0]}`}
                    target="_blank"
                    rel="noreferrer"
                    className="no-underline"
                  >
                    Open
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
          </header>

          {deployment.hosts.length > 0 ? (
            <ul className="border-t border-[var(--line)] px-5 py-3">
              {deployment.hosts.map((host) => (
                <li key={host} className="flex items-center gap-1 text-sm">
                  <Globe
                    className="size-3.5 shrink-0 text-[var(--muted)]"
                    aria-hidden
                  />
                  {live ? (
                    <a
                      href={`https://${host}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 min-w-0 truncate text-[var(--ink)] underline-offset-4 hover:underline"
                    >
                      {host}
                    </a>
                  ) : (
                    <span className="ml-1 min-w-0 truncate text-[var(--muted)]">
                      {host}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Copy the address ${host}`}
                    onClick={() => void copy(host)}
                  >
                    <Copy aria-hidden />
                  </Button>
                  {!live ? (
                    <span className={`ml-auto text-xs ${hintClassName}`}>
                      Offline while the service is not running
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="grid grid-cols-2 gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
            <Stat label="Status">
              <span className="inline-flex items-center gap-2">
                {check ? (
                  <span
                    aria-hidden
                    className={cn('size-2 rounded-full', CHECK_COLOR[check])}
                  />
                ) : null}
                {check ? CHECK_STATE_LABELS[check] : STATE_LABELS[state]}
              </span>
            </Stat>
            <Stat label="Uptime, last 24 hours">
              {uptimes.length > 0 ? formatUptime(Math.min(...uptimes)) : '—'}
            </Stat>
            <Stat label="Response time">
              {responses.length > 0
                ? `${Math.round(
                    responses.reduce((sum, value) => sum + value, 0) /
                      responses.length,
                  )} ms`
                : '—'}
            </Stat>
            <Stat label="Running for">
              {deployment.runningSince
                ? formatSince(deployment.runningSince)
                : '—'}
            </Stat>
          </dl>

          {charted.map((status) => (
            <div
              key={status.host}
              className="space-y-2 border-t border-[var(--line)] px-5 py-4"
            >
              {charted.length > 1 ? (
                <p className="truncate text-sm">{status.host}</p>
              ) : null}
              <BeatBar status={status} />
              <div className="flex justify-between text-xs text-[var(--muted)]">
                <span>{formatSince(status.beats[0].at)} ago</span>
                <span>Checked every 5 minutes</span>
                <span>Now</span>
              </div>
            </div>
          ))}
        </section>
      </ProductNotices>

      {!deployment.entitled ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
          {admin
            ? 'This subscription is not active, so only turning off is possible.'
            : 'Your subscription has expired. Extend it to deploy or turn the service on again. Your data is kept.'}
        </p>
      ) : null}

      {featured ? (
        <section className={`${cardClassName} p-5`} aria-live="polite">
          <h3 className="mb-4 text-sm font-medium">
            {featured.status === 'running'
              ? `${RUN_ACTION_LABELS[featured.action]} in progress`
              : `${RUN_ACTION_LABELS[featured.action]} did not finish`}
            <span className={`ml-2 font-normal ${hintClassName}`}>
              {formatDateTime(featured.startedAt)}
              {featured.automatic ? ' · automatic' : ''}
            </span>
          </h3>
          <Stepper run={featured} admin={admin} />
          {featured.status === 'running' ? (
            <p className={`mt-4 text-xs ${hintClassName}`}>
              This page updates by itself. You can leave and come back.
            </p>
          ) : null}
        </section>
      ) : null}

      {editable.length > 0 || shown.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Settings</h3>
            <p className={`text-xs ${hintClassName}`}>
              {state === 'notDeployed'
                ? 'Fill these in before you deploy.'
                : 'Changes apply the next time you redeploy.'}
            </p>
          </div>

          <div className={`${cardClassName} overflow-hidden`}>
            {editable.length > 0 ? (
              <form
                className="space-y-4 p-5"
                onSubmit={(event) => void handleSave(event)}
              >
                {editable.map((variable) => (
                  <div key={variable.key} className="space-y-1.5">
                    <Label htmlFor={`value-${productId}-${variable.key}`}>
                      <span className="font-mono text-[13px]">
                        {variable.key}
                      </span>
                    </Label>
                    <Input
                      id={`value-${productId}-${variable.key}`}
                      value={values[variable.key] ?? ''}
                      spellCheck={false}
                      autoCapitalize="off"
                      className="bg-white font-mono text-[13px] md:text-[13px]"
                      onChange={(event) => {
                        setValues({
                          ...values,
                          [variable.key]: event.target.value,
                        })
                        setDirty(true)
                      }}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={!dirty || saving}
                  >
                    {saving ? 'Saving…' : 'Save settings'}
                  </Button>
                  {dirty ? (
                    <span className={`text-xs ${hintClassName}`}>
                      Not saved yet
                    </span>
                  ) : null}
                </div>
              </form>
            ) : null}

            {shown.length > 0 ? (
              <dl
                className={cn(
                  'divide-y divide-[var(--line)] text-sm',
                  editable.length > 0 && 'border-t border-[var(--line)]',
                )}
              >
                {shown.map((variable) => (
                  <div
                    key={variable.key}
                    className="grid gap-1 px-5 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="truncate font-mono text-[13px] text-[var(--muted)]">
                      {variable.key}
                      {admin && variable.visibility === 'hidden' ? (
                        <span className="ml-1.5 font-sans text-xs">
                          (hidden)
                        </span>
                      ) : null}
                    </dt>
                    <dd className="font-mono text-[13px] break-all">
                      {variable.value || (
                        <span className="text-[var(--muted)]">empty</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      ) : null}

      {secondary.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Manage</h3>
          <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
            {secondary.map((action) => {
              const Icon = ACTION_ICONS[action]
              const danger = action === 'reset'
              return (
                <li
                  key={action}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        danger && 'text-[var(--destructive)]',
                      )}
                    >
                      {actionLabel(action, state)}
                    </p>
                    <p className={`text-xs ${hintClassName}`}>
                      {RUN_ACTION_HINTS[action]}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    className={danger ? 'text-[var(--destructive)]' : undefined}
                    onClick={() => ask(action)}
                  >
                    {starting === action ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <Icon aria-hidden />
                    )}
                    {actionLabel(action, state)}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {wipe && deployment.internal ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Delete data</h3>
          <div
            className={`${cardClassName} flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4`}
          >
            <div className="min-w-0 flex-1 basis-64 space-y-1">
              <p className="text-sm">
                Erases this customer's folders. Needs the service off and the
                subscription ended.
              </p>
              {deployment.internal.resetFolders.length > 0 ? (
                <p className="font-mono text-xs break-all text-[var(--muted)]">
                  {deployment.internal.resetFolders.join(', ')}
                </p>
              ) : null}
              {wipe.reason ? (
                <p className="text-xs text-amber-700">{wipe.reason}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locked || !wipe.allowed}
              className="text-[var(--destructive)]"
              onClick={() => ask('wipe')}
            >
              {starting === 'wipe' ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              Delete data
            </Button>
          </div>
        </section>
      ) : null}

      {admin && deployment.internal ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Internal</h3>
          <dl
            className={`${cardClassName} grid gap-x-4 gap-y-1.5 p-5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]`}
          >
            <dt className={hintClassName}>Name in Dokploy</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.name ?? '—'}
              {deployment.internal.appName
                ? ` (app ${deployment.internal.appName})`
                : ''}
            </dd>
            <dt className={hintClassName}>Compose id</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.composeId ?? 'not created yet'}
            </dd>
            <dt className={hintClassName}>USERNAME</dt>
            <dd className="font-mono text-[13px]">
              {deployment.internal.username}
            </dd>
            <dt className={hintClassName}>Routed in Cloudflare</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.routedHosts.join(', ') || 'none'}
            </dd>
            <dt className={hintClassName}>Emptied by Reset</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.resetFolders.join(', ') ||
                'nothing, so Reset is not offered'}
            </dd>
            {deployment.internal.resetSkipped.length > 0 ? (
              <>
                <dt className={hintClassName}>Left alone by Reset</dt>
                <dd className="space-y-0.5 text-[13px]">
                  {deployment.internal.resetSkipped.map((item) => (
                    <p key={item.path} className="break-all">
                      <span className="font-mono">{item.path}</span>{' '}
                      <span className={hintClassName}>{item.reason}</span>
                    </p>
                  ))}
                </dd>
              </>
            ) : null}
            <dt className={hintClassName}>Uptime Kuma monitors</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.monitors
                .map((monitor) => `#${monitor.monitorId} ${monitor.host}`)
                .join(', ') || 'none'}
            </dd>
          </dl>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Activity</h3>
          <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
            {history.map((run) => (
              <li key={run.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      run.status === 'failed'
                        ? 'bg-[var(--destructive)]'
                        : run.status === 'running'
                          ? 'animate-pulse bg-amber-500'
                          : 'bg-[var(--accent)]',
                    )}
                  />
                  <span className="font-medium">
                    {RUN_ACTION_LABELS[run.action]}
                  </span>
                  <span
                    className={
                      run.status === 'failed'
                        ? 'text-[var(--destructive)]'
                        : 'text-[var(--muted)]'
                    }
                  >
                    {run.status === 'failed'
                      ? 'Did not finish'
                      : run.status === 'running'
                        ? 'In progress'
                        : 'Finished'}
                    {run.automatic ? ' · automatic' : ''}
                  </span>
                  <span className="ml-auto text-xs text-[var(--muted)]">
                    {formatDateTime(run.startedAt)}
                  </span>
                </div>
                {admin || run.status === 'failed' ? (
                  <details className="mt-2">
                    <summary
                      className={`cursor-pointer text-xs ${hintClassName}`}
                    >
                      Steps
                    </summary>
                    <div className="mt-3 pl-1">
                      <Stepper run={run} admin={admin} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={confirmErase !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmErase(null)
        }}
      >
        <DialogContent>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              if (
                confirmErase &&
                eraseName.trim() === deployment.product.name
              ) {
                void start(confirmErase)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {confirmErase === 'wipe'
                  ? `Delete ${deployment.product.name} data?`
                  : `Reset ${deployment.product.name}?`}
              </DialogTitle>
              <DialogDescription>
                {confirmErase === 'wipe'
                  ? `Everything ${deployment.internal?.username ?? 'this customer'} stored in this service is erased for good. The service stays off. This cannot be undone.`
                  : 'Everything stored in this service is erased for good, and it starts again as new. This cannot be undone.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`reset-${productId}`}>
                Type{' '}
                <span className="font-medium">{deployment.product.name}</span>{' '}
                to confirm
              </Label>
              <Input
                id={`reset-${productId}`}
                value={eraseName}
                autoComplete="off"
                spellCheck={false}
                className="bg-white"
                onChange={(event) => setEraseName(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmErase(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={eraseName.trim() !== deployment.product.name}
              >
                {confirmErase === 'wipe' ? 'Erase data' : 'Erase and reset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOff} onOpenChange={setConfirmOff}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off {deployment.product.name}?</DialogTitle>
            <DialogDescription>
              The service stops and its address goes offline. Your data is kept,
              and you can turn it back on later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOff(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void start('turnOff')}
            >
              Turn off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
