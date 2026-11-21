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
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Rocket,
  SquareTerminal,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ProductMark } from '#/components/ProductBadge'
import ProductNotices from '#/components/ProductNotices'
import PanelTour, {
  EXAMPLE_NOTICE,
  ExamplePowerControls,
  ExampleSettings,
} from '#/components/forms/tour/PanelTour'
import {
  BeatBar,
  CHECK_COLOR,
  Stat,
  StateBadge,
  overallCheckState,
} from '#/components/forms/deployment/ServiceStatus'
import DeploymentOverridesForm from '#/components/forms/admin/DeploymentOverridesForm'
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
  STATE_LABELS,
  actionLabel,
  expiryOf,
  formatSince,
  formatUptime,
  runTitle,
  subscriptionLine,
  updateLabel,
} from '#/lib/deployment'
import type {
  Deployment,
  DeploymentCommand,
  DeploymentRun,
  RunAction,
  RunStep,
} from '#/lib/deployment'
import { formatDateTime } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { useTourStage } from '#/lib/tours'
import { cn } from '#/lib/utils'

const POLL_MS = 3000
/** While the service runs, its status is refreshed this often. */
const STATUS_POLL_MS = 60_000

const ACTION_ICONS: Record<RunAction, LucideIcon> = {
  deploy: Rocket,
  redeploy: RefreshCw,
  restart: RotateCcw,
  turnOff: Power,
  erase: Eraser,
  wipe: Trash2,
  command: SquareTerminal,
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
  const [confirmErase, setConfirmErase] = useState<'erase' | 'wipe' | null>(
    null,
  )
  const [eraseName, setEraseName] = useState('')
  /** The command waiting to be confirmed. */
  const [confirmCommand, setConfirmCommand] =
    useState<DeploymentCommand | null>(null)
  /** The command being started, until the server answers. */
  const [startingCommand, setStartingCommand] = useState<string | null>(null)
  /** Set after trying to start with required settings empty. */
  const [showMissing, setShowMissing] = useState(false)
  const [tourStage, setTourStage] = useTourStage('firstService')

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

  async function runCommand(command: DeploymentCommand) {
    setConfirmCommand(null)
    setStartingCommand(command.id)
    try {
      const response = await apiFetch<Deployment>(
        `${url}/commands/${encodeURIComponent(command.id)}`,
        { method: 'POST' },
      )
      if (!response.success || !response.data) {
        toast.error(response.message || 'Could not run it')
        await load(true, true)
        return
      }
      accept(response.data, true)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setStartingCommand(null)
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
  /** Set-once values still empty, counting what was typed but not saved. */
  const unfilled = deployment.missingValues.filter(
    (key) => !(values[key] ?? '').trim(),
  )
  /** Turning on waits for them; a redeploy for the saved ones. */
  const blockedBy = (action: RunAction) =>
    action === 'deploy'
      ? unfilled
      : action === 'redeploy'
        ? deployment.missingValues
        : []
  const secondary = deployment.actions.filter(
    (action) => action !== primary && action !== 'wipe',
  )
  const wipe = admin ? deployment.internal?.wipe : undefined
  const locked = busy || starting !== null || startingCommand !== null
  const expiry = expiryOf(deployment)
  /** The first-service tour's control panel part, for the customer. */
  const touring = !admin && tourStage === 'panel'
  /** Customers can renew from here; admins grant time elsewhere. */
  const extendable = !admin && expiry !== null
  /** The variant it is on, when it is not just named after the product. */
  const current = deployment.variant.current
  const variantName =
    current && current.name !== deployment.product.name ? current.name : null

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

  const fieldId = (key: string) => `value-${productId}-${key}`

  function focusSetting(key: string) {
    const element = document.getElementById(fieldId(key))
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element?.focus({ preventScroll: true })
  }

  /** Starts the action, or points at the settings it still waits for. */
  function attempt(action: RunAction, run: () => void) {
    const missing = blockedBy(action)
    if (missing.length === 0) {
      run()
      return
    }
    setShowMissing(true)
    const typed = missing.filter((key) => (values[key] ?? '').trim())
    toast.error(
      typed.length === missing.length
        ? `Save ${missing.join(', ')} first`
        : `Fill in ${missing.join(', ')} first`,
    )
    focusSetting(missing.find((key) => !typed.includes(key)) ?? missing[0])
  }

  function ask(action: RunAction) {
    if (action === 'turnOff') setConfirmOff(true)
    else if (action === 'erase' || action === 'wipe') {
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
      {touring ? <PanelTour onEnd={() => setTourStage('done')} /> : null}
      <ProductNotices
        notices={
          touring && deployment.notices.length === 0
            ? [EXAMPLE_NOTICE]
            : deployment.notices
        }
        tabTour="notices"
      >
        <section className={`${cardClassName} overflow-hidden`}>
          <header className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <ProductMark
                product={deployment.product}
                className="size-10 shrink-0 rounded-lg sm:size-12"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="text-lg leading-snug font-medium tracking-tight break-words sm:text-xl">
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
                  {variantName ? ` · ${variantName}` : ''}
                </p>
              </div>
            </div>
            <div
              className="flex flex-wrap gap-2 *:flex-1 sm:shrink-0 sm:*:flex-none"
              data-tour="actions"
            >
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
                  data-tour="turn-on"
                  onClick={() => attempt(primary, () => void start(primary))}
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

          <VariantNotice
            deployment={deployment}
            admin={admin}
            locked={locked}
            starting={starting === 'redeploy'}
            onApply={() => attempt('redeploy', () => void start('redeploy'))}
          />

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

          <dl
            data-tour="uptime"
            className="grid grid-cols-2 gap-px border-t border-[var(--line)] bg-[var(--line)] sm:grid-cols-4"
          >
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
              ? `${runTitle(featured)} in progress`
              : `${runTitle(featured)} did not finish`}
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
        <section className="space-y-3" data-tour="settings">
          <div>
            <h3 className="text-sm font-medium">Settings</h3>
            <p className={`text-xs ${hintClassName}`}>
              {state === 'notDeployed'
                ? 'Fill these in before you deploy.'
                : 'Changes apply the next time you redeploy.'}
            </p>
          </div>

          {unfilled.length > 0 && !admin ? (
            <div
              role={showMissing ? 'alert' : undefined}
              className={cn(
                'flex gap-3 rounded-md border px-4 py-3 text-sm',
                showMissing
                  ? 'border-[var(--destructive)]/40 bg-[var(--destructive)]/5'
                  : 'border-amber-300 bg-amber-50',
              )}
            >
              <TriangleAlert
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  showMissing ? 'text-[var(--destructive)]' : 'text-amber-600',
                )}
                aria-hidden
              />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {unfilled.length === 1
                    ? '1 setting is needed before you can turn it on'
                    : `${unfilled.length} settings are needed before you can turn it on`}
                </p>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  {unfilled.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] ring-1 ring-[var(--line)] hover:ring-[var(--ink)]"
                      onClick={() => focusSetting(key)}
                    >
                      {key}
                    </button>
                  ))}
                </p>
                <p className={`text-xs ${hintClassName}`}>
                  Marked with{' '}
                  <span className="text-[var(--destructive)]">*</span> below.
                  Once saved, {unfilled.length === 1 ? 'it' : 'they'} cannot be
                  changed.
                </p>
              </div>
            </div>
          ) : null}

          <div className={`${cardClassName} overflow-hidden`}>
            {editable.length > 0 ? (
              <form onSubmit={(event) => void handleSave(event)}>
                <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
                  {editable.map((variable) => (
                    <div key={variable.key} className="min-w-0 space-y-1.5">
                      <Label
                        htmlFor={fieldId(variable.key)}
                        className="min-w-0 flex-wrap gap-x-2 gap-y-0.5"
                      >
                        <span className="min-w-0 truncate font-mono text-[13px]">
                          {variable.key}
                          {variable.setOnce ? (
                            <>
                              <span
                                aria-hidden
                                className="ml-0.5 font-sans text-[var(--destructive)]"
                              >
                                *
                              </span>
                              <span className="sr-only"> (required)</span>
                            </>
                          ) : null}
                        </span>
                        {variable.setOnce && admin ? (
                          <span
                            className={`text-xs font-normal ${hintClassName}`}
                          >
                            {variable.secret
                              ? 'set once by the customer, then hidden'
                              : 'set once by the customer'}
                          </span>
                        ) : null}
                      </Label>
                      <Input
                        id={fieldId(variable.key)}
                        value={values[variable.key] ?? ''}
                        placeholder={variable.placeholder ?? undefined}
                        aria-required={variable.setOnce || undefined}
                        aria-invalid={
                          (showMissing && unfilled.includes(variable.key)) ||
                          undefined
                        }
                        autoComplete="off"
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
                      {showMissing && unfilled.includes(variable.key) ? (
                        <p className="text-xs text-[var(--destructive)]">
                          Fill this in to turn it on.{' '}
                          {variable.secret
                            ? 'It can be set only once and is hidden after saving.'
                            : 'It can be set only once.'}
                        </p>
                      ) : variable.setOnce && !admin ? (
                        <p className={`text-xs ${hintClassName}`}>
                          {variable.secret
                            ? 'It can be set only once and is hidden after saving, so keep a copy.'
                            : 'It can be set only once.'}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3">
                  {editable.some((variable) => variable.setOnce) && !admin ? (
                    <span className={`mr-auto text-xs ${hintClassName}`}>
                      <span aria-hidden className="text-[var(--destructive)]">
                        *
                      </span>{' '}
                      Required
                    </span>
                  ) : null}
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
                      {variable.secret && variable.filled && !admin ? (
                        <span className="font-sans text-[var(--muted)]">
                          Set · hidden
                        </span>
                      ) : (
                        variable.value || (
                          <span className="text-[var(--muted)]">empty</span>
                        )
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      ) : null}

      {touring && editable.length === 0 && shown.length === 0 ? (
        <ExampleSettings />
      ) : null}

      {touring && secondary.length === 0 ? <ExamplePowerControls /> : null}

      {secondary.length > 0 ? (
        <section className="space-y-3" data-tour="power">
          <h3 className="text-sm font-medium">Manage</h3>
          <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
            {secondary.map((action) => {
              const Icon = ACTION_ICONS[action]
              const danger = action === 'erase'
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
                    onClick={() => attempt(action, () => ask(action))}
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

      {deployment.commands.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Commands</h3>
            {deployment.commandsBlocked ? (
              <p className={`text-xs ${hintClassName}`}>
                {deployment.commandsBlocked}.
              </p>
            ) : null}
          </div>
          <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
            {deployment.commands.map((command) => (
              <li
                key={command.id}
                className="flex items-center gap-4 px-5 py-3"
              >
                <p className="min-w-0 flex-1 text-sm font-medium break-words">
                  {command.label}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locked || deployment.commandsBlocked !== null}
                  onClick={() => setConfirmCommand(command)}
                >
                  {startingCommand === command.id ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Play aria-hidden />
                  )}
                  Run
                </Button>
              </li>
            ))}
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
            <dt className={hintClassName}>Version</dt>
            <dd className="text-[13px]">
              {deployment.internal.update
                ? updateLabel(deployment.internal.update)
                : 'Not deployed yet'}
              {deployment.internal.pushedAt ? (
                <span className={hintClassName}>
                  {' '}
                  · last sent {formatDateTime(deployment.internal.pushedAt)}
                </span>
              ) : null}
              {deployment.internal.update?.status === 'unknown' ? (
                <span className={hintClassName}>
                  {' '}
                  · run Sync on the deployments page to read it from Dokploy
                </span>
              ) : null}
            </dd>
            <dt className={hintClassName}>USERNAME</dt>
            <dd className="font-mono text-[13px]">
              {deployment.internal.username}
            </dd>
            <dt className={hintClassName}>Routed in Cloudflare</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.routedHosts.join(', ') || 'none'}
            </dd>
            <dt className={hintClassName}>Emptied by Erase data</dt>
            <dd className="font-mono text-[13px] break-all">
              {deployment.internal.resetFolders.join(', ') ||
                'nothing, so Erase data is not offered'}
            </dd>
            {deployment.internal.resetSkipped.length > 0 ? (
              <>
                <dt className={hintClassName}>Left alone by Erase data</dt>
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

      {admin && deployment.internal ? (
        <DeploymentOverridesForm
          url={url}
          overrides={deployment.internal.overrides}
          onSaved={(next) => accept(next, true)}
        />
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
                  <span className="font-medium">{runTitle(run)}</span>
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
                  : `Erase ${deployment.product.name} data?`}
              </DialogTitle>
              <DialogDescription>
                {confirmErase === 'wipe'
                  ? `Everything ${deployment.internal?.username ?? 'this customer'} stored in this service is erased for good, and the service is removed from Dokploy. This cannot be undone.`
                  : 'Everything stored in this service is erased for good and the service is removed, including the values you set once. Turn it on again to start afresh. This cannot be undone.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor={`erase-${productId}`}>
                Type{' '}
                <span className="font-medium">{deployment.product.name}</span>{' '}
                to confirm
              </Label>
              <Input
                id={`erase-${productId}`}
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
                Erase data
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCommand !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCommand(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run "{confirmCommand?.label}"?</DialogTitle>
            <DialogDescription>
              It runs in {deployment.product.name} now. This page shows when it
              has finished.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCommand(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (confirmCommand) void runCommand(confirmCommand)
              }}
            >
              Run
            </Button>
          </DialogFooter>
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

/**
 * When the service runs another variant than the subscription pays for:
 * what happens next, and a button to apply it now. Also says when a
 * scheduled change of variant starts.
 */
function VariantNotice({
  deployment,
  admin,
  locked,
  starting,
  onApply,
}: {
  deployment: Deployment
  admin: boolean
  locked: boolean
  starting: boolean
  onApply: () => void
}) {
  const variant = deployment.variant
  const canApply = deployment.actions.includes('redeploy')

  if (variant.pending && variant.current) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-amber-50 px-5 py-3 text-sm text-amber-900">
        <p className="min-w-0 flex-1">
          {admin ? 'The subscription' : 'Your subscription'} is now on{' '}
          <strong className="font-medium">{variant.current.name}</strong>, but
          the service still runs{' '}
          {variant.deployed ? variant.deployed.name : 'the old variant'}.{' '}
          {variant.applyVariant === 'auto'
            ? 'It restarts on the new variant within a few minutes.'
            : 'Restart it when you are ready to switch.'}
        </p>
        {canApply ? (
          <Button type="button" size="sm" disabled={locked} onClick={onApply}>
            {starting ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Apply now
          </Button>
        ) : null}
      </div>
    )
  }

  if (variant.next) {
    return (
      <p className={`border-t border-[var(--line)] px-5 py-3 ${hintClassName}`}>
        Switches to {variant.next.name} on{' '}
        {formatDateTime(variant.next.startsAt)}.
      </p>
    )
  }
  return null
}
