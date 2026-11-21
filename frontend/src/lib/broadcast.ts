import type { DeploymentState } from '#/lib/deployment'

export type BroadcastAudience =
  | { type: 'all' }
  | { type: 'users'; userIds: string[] }
  | { type: 'product'; productId: string; match: 'active' }
  | {
      type: 'product'
      productId: string
      match: 'deployment'
      states: DeploymentState[]
    }

export type BroadcastRecipient = { id: string; email: string }

export type BroadcastAudiencePreview = {
  count: number
  label: string
  sample: BroadcastRecipient[]
}

export type Broadcast = {
  id: string
  subject: string
  body: string
  link: string | null
  buttonLabel: string | null
  inApp: boolean
  audienceType: 'all' | 'users' | 'product'
  productMatch: 'active' | 'deployment' | null
  audienceLabel: string
  status: 'sending' | 'sent'
  recipientCount: number
  sentCount: number
  failedCount: number
  createdBy: string | null
  createdAt: string
  finishedAt: string | null
}

export type BroadcastList = {
  items: Broadcast[]
  page: number
  pageSize: number
  total: number
}

/** Must match backend/src/validation/broadcast.ts and notification.ts. */
export const SUBJECT_MAX = 150
export const BODY_MAX = 5000
export const IN_APP_TITLE_MAX = 100
export const IN_APP_BODY_MAX = 500
export const BUTTON_LABEL_MAX = 40

/** States an admin can filter on, in the order they are offered. */
export const AUDIENCE_STATES: { state: DeploymentState; label: string }[] = [
  { state: 'running', label: 'Running' },
  { state: 'stopped', label: 'Off' },
  { state: 'failed', label: 'Needs attention' },
  { state: 'notDeployed', label: 'Not deployed' },
  { state: 'deploying', label: 'Deploying' },
  { state: 'restarting', label: 'Restarting' },
]

/** Starting points for common notices; the admin edits them before sending. */
export const BROADCAST_TEMPLATES: {
  label: string
  subject: string
  body: string
}[] = [
  {
    label: 'Planned upgrade',
    subject: 'Planned upgrade of your instance',
    body: 'Hi,\n\nWe will upgrade your instance on [date] at [time]. It may be unavailable for a few minutes while the upgrade runs. Your data stays as it is.\n\nThank you for your patience.',
  },
  {
    label: 'Maintenance',
    subject: 'Scheduled maintenance',
    body: 'Hi,\n\nWe are doing scheduled maintenance on [date] from [start] to [end]. Your service may be briefly unavailable during this time.\n\nThank you for your patience.',
  },
  {
    label: 'Instance is off',
    subject: 'Your instance is turned off',
    body: 'Hi,\n\nYour instance is currently turned off. You can turn it back on any time from your dashboard.\n\nIf you need help, just open a ticket.',
  },
]
