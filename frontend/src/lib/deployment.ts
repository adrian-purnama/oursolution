import type {
  ProductNotice,
  ProductSummary,
  VariableVisibility,
} from '#/lib/product'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

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
  /** The customer erases their data while the service is off. */
  | 'erase'
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
  /** Empty for the customer once a secret is filled. */
  value: string
  /** It may be changed now. */
  editable: boolean
  /** Filled once by the customer before the first deploy, then fixed. */
  setOnce: boolean
  /** Set-once only: it has a value. */
  filled: boolean
  /** Set once, then hidden from the customer. */
  secret: boolean
  /** Set-once only: the product's example for the empty field. */
  placeholder: string | null
  /** Admin view only. */
  visibility?: VariableVisibility
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

/** A product variant by name. */
export type VariantRef = { id: string; name: string }

/** Which variant a service is on, runs, and changes to next. */
export type DeploymentVariant = {
  /** What the running subscription pays for; null when none runs. */
  current: VariantRef | null
  /** Whose compose file was last deployed; null before the first deploy. */
  deployed: VariantRef | null
  /** It runs another variant than `current`: a redeploy applies it. */
  pending: boolean
  /** Whether that redeploy happens by itself. */
  applyVariant: 'auto' | 'manual' | null
  /** The next scheduled change of variant. */
  next: (VariantRef & { startsAt: string }) | null
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
  /** Set-once variables still to fill; it cannot be turned on until then. */
  missingValues: string[]
  actions: RunAction[]
  /** The product's commands. */
  commands: DeploymentCommand[]
  /** Why the commands cannot run now, or null when they can. */
  commandsBlocked: string | null
  /** Latest first. */
  runs: DeploymentRun[]
  variant: DeploymentVariant
  /** Admin view only. */
  internal?: {
    name: string | null
    username: string
    composeId: string | null
    appName: string | null
    routedHosts: string[]
    monitors: { host: string; monitorId: number }[]
    /** Host folders erasing empties. */
    resetFolders: string[]
    /** Mounted host paths erasing leaves alone, and why. */
    resetSkipped: { path: string; reason: string }[]
    /** Whether "Delete data" may run now, and if not, why. */
    wipe: { allowed: boolean; reason: string | null }
    /**
     * Whether a redeploy would send another compose file or .env than the
     * last one sent; null when never pushed. "unknown" until a sync reads
     * it from Dokploy, for ones pushed before this was kept.
     */
    update: DeploymentUpdate | null
    /** When the app last sent the compose file and .env. */
    pushedAt: string | null
    overrides: DeploymentOverrides
  }
}

export type DeploymentUpdate =
  | { status: 'current' }
  | { status: 'available'; compose: boolean; env: boolean }
  | { status: 'unknown' }

/** Running, or failed, with something newer to send: what Update takes. */
export function updatePending(deployment: Deployment): boolean {
  const update = deployment.internal?.update
  return (
    (deployment.state === 'running' || deployment.state === 'failed') &&
    deployment.entitled &&
    (update?.status === 'available' || update?.status === 'unknown')
  )
}

/** A short line on what an update would change. */
export function updateLabel(update: DeploymentUpdate): string {
  if (update.status === 'current') return m.dep_update_current()
  if (update.status === 'unknown') return m.dep_update_unknown()
  const parts = [
    ...(update.compose ? [m.dep_update_compose()] : []),
    ...(update.env ? [m.dep_update_env()] : []),
  ]
  return m.dep_update_available({ parts: parts.join(m.dep_update_and()) })
}

/** One logged change of a deployment's overrides. */
export type DeploymentChange = {
  id: string
  at: string
  byEmail: string
  target: 'env' | 'compose'
  key: string | null
  /** Null: there was no override. */
  before: string | null
  /** Null: reset to the product's. */
  after: string | null
}

/** Admin: what one deployment changes on top of its product. */
export type DeploymentOverrides = {
  /** Every product variable, then overrides of names the product lacks. */
  env: {
    key: string
    /** What applies without an override; null: not a product variable. */
    productValue: string | null
    /** As typed, may hold ${USERNAME}; null when not overridden. */
    override: string | null
  }[]
  /** Replacement compose file, or null to use the product's. */
  composeFile: string | null
  /** The compose file of the variant the subscription is on now. */
  productComposeFile: string
  /** Newest first. */
  changes: DeploymentChange[]
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

/** What an admin can do to many deployments at once. */
export type BulkAction = 'turnOn' | 'turnOff' | 'erase' | 'update'

export const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  get turnOn() {
    return m.dep_bulk_turn_on()
  },
  get turnOff() {
    return m.dep_bulk_turn_off()
  },
  get erase() {
    return m.dep_bulk_erase()
  },
  get update() {
    return m.dep_bulk_update()
  },
}

/** How many deployments one bulk action may take. */
export const MAX_BULK_TARGETS = 100

export type DeploymentBulkItem = {
  user: { id: string; email: string | null }
  product: { id: string; name: string | null }
  /** skipped: nothing to do or busy. refused: a check said no. */
  outcome: 'started' | 'skipped' | 'refused'
  run: RunAction | null
  message: string | null
}

/** What a bulk action did, one line per deployment. */
export type DeploymentBulk = {
  started: number
  skipped: number
  refused: number
  items: DeploymentBulkItem[]
}

export const CHECK_STATE_LABELS: Record<ServiceCheckState, string> = {
  get up() {
    return m.dep_check_up()
  },
  get down() {
    return m.dep_check_down()
  },
  get pending() {
    return m.dep_check_pending()
  },
  get maintenance() {
    return m.dep_check_maintenance()
  },
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
  get notDeployed() {
    return m.dep_state_not_deployed()
  },
  get deploying() {
    return m.dep_state_deploying()
  },
  get running() {
    return m.dep_state_running()
  },
  get stopping() {
    return m.dep_state_stopping()
  },
  get stopped() {
    return m.dep_state_stopped()
  },
  get restarting() {
    return m.dep_state_restarting()
  },
  get erasing() {
    return m.dep_state_erasing()
  },
  get runningCommand() {
    return m.dep_state_running_command()
  },
  get failed() {
    return m.dep_state_failed()
  },
}

export const RUN_ACTION_LABELS: Record<RunAction, string> = {
  get deploy() {
    return m.dep_action_deploy()
  },
  get redeploy() {
    return m.dep_action_redeploy()
  },
  get restart() {
    return m.dep_action_restart()
  },
  get turnOff() {
    return m.dep_action_turn_off()
  },
  get erase() {
    return m.dep_action_erase()
  },
  get wipe() {
    return m.dep_action_wipe()
  },
  get command() {
    return m.dep_action_command()
  },
}

/** What each action does, in the customer's words. */
export const RUN_ACTION_HINTS: Record<RunAction, string> = {
  get deploy() {
    return m.dep_hint_deploy()
  },
  get redeploy() {
    return m.dep_hint_redeploy()
  },
  get restart() {
    return m.dep_hint_restart()
  },
  get turnOff() {
    return m.dep_hint_turn_off()
  },
  get erase() {
    return m.dep_hint_erase()
  },
  get wipe() {
    return m.dep_hint_wipe()
  },
  get command() {
    return m.dep_hint_command()
  },
}

/** What a run is called: a command's own label, else its action's. */
export function runTitle(run: Pick<DeploymentRun, 'action' | 'commandLabel'>) {
  return run.commandLabel ?? RUN_ACTION_LABELS[run.action]
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'medium',
  }).format(new Date(iso))
}

/** "3 days", "5 hours", "12 minutes": how long ago `iso` was. */
export function formatSince(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return m.since_moments()
  if (minutes < 60) {
    return minutes === 1
      ? m.since_minute_one()
      : m.since_minute_other({ count: minutes })
  }
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60)
    return hours === 1
      ? m.since_hour_one()
      : m.since_hour_other({ count: hours })
  }
  const days = Math.floor(minutes / (60 * 24))
  return days === 1 ? m.since_day_one() : m.since_day_other({ count: days })
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
  if (daysLeft <= 0) return m.dep_days_left_today()
  if (daysLeft === 1) return m.dep_days_left_tomorrow()
  return m.dep_days_left_other({ count: daysLeft })
}

/** One line on where the subscription stands. */
export function subscriptionLine(
  deployment: Pick<Deployment, 'entitled' | 'subscriptionEndsAt'>,
): string {
  const expiry = expiryOf(deployment)
  if (expiry?.kind === 'expired') return m.dep_sub_expired()
  if (expiry?.kind === 'expiring') {
    return m.dep_sub_ends({
      when: formatDaysLeft(expiry.daysLeft),
      date: formatDate(expiry.endsAt),
    })
  }
  return deployment.subscriptionEndsAt
    ? m.dep_sub_active_until({
        date: formatDate(deployment.subscriptionEndsAt),
      })
    : m.dep_sub_active()
}

/** The deploy button's label depends on where the service stands. */
export function actionLabel(action: RunAction, state: DeploymentState): string {
  if (action === 'deploy' && state === 'stopped') return m.dep_turn_on()
  if (action === 'deploy' && state === 'failed') return m.dep_try_again()
  return RUN_ACTION_LABELS[action]
}
