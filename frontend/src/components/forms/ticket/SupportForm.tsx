import { useCallback, useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { LifeBuoy, LoaderCircle, Plus } from 'lucide-react'
import ListPagination from '#/components/forms/shared/ListPagination'
import {
  CharCount,
  ImagePicker,
  TicketStatusBadge,
} from '#/components/forms/ticket/TicketParts'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch, apiUpload } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import { BODY_MAX, SUBJECT_MAX, SUBJECT_MIN } from '#/lib/ticket'
import type { Ticket, TicketPage } from '#/lib/ticket'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** The customer's support page: a new-ticket form and their tickets. */
export default function SupportForm() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TicketPage | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [composing, setComposing] = useState(false)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const response = await apiFetch<TicketPage>(`/tickets?page=${page}`)
      if (!response.success || !response.data) {
        setState('error')
        return
      }
      setData(response.data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const empty = state === 'ready' && data?.total === 0

  return (
    <div className="space-y-8">
      {composing || empty ? (
        <NewTicket onCancel={empty ? undefined : () => setComposing(false)} />
      ) : (
        <Button type="button" onClick={() => setComposing(true)}>
          <Plus aria-hidden />
          New ticket
        </Button>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-medium">My tickets</h2>
        {state === 'loading' ? (
          <div className={`flex items-center gap-2 py-4 ${hintClassName}`}>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading tickets…
          </div>
        ) : state === 'error' ? (
          <div className={`${cardClassName} px-4 py-8 text-center`}>
            <p className={`mb-3 ${hintClassName}`}>
              Your tickets could not be loaded.
            </p>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : empty || !data ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
            <LifeBuoy
              className="mx-auto mb-3 size-6 text-[var(--muted)]"
              aria-hidden
            />
            <p className={hintClassName}>
              No tickets yet. Describe your problem above and we will get back
              to you.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {data.items.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to="/support/$ticketId"
                    params={{ ticketId: ticket.id }}
                    className={cn(
                      cardClassName,
                      'flex items-center gap-3 px-4 py-3 no-underline transition hover:border-[var(--ink)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--ink)]">
                        {ticket.subject}
                      </p>
                      <p className={`mt-0.5 text-xs ${hintClassName}`}>
                        Updated {formatDateTime(ticket.updatedAt)}
                      </p>
                    </div>
                    {ticket.unread ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <span
                          aria-hidden
                          className="size-2 rounded-full bg-red-600"
                        />
                        New reply
                      </span>
                    ) : null}
                    <TicketStatusBadge status={ticket.status} />
                  </Link>
                </li>
              ))}
            </ul>
            <ListPagination
              page={data.page}
              totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
              totalItems={data.total}
              pageSize={data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  )
}

function NewTicket({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate()
  const subjectId = useId()
  const descriptionId = useId()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const subjectLength = [...subject.trim()].length
    const descriptionLength = [...description.trim()].length
    if (subjectLength < SUBJECT_MIN || subjectLength > SUBJECT_MAX) {
      setError(
        `The subject must be ${SUBJECT_MIN} to ${SUBJECT_MAX} characters`,
      )
      return
    }
    if (descriptionLength === 0 || descriptionLength > BODY_MAX) {
      setError(`Describe the problem in 1 to ${BODY_MAX} characters`)
      return
    }
    setError(null)
    setSending(true)
    try {
      const form = new FormData()
      form.append('subject', subject)
      form.append('description', description)
      if (image) form.append('image', image)
      const response = await apiUpload<Ticket>('/tickets', form)
      if (!response.success || !response.data) {
        setError(response.message || 'The ticket could not be sent')
        return
      }
      toast.success('Ticket sent')
      await navigate({
        to: '/support/$ticketId',
        params: { ticketId: response.data.id },
      })
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className={`${cardClassName} space-y-4 p-5`}
      onSubmit={submit}
      noValidate
    >
      <h2 className="text-base font-medium">New ticket</h2>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={subjectId}>Subject</Label>
          <CharCount value={subject} max={SUBJECT_MAX} />
        </div>
        <Input
          id={subjectId}
          value={subject}
          placeholder="e.g. My n8n page does not load"
          disabled={sending}
          className="bg-white"
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={descriptionId}>Description</Label>
          <CharCount value={description} max={BODY_MAX} />
        </div>
        <Textarea
          id={descriptionId}
          rows={6}
          value={description}
          placeholder="What happened, what you expected, and what you already tried."
          disabled={sending}
          className="bg-white"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <ImagePicker file={image} onChange={setImage} disabled={sending} />
      {error ? (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={sending}>
          {sending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          {sending ? 'Sending…' : 'Send ticket'}
        </Button>
      </div>
    </form>
  )
}
