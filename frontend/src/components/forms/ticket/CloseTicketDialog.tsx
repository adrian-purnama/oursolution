import { useEffect, useId, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'
import { CharCount } from '#/components/forms/ticket/TicketParts'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import type { Product } from '#/lib/product'
import { RESOLUTION_MAX, shortTicketId } from '#/lib/ticket'
import type { CloseTicketResult, Ticket } from '#/lib/ticket'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** The combobox value for "Other" (no product). */
const OTHER = 'other'

/**
 * Closing a ticket: product, resolution, and optionally an AI summary that
 * replaces the thread. Nothing changes until a close button is pressed;
 * while it runs the dialog cannot be dismissed.
 */
export default function CloseTicketDialog({
  ticket,
  open,
  onOpenChange,
  onClosed,
}: {
  ticket: Ticket
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed: (ticket: Ticket) => void
}) {
  const resolutionId = useId()
  const productId = useId()
  const [product, setProduct] = useState(OTHER)
  const [resolution, setResolution] = useState('')
  const [running, setRunning] = useState<'plain' | 'summary' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A fresh form each time it opens.
  useEffect(() => {
    if (!open) return
    setProduct(OTHER)
    setResolution('')
    setError(null)
  }, [open])

  const busy = running !== null
  const messageCount = ticket.messages.filter(
    (entry) => entry.kind === 'message',
  ).length

  async function submit(summarize: boolean) {
    const length = [...resolution.trim()].length
    if (length === 0) {
      setError('Write the resolution first')
      return
    }
    if (length > RESOLUTION_MAX) {
      setError(`The resolution must be at most ${RESOLUTION_MAX} characters`)
      return
    }
    setError(null)
    setRunning(summarize ? 'summary' : 'plain')
    try {
      const response = await apiFetch<CloseTicketResult>(
        `/admin/tickets/${ticket.id}/close`,
        {
          method: 'POST',
          body: JSON.stringify({
            productId: product === OTHER ? null : product,
            resolution,
            summarize,
          }),
        },
      )
      if (!response.success || !response.data) {
        setError(response.message || 'The ticket could not be closed')
        return
      }
      const { ticket: closed, summarized } = response.data
      toast.success(
        !summarize
          ? 'Ticket closed'
          : summarized
            ? 'Ticket closed and summarized'
            : 'Ticket closed. Summary failed, so the thread was kept.',
      )
      onClosed(closed)
      onOpenChange(false)
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Close ticket</DialogTitle>
          <DialogDescription>
            Record what the ticket was about and how it was resolved.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
          <dt className={hintClassName}>Ticket</dt>
          <dd className="tabular-nums">{shortTicketId(ticket.id)}</dd>
          <dt className={hintClassName}>Customer</dt>
          <dd className="min-w-0 truncate">{ticket.user?.email ?? '—'}</dd>
          <dt className={hintClassName}>Subject</dt>
          <dd className="min-w-0 break-words">{ticket.subject}</dd>
          <dt className={hintClassName}>Opened</dt>
          <dd>{formatDateTime(ticket.createdAt)}</dd>
          <dt className={hintClassName}>Messages</dt>
          <dd className="tabular-nums">{messageCount}</dd>
        </dl>

        <div className="space-y-1.5">
          <Label htmlFor={productId}>Product</Label>
          <ProductPicker
            id={productId}
            value={product}
            onChange={setProduct}
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor={resolutionId}>Resolution</Label>
            <CharCount value={resolution} max={RESOLUTION_MAX} />
          </div>
          <Textarea
            id={resolutionId}
            rows={5}
            value={resolution}
            disabled={busy}
            placeholder="What was the problem, and how was it solved?"
            aria-invalid={error ? true : undefined}
            className="bg-white"
            onChange={(event) => setResolution(event.target.value)}
          />
          <p className={`text-xs ${hintClassName}`}>
            The resolution is emailed to the customer.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="sm:items-start">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void submit(false)}
          >
            {running === 'plain' ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : null}
            Close ticket
          </Button>
          <div className="flex flex-col gap-1.5 sm:max-w-56">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              {running === 'summary' ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {running === 'summary'
                ? 'Summarizing…'
                : 'Close and replace thread with summary'}
            </Button>
            <p className={`text-xs ${hintClassName}`}>
              Permanently deletes all messages, photos and the resolution. Keeps
              an AI-written summary.
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "Other" first, then every product, hidden and deleted ones included. */
function ProductPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<Product[]>('/admin/products')
      if (!response.success || !response.data) {
        setError(response.message || 'Products could not be loaded')
        return
      }
      setProducts(
        [...response.data].sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch {
      setError('Unable to reach the server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selected = products.find((product) => product.id === value)
  const options = [
    { id: OTHER, name: 'Other', note: 'Not about a product' },
    ...products.map((product) => ({
      id: product.id,
      name: product.name,
      note: product.deletedAt
        ? 'Deleted'
        : product.showOnPricingPage
          ? null
          : 'Not shown to customers',
    })),
  ]

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between bg-white font-normal"
          >
            <span className="truncate">
              {value === OTHER ? 'Other' : (selected?.name ?? 'Other')}
            </span>
            {loading ? (
              <LoaderCircle className="animate-spin opacity-60" aria-hidden />
            ) : (
              <ChevronsUpDown className="opacity-50" aria-hidden />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        >
          <Command>
            <CommandInput placeholder="Search products…" />
            <CommandList>
              <CommandEmpty>No product matches.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    keywords={[option.name]}
                    onSelect={() => {
                      onChange(option.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 self-start',
                        option.id === value ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.name}</span>
                      {option.note ? (
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {option.note}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--destructive)]">
          {error}. Only Other is available.
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </p>
      ) : null}
    </div>
  )
}
