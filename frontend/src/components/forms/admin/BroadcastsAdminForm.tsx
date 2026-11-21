import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Mail } from 'lucide-react'
import BroadcastComposeForm from '#/components/forms/admin/BroadcastComposeForm'
import ListPagination from '#/components/forms/shared/ListPagination'
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
import type { Broadcast, BroadcastList } from '#/lib/broadcast'
import { formatDateTime } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

const PAGE_SIZE = 10
/** How often the log refreshes while an email is still going out. */
const POLL_MS = 3000

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: BroadcastList }

/** Admin: compose an email to many users, and see the ones already sent. */
export default function BroadcastsAdminForm() {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState({ status: 'loading' })
    try {
      const res = await apiFetch<BroadcastList>(
        `/admin/broadcasts?page=${page}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success || !res.data) {
        if (!quiet) {
          setState({
            status: 'error',
            message: res.message || 'Could not load sent emails',
          })
        }
        return
      }
      setState({ status: 'ready', list: res.data })
    } catch {
      if (!quiet) {
        setState({ status: 'error', message: 'Unable to reach the server' })
      } else {
        toast.error('Unable to reach the server')
      }
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const sending =
    state.status === 'ready' &&
    state.list.items.some((item) => item.status === 'sending')

  useEffect(() => {
    if (!sending) return
    const timer = window.setInterval(() => void load(true), POLL_MS)
    return () => window.clearInterval(timer)
  }, [sending, load])

  function handleSent(_broadcast: Broadcast) {
    if (page === 1) void load(true)
    else setPage(1)
  }

  return (
    <div className="space-y-14">
      <BroadcastComposeForm onSent={handleSent} />

      <section className="space-y-4" aria-labelledby="broadcast-log">
        <h2 id="broadcast-log" className="text-base font-medium">
          Sent
        </h2>

        {state.status === 'loading' ? (
          <div className="flex justify-center py-10">
            <LoaderCircle
              className="size-5 animate-spin text-[var(--muted)]"
              aria-label="Loading"
            />
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="space-y-3 py-6 text-sm">
            <p className="text-red-600">{state.message}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        {state.status === 'ready' && state.list.total === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--line)] py-10 text-center">
            <Mail className="size-5 text-[var(--muted)]" aria-hidden />
            <p className={`text-sm ${hintClassName}`}>
              Emails you send show up here.
            </p>
          </div>
        ) : null}

        {state.status === 'ready' && state.list.total > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.list.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-72 align-top">
                        <p className="truncate font-medium">{item.subject}</p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {item.body}
                        </p>
                        {item.inApp ? (
                          <span className="mt-1 inline-block rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                            Also in app
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {item.audienceLabel}
                      </TableCell>
                      <TableCell className="text-right align-top text-sm tabular-nums">
                        {item.status === 'sending' ? (
                          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
                            <LoaderCircle
                              className="size-3.5 animate-spin"
                              aria-hidden
                            />
                            {item.sentCount + item.failedCount} /{' '}
                            {item.recipientCount}
                          </span>
                        ) : (
                          <>
                            {item.sentCount} / {item.recipientCount}
                            {item.failedCount > 0 ? (
                              <span className="block text-xs text-red-600">
                                {item.failedCount} failed
                              </span>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm whitespace-nowrap text-[var(--muted)]">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ListPagination
              page={page}
              totalPages={Math.max(
                1,
                Math.ceil(state.list.total / state.list.pageSize),
              )}
              totalItems={state.list.total}
              pageSize={state.list.pageSize}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </section>
    </div>
  )
}
