import { useSyncExternalStore } from 'react'
import { getToken } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { API_BASE_URL } from '#/lib/config'

export type AppNotification = {
  id: string
  title: string
  body: string
  /** An internal relative path, or null. */
  link: string | null
  readAt: string | null
  createdAt: string
}

type NotificationPage = { items: AppNotification[]; nextCursor: string | null }

const PAGE_SIZE = 20
const LINK_MAX = 300

/**
 * The same rule the server applies: one leading "/", no "//" or "\", no
 * whitespace or scheme. Checked again before navigating.
 */
export function isSafeInternalLink(link: string | null): link is string {
  if (!link || link.length > LINK_MAX) return false
  if (!link.startsWith('/') || link.startsWith('//')) return false
  if (link.includes('\\')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F-\u009F]/u.test(link)) return false
  try {
    const base = 'http://internal.invalid'
    return new URL(link, base).origin === base
  } catch {
    return false
  }
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
]

/** "5 minutes ago", "yesterday", … */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  let value = (new Date(iso).getTime() - now) / 1000
  if (Math.abs(value) < 45) return 'just now'
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return relative.format(Math.round(value), 'year')
}

// ---- Store ---------------------------------------------------------------

type State = {
  items: AppNotification[]
  unreadCount: number
  nextCursor: string | null
  /** The first page has been loaded at least once. */
  loaded: boolean
  loading: boolean
  error: boolean
}

const EMPTY: State = {
  items: [],
  unreadCount: 0,
  nextCursor: null,
  loaded: false,
  loading: false,
  error: false,
}

let state: State = EMPTY
const listeners = new Set<() => void>()

function setState(patch: Partial<State>) {
  // A response that lands after sign-out must not refill the store.
  if (!session) return
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export function useNotifications(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => EMPTY,
  )
}

export async function refreshUnreadCount(): Promise<void> {
  try {
    const res = await apiFetch<{ count: number }>('/notifications/unread-count')
    if (res.success && res.data) setState({ unreadCount: res.data.count })
  } catch {
    // Kept as is; the next reconnect or action refreshes it.
  }
}

/** Loads the newest page, replacing the list. */
export async function loadNotifications(): Promise<void> {
  setState({ loading: true, error: false })
  try {
    const res = await apiFetch<NotificationPage>(
      `/notifications?limit=${PAGE_SIZE}`,
    )
    if (!res.success || !res.data) throw new Error(res.message)
    setState({
      items: res.data.items,
      nextCursor: res.data.nextCursor,
      loaded: true,
      loading: false,
    })
  } catch {
    setState({ loading: false, error: true })
  }
}

export async function loadMoreNotifications(): Promise<void> {
  const cursor = state.nextCursor
  if (!cursor || state.loading) return
  setState({ loading: true, error: false })
  try {
    const res = await apiFetch<NotificationPage>(
      `/notifications?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
    )
    if (!res.success || !res.data) throw new Error(res.message)
    const known = new Set(state.items.map((n) => n.id))
    setState({
      items: [
        ...state.items,
        ...res.data.items.filter((n) => !known.has(n.id)),
      ],
      nextCursor: res.data.nextCursor,
      loading: false,
    })
  } catch {
    setState({ loading: false, error: true })
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const item = state.items.find((n) => n.id === id)
  if (item && !item.readAt) {
    setState({
      items: state.items.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })
  }
  try {
    const res = await apiFetch<AppNotification>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' },
    )
    if (!res.success) throw new Error(res.message)
  } catch {
    void refreshUnreadCount()
  }
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const before = state
  const now = new Date().toISOString()
  setState({
    items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    unreadCount: 0,
  })
  try {
    const res = await apiFetch<{ updated: number }>('/notifications/read-all', {
      method: 'POST',
    })
    if (!res.success) throw new Error(res.message)
    return true
  } catch {
    setState({ items: before.items, unreadCount: before.unreadCount })
    void refreshUnreadCount()
    return false
  }
}

function receive(notification: AppNotification) {
  if (state.items.some((n) => n.id === notification.id)) return
  setState({
    items: [notification, ...state.items],
    unreadCount: state.unreadCount + (notification.readAt ? 0 : 1),
  })
}

// ---- Live stream ---------------------------------------------------------

const BACKOFF_MIN_MS = 1_000
const BACKOFF_MAX_MS = 30_000
/** The server pings every 25s; silence longer than this means a dead link. */
const IDLE_TIMEOUT_MS = 60_000

let session: { stop: () => void; owner: string } | null = null

/**
 * Opens the notification stream for the signed-in user and keeps it open,
 * reconnecting with backoff. The stream needs the Authorization header, so
 * it is read with fetch rather than EventSource. Returns a stop function.
 */
export function startNotificationStream(owner: string): () => void {
  if (session?.owner === owner) return session.stop
  session?.stop()
  state = EMPTY

  let stopped = false
  let controller: AbortController | null = null
  let retryTimer: number | undefined
  let attempt = 0
  let connectedBefore = false
  let lastEventId: string | null = null

  function scheduleRetry() {
    if (stopped) return
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt)
    attempt += 1
    retryTimer = window.setTimeout(
      connect,
      delay / 2 + Math.random() * (delay / 2),
    )
  }

  function handleBlock(block: string) {
    let event = 'message'
    let id: string | null = null
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'id') id = value
      else if (field === 'data') data.push(value)
    }
    if (id) lastEventId = id
    if (event !== 'notification' || data.length === 0) return
    try {
      receive(JSON.parse(data.join('\n')) as AppNotification)
    } catch {
      // A malformed event is skipped.
    }
  }

  async function connect() {
    if (stopped) return
    const token = getToken()
    if (!token) return
    controller = new AbortController()
    const current = controller
    let idleTimer: number | undefined
    const resetIdle = () => {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => current.abort(), IDLE_TIMEOUT_MS)
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      }
      if (lastEventId) headers['Last-Event-ID'] = lastEventId
      const res = await fetch(`${API_BASE_URL}/notifications/stream`, {
        headers,
        cache: 'no-store',
        signal: current.signal,
      })
      // Signed out or blocked: retrying will not help.
      if (res.status === 401 || res.status === 403) return
      if (!res.ok || !res.body) throw new Error('Stream unavailable')

      attempt = 0
      resetIdle()
      if (connectedBefore) {
        void refreshUnreadCount()
        if (state.loaded) void loadNotifications()
      }
      connectedBefore = true

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        resetIdle()
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n?/g, '\n')
        let end = buffer.indexOf('\n\n')
        while (end >= 0) {
          handleBlock(buffer.slice(0, end))
          buffer = buffer.slice(end + 2)
          end = buffer.indexOf('\n\n')
        }
      }
    } catch {
      // Network error or abort; retried below unless stopped.
    } finally {
      window.clearTimeout(idleTimer)
    }
    scheduleRetry()
  }

  const stop = () => {
    stopped = true
    window.clearTimeout(retryTimer)
    controller?.abort()
    if (session?.stop === stop) {
      session = null
      state = EMPTY
      for (const listener of listeners) listener()
    }
  }
  session = { stop, owner }

  void refreshUnreadCount()
  void connect()
  return stop
}
