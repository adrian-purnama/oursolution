import type { ProductNotice, ProductSummary } from '#/lib/product'

export type DeploymentState =
  | 'notDeployed'
  | 'deploying'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'restarting'
  | 'erasing'
  | 'runningCommand'
  | 'failed'

export type RunAction =
  | 'deploy'
  | 'redeploy'
  | 'restart'
  | 'turnOff'
  | 'reset'
  /** Admin only: erases a stopped, unsubscribed customer's data. */
  | 'wipe'
  /** Runs one of the product's commands in the running service. */
  | 'command'
export type RunStatus = 'running' | 'succeeded' | 'failed'
export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export type RunStep = {
  key: string
  label: string
  status: StepStatus
  /** Admin view only. */
  internalLabel?: string
  /** Admin view only. */
  error?: string | null
}

export type DeploymentRun = {
  id: string
  action: RunAction
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  /** Started by the system, e.g. after a subscription ended. */
  automatic: boolean
  /** Command runs only: the label of the command that ran. */
  commandLabel: string | null
  steps: RunStep[]
}

/** A command the customer can run, shown by its label only. */
export type DeploymentCommand = {
  id: string
  label: string
}

export type DeploymentVariable = {
  key: string
  value: string
  editable: boolean
  /** Admin view only. */
  visibility?: 'editable' | 'readOnly' | 'hidden'
}

export type ServiceCheckState = 'up' | 'down' | 'pending' | 'maintenance'

/** How one address did over the last 24 hours. */
export type ServiceStatus = {
  host: string
  state: ServiceCheckState
  /** Share of checks that were up, 0 to 1. Null before the first check. */
  uptime: number | null
  responseMs: number | null
  checkedAt: string | null
  /** The latest checks, oldest first. */
  beats: { state: ServiceCheckState; at: string }[]
}

export type Deployment = {
  product: ProductSummary
  /** The product's rules and disclaimers. */
  notices: ProductNotice[]
  entitled: boolean
  state: DeploymentState
  /** When the running subscription ends; null for no end or not running. */
  subscriptionEndsAt: string | null
  /** When the service last came up, while it runs; else null. */
  runningSince: string | null
  hosts: string[]
  /** Per address, while the service runs and is monitored; else empty. */
  status: ServiceStatus[]
  variables: DeploymentVariable[]
  actions: RunAction[]
  /** The product's commands. */
  commands: DeploymentCommand[]
  /** Why the commands cannot run now, or null when they can. */
  commandsBlocked: string | null
  /** Latest first. */
  runs: DeploymentRun[]
  /** Admin view only. */
  internal?: {
    name: string | null
    username: string
    composeId: string | null
    appName: string | null
    routedHosts: string[]
    monitors: { host: string; monitorId: number }[]
    /** Host folders a reset empties. */
    resetFolders: string[]
    /** Mounted host paths a reset leaves alone, and why. */
    resetSkipped: { path: string; reason: string }[]
    /** Whether "Delete data" may run now, and if not, why. */
    wipe: { allowed: boolean; reason: string | null }
  }
}

/** One line of the admin overview of every deployment. */
export type AdminDeploymentRow = {
  user: { id: string; email: string }
  deployment: Deployment
}

/** One host of a deployment, as a sync found it; null: not checked. */
export type DeploymentSyncDomain = {
  host: string
  /** Dokploy has it as a domain of the compose. */
  registered: boolean | null
  /** Routed by the Cloudflare tunnel, with its DNS record. */
  on: boolean | null
  issue: string | null
}

/** What a sync did with one deployment. */
export type DeploymentSyncItem = {
  user: { id: string; email: string }
  product: { id: string; name: string }
  /** "skipped": a run was in progress, so it was left alone. */
  outcome: 'unchanged' | 'changed' | 'skipped' | 'failed'
  from: DeploymentState
  to: DeploymentState
  containers: 'running' | 'stopped' | 'degraded' | 'missing' | null
  message: string | null
  domains: DeploymentSyncDomain[]
}

/** The result of syncing every deployment with Dokploy and Cloudflare. */
export type DeploymentSync = {
  checked: number
  changed: number
  skipped: number
  failed: number
  domainIssues: number
  /** Why hosts' on/off could not be checked in Cloudflare, or null. */
  cloudflareError: string | null
  items: DeploymentSyncItem[]
}

export const CHECK_STATE_LABELS: Record<ServiceCheckState, string> = {
  up: 'Up',
  down: 'Not responding',
  pending: 'Checking',
  maintenance: 'Maintenance',
}

/** "99.9%", never rounding a real outage up to 100%. */
export function formatUptime(uptime: number): string {
  if (uptime >= 1) return '100%'
  return `${Math.min(uptime * 100, 99.99).toFixed(2)}%`
}

export const BUSY_STATES: DeploymentState[] = [
  'deploying',
  'stopping',
  'restarting',
  'erasing',
  'runningCommand',
]

export const STATE_LABELS: Record<DeploymentState, string> = {
  notDeployed: 'Not deployed',
  deploying: 'Deploying',
  running: 'Running',
  stopping: 'Turning off',
  stopped: 'Off',
  restarting: 'Restarting',
  erasing: 'Deleting data',
  runningCommand: 'Running a command',
  failed: 'Needs attention',
}

export const RUN_ACTION_LABELS: Record<RunAction, string> = {
  deploy: 'Deploy',
  redeploy: 'Redeploy',
  restart: 'Restart',
  turnOff: 'Turn off',
  reset: 'Reset',
  wipe: 'Delete data',
  command: 'Command',
}

/** What each action does, in the customer's words. */
export const RUN_ACTION_HINTS: Record<RunAction, string> = {
  deploy: 'Starts the service.',
  redeploy: 'Applies your settings and the latest version. Your data is kept.',
  restart: 'Stops and starts the service. Your data is kept.',
  turnOff:
    'Takes the service and its address offline. Your data is kept until you turn it on again.',
  reset: 'Erases everything stored in the service and starts it again as new.',
  wipe: 'Erases everything stored in the service. It stays off.',
  command: 'Runs a command in the service.',
}

/** What a run is called: a command's own label, else its action's. */
export function runTitle(run: Pick<DeploymentRun, 'action' | 'commandLabel'>) {
  return run.commandLabel ?? RUN_ACTION_LABELS[run.action]
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** "3 days", "5 hours", "12 minutes": how long ago `iso` was. */
export function formatSince(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  const plural = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? '' : 's'}`
  if (minutes < 1) return 'moments'
  if (minutes < 60) return plural(minutes, 'minute')
  if (minutes < 60 * 24) return plural(Math.floor(minutes / 60), 'hour')
  return plural(Math.floor(minutes / (60 * 24)), 'day')
}

/** A subscription ending within this many days counts as "ending soon". */
export const EXPIRING_SOON_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export type Expiry =
  { kind: 'expired' } | { kind: 'expiring'; endsAt: string; daysLeft: number }

/** Whether the subscription has ended or ends soon; null when neither. */
export function expiryOf(
  deployment: Pick<Deployment, 'entitled' | 'subscriptionEndsAt'>,
  now: number = Date.now(),
): Expiry | null {
  if (!deployment.entitled) return { kind: 'expired' }
  const endsAt = deployment.subscriptionEndsAt
  if (!endsAt) return null
  const left = Date.parse(endsAt) - now
  if (left > EXPIRING_SOON_DAYS * DAY_MS) return null
  return {
    kind: 'expiring',
    endsAt,
    daysLeft: Math.max(0, Math.ceil(left / DAY_MS)),
  }
}

/** "today", "tomorrow", "in 3 days". */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `in ${daysLeft} days`
}

/** One line on where the subscription stands. */
export function subscriptionLine(
  deployment: Pick<Deployment, 'entitled' | 'subscriptionEndsAt'>,
): string {
  const expiry = expiryOf(deployment)
  if (expiry?.kind === 'expired') return 'Subscription expired'
  if (expiry?.kind === 'expiring') {
    return `Subscription ends ${formatDaysLeft(expiry.daysLeft)} (${formatDate(expiry.endsAt)})`
  }
  return deployment.subscriptionEndsAt
    ? `Subscription active until ${formatDate(deployment.subscriptionEndsAt)}`
    : 'Subscription active'
}

/** The deploy button's label depends on where the service stands. */
export function actionLabel(action: RunAction, state: DeploymentState): string {
  if (action === 'deploy' && state === 'stopped') return 'Turn on'
  if (action === 'deploy' && state === 'failed') return 'Try again'
  return RUN_ACTION_LABELS[action]
}
