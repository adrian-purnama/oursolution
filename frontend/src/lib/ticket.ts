import { m } from '#/paraglide/messages'

export type TicketStatus = 'open' | 'in_progress' | 'closed'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'closed']

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  get open() {
    return m.ticket_status_open()
  },
  get in_progress() {
    return m.ticket_status_in_progress()
  },
  get closed() {
    return m.ticket_status_closed()
  },
}

/** Badge colors, the same for customers and admins. */
export const TICKET_STATUS_CLASSES: Record<TicketStatus, string> = {
  open: 'border-blue-200 bg-blue-50 text-blue-800',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  closed: 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]',
}

export type TicketMessage = {
  id: string
  kind: 'message' | 'status'
  senderRole: 'user' | 'admin'
  /** Admin view only. */
  senderEmail?: string
  body: string
  /** Signed for a few minutes; reload the ticket to get a fresh one. */
  imageUrl: string | null
  fromStatus: TicketStatus | null
  toStatus: TicketStatus | null
  createdAt: string
}

export type TicketSummary = {
  id: string
  subject: string
  status: TicketStatus
  followupCount: number
  followupsRemaining: number
  createdAt: string
  updatedAt: string
  /** Customer view: an admin replied or changed the status since they looked. */
  unread: boolean
  /** Admin view only. */
  user?: { id: string; email: string }
}

/** What the last close recorded; kept when the ticket is reopened. */
export type TicketClosure = {
  closedAt: string
  /** Admin view only; null means "Other". */
  productId?: string | null
  productName?: string | null
  /** What the admin wrote; null when an AI summary replaced the thread. */
  resolution: string | null
  /** AI-written plain text. Render as text only. */
  summary: string | null
}

export type Ticket = TicketSummary & {
  canSend: boolean
  lastAdminReplyAt: string | null
  messages: TicketMessage[]
  /** Null until the ticket is closed for the first time. */
  closure: TicketClosure | null
}

export type CloseTicketResult = {
  ticket: Ticket
  /** False when no summary was asked for, or the model failed. */
  summarized: boolean
}

export type TicketPage = {
  items: TicketSummary[]
  total: number
  page: number
  pageSize: number
}

/** Mirrors the server's limits, for counters and early messages only. */
export const SUBJECT_MIN = 5
export const SUBJECT_MAX = 120
export const BODY_MAX = 2000
export const RESOLUTION_MAX = 1000
export const MAX_FOLLOWUPS = 3
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Why a picked file cannot be sent, or null when it looks fine. */
export function imageProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return m.ticket_image_type()
  }
  if (file.size > MAX_IMAGE_BYTES) return m.ticket_image_size()
  return null
}

/** The short reference admins see: the id's last 6 characters. */
export function shortTicketId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`
}

/** The code a refused request carries, e.g. FOLLOWUP_LIMIT_REACHED. */
export function errorCodeOf(data: unknown): string | null {
  if (data && typeof data === 'object' && 'code' in data) {
    const code = data.code
    return typeof code === 'string' ? code : null
  }
  return null
}
