import { useNavigate } from '@tanstack/react-router'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  formatRelativeTime,
  isSafeInternalLink,
  loadMoreNotifications,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from '#/lib/notification'
import type { AppNotification } from '#/lib/notification'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

function badgeText(count: number): string {
  return count > 9 ? '9+' : String(count)
}

/** The bell in the header: unread badge and the latest notifications. */
export default function NotificationMenu() {
  const navigate = useNavigate()
  const { items, unreadCount, nextCursor, loaded, loading, error } =
    useNotifications()
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !loaded && !loading) void loadNotifications()
  }

  function openNotification(notification: AppNotification) {
    if (!notification.readAt) void markNotificationRead(notification.id)
    setOpen(false)
    // Text from the server is never used as a raw href.
    if (isSafeInternalLink(notification.link)) {
      void navigate({ href: notification.link })
    }
  }

  async function markAll() {
    if (!(await markAllNotificationsRead())) {
      toast.error(m.notif_mark_failed())
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label={
          unreadCount > 0
            ? m.notif_aria_unread({ count: unreadCount })
            : m.notif_title()
        }
        title={m.notif_title()}
        className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[var(--ink)] outline-none transition hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--navy)] data-[state=open]:bg-[var(--surface)]"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span
            className="absolute top-1 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[10px] leading-4 font-semibold text-white"
            aria-hidden
          >
            {badgeText(unreadCount)}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-[var(--line)] p-2 shadow-[0_24px_48px_-20px_rgba(12,12,11,0.25)]"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold text-[var(--ink)]">
            {m.notif_title()}
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                void markAll()
              }}
              className="cursor-pointer gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] focus:text-[var(--ink)]"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              {m.notif_mark_all()}
            </DropdownMenuItem>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-1" />

        <div className="max-h-[min(26rem,65vh)] overflow-y-auto">
          {!loaded && loading ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
              {m.notif_loading()}
            </p>
          ) : !loaded && error ? (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-sm text-[var(--muted)]">
                {m.notif_load_failed()}
              </p>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  void loadNotifications()
                }}
                className="cursor-pointer rounded-full px-3 py-1 text-sm font-medium text-[var(--ink)]"
              >
                {m.common_retry()}
              </DropdownMenuItem>
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
              {m.notif_empty()}
            </p>
          ) : (
            <>
              {items.map((notification) => {
                const unread = !notification.readAt
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => openNotification(notification)}
                    className={cn(
                      'cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5',
                      unread && 'bg-[var(--surface)]/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        unread ? 'bg-[var(--navy)]' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm text-[var(--ink)]',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {unread ? (
                          <span className="sr-only">{m.notif_unread()}</span>
                        ) : null}
                        {notification.title}
                      </span>
                      <span className="line-clamp-2 block text-xs leading-relaxed whitespace-pre-line text-[var(--muted)]">
                        {notification.body}
                      </span>
                      <time
                        dateTime={notification.createdAt}
                        className="mt-0.5 block text-[11px] text-[var(--muted)]"
                      >
                        {formatRelativeTime(notification.createdAt)}
                      </time>
                    </span>
                  </DropdownMenuItem>
                )
              })}
              {nextCursor ? (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    void loadMoreNotifications()
                  }}
                  disabled={loading}
                  className="mt-1 cursor-pointer justify-center rounded-xl py-2 text-sm font-medium text-[var(--ink)]"
                >
                  {loading ? m.notif_loading() : m.notif_load_more()}
                </DropdownMenuItem>
              ) : null}
              {loaded && error ? (
                <p className="px-3 py-2 text-center text-xs text-red-600">
                  {m.notif_more_failed()}
                </p>
              ) : null}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
