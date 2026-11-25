import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle, Search } from 'lucide-react'
import ListPagination from '#/components/forms/shared/ListPagination'
import { TicketStatusBadge } from '#/components/forms/ticket/TicketParts'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { apiFetch } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import {
  MAX_FOLLOWUPS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  shortTicketId,
} from '#/lib/ticket'
import type { TicketPage, TicketStatus } from '#/lib/ticket'
import { useDebouncedValue } from '#/lib/useDebouncedValue'
import { cardClassName, hintClassName, inputClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

type Filter = TicketStatus | 'all'

/** Every customer's tickets, latest activity first. */
export default function TicketsAdminForm() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query, 250)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TicketPage | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => setPage(1), [filter, search])

  const load = useCallback(async () => {
    setState('loading')
    const params = new URLSearchParams({ page: String(page) })
    if (filter !== 'all') params.set('status', filter)
    if (search.trim()) params.set('q', search.trim())
    try {
      const response = await apiFetch<TicketPage>(
        `/admin/tickets?${params.toString()}`,
      )
      if (!response.success || !response.data) {
        setState('error')
        return
      }
      setData(response.data)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [filter, search, page])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
        {(['all', ...TICKET_STATUSES] as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              filter === option
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]',
            )}
          >
            {option === 'all' ? 'All' : TICKET_STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subject or customer email…"
          aria-label="Search subject or customer email"
          className={cn(inputClassName, 'pl-10')}
          autoComplete="off"
        />
      </div>

      {state === 'loading' && !data ? (
        <div className={`flex items-center gap-2 py-4 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading tickets…
        </div>
      ) : state === 'error' ? (
        <div className={`${cardClassName} px-4 py-8 text-center`}>
          <p className={`mb-3 ${hintClassName}`}>
            Tickets could not be loaded.
          </p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !data || data.total === 0 ? (
        <p
          className={`${cardClassName} px-4 py-8 text-center ${hintClassName}`}
        >
          {search.trim() || filter !== 'all'
            ? 'No tickets match.'
            : 'No tickets yet.'}
        </p>
      ) : (
        <>
          <ul
            className={`${cardClassName} divide-y divide-[var(--line)] overflow-hidden sm:hidden`}
          >
            {data.items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to="/admin/tickets/$ticketId"
                  params={{ ticketId: ticket.id }}
                  className="flex items-start gap-3 px-4 py-3 text-[var(--ink)] no-underline active:bg-[var(--surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ticket.subject}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {ticket.user?.email ?? '—'} ·{' '}
                      {formatDateTime(ticket.updatedAt)}
                    </p>
                    {ticket.status !== 'closed' &&
                    ticket.followupCount >= MAX_FOLLOWUPS ? (
                      <p className="text-xs text-amber-700">
                        Waiting for a reply
                      </p>
                    ) : null}
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
          <div className={`${cardClassName} hidden overflow-x-auto sm:block`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer"
                    onClick={() =>
                      void navigate({
                        to: '/admin/tickets/$ticketId',
                        params: { ticketId: ticket.id },
                      })
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      {shortTicketId(ticket.id)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {ticket.user?.email ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-72">
                      <Link
                        to="/admin/tickets/$ticketId"
                        params={{ ticketId: ticket.id }}
                        className="block truncate text-[var(--ink)] no-underline hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {ticket.subject}
                      </Link>
                      {ticket.status !== 'closed' &&
                      ticket.followupCount >= MAX_FOLLOWUPS ? (
                        <span className="text-xs text-amber-700">
                          Waiting for a reply
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className={`whitespace-nowrap ${hintClassName}`}>
                      {formatDateTime(ticket.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={data.page}
            totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
            totalItems={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
