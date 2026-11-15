import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Hourglass, LoaderCircle, Lock } from 'lucide-react'
import {
  MessageComposer,
  TicketStatusBadge,
  TicketThread,
} from '#/components/forms/ticket/TicketParts'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { apiFetch, apiUpload } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import {
  MAX_FOLLOWUPS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  errorCodeOf,
  shortTicketId,
} from '#/lib/ticket'
import type { Ticket, TicketStatus } from '#/lib/ticket'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/**
 * One ticket's thread. Customers follow up within their limit; admins
 * reply and change the status. The server decides; this only shows it.
 */
export default function TicketDetail({
  ticketId,
  view,
}: {
  ticketId: string
  view: 'customer' | 'admin'
}) {
  const base =
    view === 'admin' ? `/admin/tickets/${ticketId}` : `/tickets/${ticketId}`
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>(
    'loading',
  )
  const [savingStatus, setSavingStatus] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<Ticket>(base)
      if (response.success && response.data) {
        setTicket(response.data)
        setState('ready')
        return
      }
      setState(
        errorCodeOf(response.data) === 'TICKET_NOT_FOUND' ? 'missing' : 'error',
      )
    } catch {
      setState('error')
    }
  }, [base])

  useEffect(() => {
    setState('loading')
    void load()
  }, [load])

  // Photo links last minutes: reload before they run out.
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 4 * 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  async function send(body: string, image: File | null): Promise<boolean> {
    const form = new FormData()
    form.append('body', body)
    if (image) form.append('image', image)
    try {
      const response = await apiUpload<Ticket>(`${base}/messages`, form)
      if (!response.success || !response.data) {
        toast.error(response.message || 'The message could not be sent')
        // The limit or status may have changed elsewhere: show what is true.
        if (errorCodeOf(response.data)) void load()
        return false
      }
      setTicket(response.data)
      return true
    } catch {
      toast.error('Unable to reach the server. Please try again.')
      return false
    }
  }

  async function changeStatus(status: TicketStatus) {
    setSavingStatus(true)
    try {
      const response = await apiFetch<Ticket>(`${base}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'The status could not be changed')
        return
      }
      setTicket(response.data)
      toast.success(`Status set to ${TICKET_STATUS_LABELS[status]}`)
    } catch {
      toast.error('Unable to reach the server. Please try again.')
    } finally {
      setSavingStatus(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className={`flex items-center gap-2 py-8 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading ticket…
      </div>
    )
  }
  if (state === 'missing' || !ticket) {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>
          {state === 'missing'
            ? 'This ticket does not exist.'
            : 'The ticket could not be loaded.'}
        </p>
        {state === 'error' ? (
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  const closed = ticket.status === 'closed'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 text-xl font-medium tracking-tight break-words">
            {ticket.subject}
          </h1>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className={hintClassName}>
          {shortTicketId(ticket.id)} · opened {formatDateTime(ticket.createdAt)}
          {view === 'admin' && ticket.user ? ` · ${ticket.user.email}` : ''}
        </p>
      </header>

      {view === 'admin' ? (
        <section
          className={`${cardClassName} flex flex-wrap items-end gap-x-8 gap-y-4 p-4`}
        >
          <div className="w-48 space-y-1.5">
            <Label htmlFor="ticket-status">Status</Label>
            <Select
              value={ticket.status}
              disabled={savingStatus}
              onValueChange={(value) =>
                void changeStatus(value as TicketStatus)
              }
            >
              <SelectTrigger id="ticket-status" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {TICKET_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={`text-xs ${hintClassName}`}>Customer follow-ups</p>
            <p className="text-sm font-medium">
              {ticket.followupCount} of {MAX_FOLLOWUPS} since the last reply
              {ticket.followupCount >= MAX_FOLLOWUPS
                ? ' · waiting for you'
                : ''}
            </p>
          </div>
        </section>
      ) : null}

      <TicketThread messages={ticket.messages} viewer={view} />

      <section className="border-t border-[var(--line)] pt-6">
        {view === 'admin' ? (
          <MessageComposer
            label="Reply"
            placeholder="Write your reply to the customer."
            submitLabel="Send reply"
            hint={
              closed
                ? 'The ticket stays closed; reopen it to let the customer write again.'
                : `Replying gives the customer ${MAX_FOLLOWUPS} follow-ups again.`
            }
            onSend={send}
          />
        ) : closed ? (
          <Notice icon={Lock} text="This ticket is closed." />
        ) : !ticket.canSend ? (
          <Notice
            icon={Hourglass}
            text="Waiting for admin response. You can write again once we reply."
          />
        ) : (
          <MessageComposer
            label="Add a follow-up"
            placeholder="Anything to add?"
            submitLabel="Send"
            hint={`${ticket.followupsRemaining} follow-up${ticket.followupsRemaining === 1 ? '' : 's'} remaining until we reply`}
            onSend={send}
          />
        )}
      </section>
    </div>
  )
}

function Notice({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
      <Icon className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
      {text}
    </p>
  )
}
