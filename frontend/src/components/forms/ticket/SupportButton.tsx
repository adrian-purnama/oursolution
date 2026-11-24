import { useEffect, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { m } from '#/paraglide/messages'

/**
 * How many of the signed-in customer's tickets have an admin reply or
 * status change they have not opened. Checked again on every page change,
 * so opening a ticket clears it. 0 when signed out or on failure.
 */
export function useUnreadTickets(enabled = true): number {
  const [unread, setUnread] = useState(0)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  useEffect(() => {
    if (!enabled) {
      setUnread(0)
      return
    }
    const run = { cancelled: false }
    void (async () => {
      try {
        const response = await apiFetch<{ count: number }>(
          '/tickets/unread-count',
        )
        if (!run.cancelled && response.success && response.data) {
          setUnread(response.data.count)
        }
      } catch {
        // The dot is a hint; without it the link still works.
      }
    })()
    return () => {
      run.cancelled = true
    }
  }, [enabled, pathname])

  return unread
}

/** A red dot for something new, placed in the corner of its parent. */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute size-2.5 rounded-full bg-red-600 ring-2 ring-white ${className ?? '-top-1 -right-1'}`}
    />
  )
}

/** "Tickets" on the dashboard, with a red dot when there is a new reply. */
export default function SupportButton() {
  const unread = useUnreadTickets()

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="relative"
      data-tour="tickets"
    >
      <Link
        to="/support"
        className="no-underline"
        aria-label={
          unread > 0
            ? m.support_aria_unread({ count: unread })
            : m.support_aria()
        }
      >
        <LifeBuoy aria-hidden />
        {m.support_tickets()}
        {unread > 0 ? <UnreadDot /> : null}
      </Link>
    </Button>
  )
}
