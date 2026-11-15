import { Fragment, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ImagePlus, LoaderCircle, Send, Sparkles, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { toAbsoluteMediaUrl } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import {
  BODY_MAX,
  TICKET_STATUS_CLASSES,
  TICKET_STATUS_LABELS,
  imageProblem,
} from '#/lib/ticket'
import type { TicketClosure, TicketMessage, TicketStatus } from '#/lib/ticket'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs',
        TICKET_STATUS_CLASSES[status],
      )}
    >
      {TICKET_STATUS_LABELS[status]}
    </span>
  )
}

/** Characters used of the limit; turns red past it. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const used = [...value.trim()].length
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        used > max ? 'text-[var(--destructive)]' : 'text-[var(--muted)]',
      )}
    >
      {used}/{max}
    </span>
  )
}

/** One optional photo: checked on pick, previewed, removable. */
export function ImagePicker({
  file,
  onChange,
  disabled,
}: {
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(picked: File | null) {
    if (inputRef.current) inputRef.current.value = ''
    if (!picked) return
    const reason = imageProblem(picked)
    setProblem(reason)
    onChange(reason ? null : picked)
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Photo to send"
            className="max-h-40 rounded-md border border-[var(--line)] object-contain"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="absolute top-1.5 right-1.5 bg-white"
            aria-label="Remove the photo"
            disabled={disabled}
            onClick={() => {
              setProblem(null)
              onChange(null)
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden />
          Add a photo
        </Button>
      )}
      <p
        className={cn(
          'text-xs',
          problem ? 'text-[var(--destructive)]' : 'text-[var(--muted)]',
        )}
        role={problem ? 'alert' : undefined}
      >
        {problem ?? 'Optional. One JPEG, PNG or WebP, up to 2 MB.'}
      </p>
    </div>
  )
}

/**
 * A message box with an optional photo. `onSend` returns true when the
 * message went through, which clears the box.
 */
export function MessageComposer({
  label,
  placeholder,
  submitLabel,
  hint,
  onSend,
}: {
  label: string
  placeholder: string
  submitLabel: string
  hint?: string
  onSend: (body: string, image: File | null) => Promise<boolean>
}) {
  const id = useId()
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const length = [...body.trim()].length
    if (length === 0) {
      setError('Write a message first')
      return
    }
    if (length > BODY_MAX) {
      setError(`The message must be at most ${BODY_MAX} characters`)
      return
    }
    setError(null)
    setSending(true)
    try {
      if (await onSend(body, image)) {
        setBody('')
        setImage(null)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit} noValidate>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id}>{label}</Label>
          <CharCount value={body} max={BODY_MAX} />
        </div>
        <Textarea
          id={id}
          rows={4}
          value={body}
          placeholder={placeholder}
          disabled={sending}
          aria-invalid={error ? true : undefined}
          className="bg-white"
          onChange={(event) => setBody(event.target.value)}
        />
        {error ? (
          <p className="text-xs text-[var(--destructive)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <ImagePicker file={image} onChange={setImage} disabled={sending} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs ${hintClassName}`}>{hint}</p>
        <Button type="submit" disabled={sending}>
          {sending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Send aria-hidden />
          )}
          {sending ? 'Sending…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/**
 * The conversation, oldest first. The viewer's side sits on the right.
 * Text is rendered as text, never as HTML.
 */
export function TicketThread({
  messages,
  viewer,
  closure,
}: {
  messages: TicketMessage[]
  viewer: 'customer' | 'admin'
  /** Shown where the ticket was closed, just before that status change. */
  closure?: TicketClosure | null
}) {
  const closedAt = closure ? Date.parse(closure.closedAt) : null
  let at =
    closedAt === null
      ? -1
      : messages.findIndex((entry) => Date.parse(entry.createdAt) >= closedAt)
  if (closure && at === -1) at = messages.length
  return (
    <ol className="space-y-4" aria-label="Conversation">
      {messages.map((message, index) => (
        <Fragment key={message.id}>
          {closure && index === at ? (
            <ClosureCard closure={closure} viewer={viewer} />
          ) : null}
          <ThreadEntry message={message} viewer={viewer} />
        </Fragment>
      ))}
      {closure && at === messages.length ? (
        <ClosureCard closure={closure} viewer={viewer} />
      ) : null}
    </ol>
  )
}

/** Product (admins only), then the summary and/or resolution, as plain text. */
function ClosureCard({
  closure,
  viewer,
}: {
  closure: TicketClosure
  viewer: 'customer' | 'admin'
}) {
  return (
    <li className="space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
      <p className={`text-xs ${hintClassName}`}>
        Closed {formatDateTime(closure.closedAt)}
        {viewer === 'admin' ? (
          <>
            {' · '}Product:{' '}
            <span className="font-medium text-[var(--ink)]">
              {closure.productName ?? 'Other'}
            </span>
          </>
        ) : null}
      </p>
      {closure.summary ? (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink)]">
            <Sparkles className="size-3.5 text-[var(--muted)]" aria-hidden />
            Summary
          </p>
          <p className="break-words whitespace-pre-wrap">{closure.summary}</p>
          <p className={`text-xs ${hintClassName}`}>
            Written by AI. The conversation before this point was replaced by
            this summary.
          </p>
        </div>
      ) : null}
      {closure.resolution ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--ink)]">Resolution</p>
          <p className="break-words whitespace-pre-wrap">
            {closure.resolution}
          </p>
        </div>
      ) : null}
    </li>
  )
}

function ThreadEntry({
  message,
  viewer,
}: {
  message: TicketMessage
  viewer: 'customer' | 'admin'
}) {
  if (message.kind === 'status') {
    return (
      <li
        key={message.id}
        className={`flex items-center gap-3 text-xs ${hintClassName}`}
      >
        <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
        <span>
          {viewer === 'admin' && message.senderEmail
            ? message.senderEmail
            : 'Support'}{' '}
          changed the status to{' '}
          <strong className="font-medium text-[var(--ink)]">
            {message.toStatus ? TICKET_STATUS_LABELS[message.toStatus] : '—'}
          </strong>{' '}
          · {formatDateTime(message.createdAt)}
        </span>
        <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
      </li>
    )
  }
  const mine =
    viewer === 'customer'
      ? message.senderRole === 'user'
      : message.senderRole === 'admin'
  const who =
    message.senderRole === 'admin'
      ? viewer === 'admin'
        ? `Support · ${message.senderEmail ?? 'admin'}`
        : 'Support'
      : viewer === 'customer'
        ? 'You'
        : (message.senderEmail ?? 'Customer')
  const image = toAbsoluteMediaUrl(message.imageUrl)
  return (
    <li
      key={message.id}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%]',
          mine
            ? 'rounded-br-md bg-[var(--accent)] text-white shadow-[0_1px_2px_rgba(19,94,245,0.25)]'
            : 'rounded-bl-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]',
        )}
      >
        <p
          className={cn(
            'mb-1 text-xs',
            mine ? 'text-white/75' : 'text-[var(--muted)]',
          )}
        >
          <span
            className={cn(
              'font-medium',
              mine ? 'text-white' : 'text-[var(--ink)]',
            )}
          >
            {who}
          </span>{' '}
          · {formatDateTime(message.createdAt)}
        </p>
        <p className="text-sm break-words whitespace-pre-wrap">
          {message.body}
        </p>
        {image ? (
          <a
            href={image}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 block"
          >
            <img
              src={image}
              alt="Attached photo"
              loading="lazy"
              referrerPolicy="no-referrer"
              className={cn(
                'max-h-72 rounded-md border bg-white object-contain',
                mine ? 'border-white/30' : 'border-[var(--line)]',
              )}
            />
          </a>
        ) : null}
      </div>
    </li>
  )
}
