import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, ReceiptText, Search } from 'lucide-react'
import InvoiceDetail from '#/components/forms/billing/InvoiceDetail'
import { PaymentTable } from '#/components/forms/billing/PaymentParts'
import ListPagination from '#/components/forms/shared/ListPagination'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { apiFetch } from '#/lib/api'
import { PAYMENT_GROUPS } from '#/lib/billing'
import type { AdminPaymentList, Payment, PaymentGroup } from '#/lib/billing'
import { hintClassName, inputClassName } from '#/lib/ui-classes'
import { useDebouncedValue } from '#/lib/useDebouncedValue'
import { cn } from '#/lib/utils'

const PAGE_SIZE = 20

type State =
  | { status: 'loading'; list: AdminPaymentList | null }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: AdminPaymentList }

/** Admin: every customer's payments, filtered by status and email. */
export default function PaymentsAdminForm() {
  const [group, setGroup] = useState<PaymentGroup>('all')
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query.trim(), 300)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<State>({ status: 'loading', list: null })
  const [open, setOpen] = useState<Payment | null>(null)
  const latest = useRef(0)

  async function load() {
    const request = ++latest.current
    // Keep the last list on screen while the next one loads.
    setState((prev) => ({
      status: 'loading',
      list: prev.status === 'error' ? null : prev.list,
    }))
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (group !== 'all') params.set('status', group)
    if (search) params.set('search', search)
    try {
      const res = await apiFetch<AdminPaymentList>(`/admin/payments?${params}`)
      // A newer filter or page was asked for meanwhile: drop this answer.
      if (request !== latest.current) return
      if (!res.success || !res.data) {
        setState({
          status: 'error',
          message: res.message || 'Could not load payments',
        })
        return
      }
      setState({ status: 'ready', list: res.data })
    } catch {
      if (request !== latest.current) return
      setState({ status: 'error', message: 'Unable to reach the server' })
    }
  }

  useEffect(() => {
    void load()
  }, [group, search, page])

  const list = state.status === 'error' ? null : state.list

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Search email or invoice number…"
          aria-label="Search payments"
          className={cn(inputClassName, 'w-full pl-10')}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
        {PAYMENT_GROUPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={group === key}
            title={
              key === 'closed' ? 'Failed, expired and cancelled' : undefined
            }
            onClick={() => {
              setGroup(key)
              setPage(1)
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              group === key
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]/40',
            )}
          >
            {label}
            {list ? (
              <span className="ml-1.5 tabular-nums opacity-60">
                {list.counts[key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {state.status === 'error' ? (
        <div className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-[var(--muted)]">{state.message}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !list ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted)]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading payments…
        </div>
      ) : list.total === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center sm:py-12">
          <ReceiptText
            className="mx-auto mb-3 size-6 text-[var(--muted)]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--ink)]">
            {list.counts.all === 0 && !search
              ? 'No payments yet'
              : 'No payment matches'}
          </p>
          <p className={`mt-1 ${hintClassName}`}>
            {list.counts.all === 0 && !search
              ? 'Payments show here once a customer checks out.'
              : 'Try another status or search.'}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'space-y-4 transition-opacity',
            state.status === 'loading' && 'opacity-60',
          )}
          aria-busy={state.status === 'loading'}
        >
          <PaymentTable payments={list.items} onOpen={setOpen} showCustomer />
          <ListPagination
            page={list.page}
            pageSize={list.pageSize}
            totalItems={list.total}
            totalPages={Math.max(1, Math.ceil(list.total / list.pageSize))}
            onPageChange={setPage}
          />
        </div>
      )}

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(null)
            // The dialog may have checked the status: show what it found.
            void load()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Invoice</DialogTitle>
          </DialogHeader>
          {open ? <InvoiceDetail paymentId={open.id} admin /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
