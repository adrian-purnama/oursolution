import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Hourglass, LoaderCircle, Lock, Pencil } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import CloseTicketDialog from '#/components/forms/ticket/CloseTicketDialog'
import {
  MessageComposer,
  TicketStatusBadge,
  TicketThread,
} from '#/components/forms/ticket/TicketParts'
import { Button } from '#/components/ui/button'
import { Select, SelectContent, SelectItem } from '#/components/ui/select'
import { apiFetch, apiUpload } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import {
  MAX_FOLLOWUPS,
  TICKET_STATUSES,
  TICKET_STATUS_CLASSES,
  TICKET_STATUS_LABELS,
  errorCodeOf,
  shortTicketId,
} from '#/lib/ticket'
import type { Ticket, TicketStatus } from '#/lib/ticket'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

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
  const [closeOpen, setCloseOpen] = useState(false)

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
          {view === 'admin' ? (
            <EditableStatus
              status={ticket.status}
              saving={savingStatus}
              onChange={(status) => {
                // Closing needs a product and resolution: the dialog does it.
                if (status === 'closed') setCloseOpen(true)
                else void changeStatus(status)
              }}
            />
          ) : (
            <TicketStatusBadge status={ticket.status} />
          )}
        </div>
        <p className={hintClassName}>
          {shortTicketId(ticket.id)} · opened {formatDateTime(ticket.createdAt)}
          {view === 'admin' && ticket.user ? ` · ${ticket.user.email}` : ''}
          {view === 'admin'
            ? ` · ${ticket.followupCount} of ${MAX_FOLLOWUPS} follow-ups since the last reply${
                ticket.followupCount >= MAX_FOLLOWUPS ? ', waiting for you' : ''
              }`
            : ''}
        </p>
      </header>

      <TicketThread
        messages={ticket.messages}
        viewer={view}
        closure={ticket.closure}
      />

      {view === 'admin' ? (
        <CloseTicketDialog
          ticket={ticket}
          open={closeOpen}
          onOpenChange={setCloseOpen}
          onClosed={setTicket}
        />
      ) : null}

      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        {view === 'admin' && closed ? (
          <Notice icon={Lock} text="This ticket is closed." />
        ) : null}
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

/** The status badge, editable in place: a pencil shows on hover, a click opens the list. */
function EditableStatus({
  status,
  saving,
  onChange,
}: {
  status: TicketStatus
  saving: boolean
  onChange: (status: TicketStatus) => void
}) {
  return (
    <Select
      value={status}
      disabled={saving}
      onValueChange={(value) => {
        if (value !== status) onChange(value as TicketStatus)
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={`Status: ${TICKET_STATUS_LABELS[status]}. Change status`}
        className={cn(
          'group inline-flex shrink-0 cursor-pointer items-center rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:cursor-wait disabled:opacity-60',
          TICKET_STATUS_CLASSES[status],
        )}
      >
        {TICKET_STATUS_LABELS[status]}
        {saving ? (
          <LoaderCircle className="ml-1 size-3 animate-spin" aria-hidden />
        ) : (
          <Pencil
            className="h-3 w-0 opacity-0 transition-all group-hover:ml-1 group-hover:w-3 group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:w-3 group-focus-visible:opacity-100 group-data-[state=open]:ml-1 group-data-[state=open]:w-3 group-data-[state=open]:opacity-100"
            aria-hidden
          />
        )}
      </SelectPrimitive.Trigger>
      <SelectContent position="popper" align="start" sideOffset={6}>
        {TICKET_STATUSES.map((item) => (
          <SelectItem key={item} value={item}>
            {TICKET_STATUS_LABELS[item]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
