import { useEffect, useState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import CreateInvoiceDialog from '#/components/forms/admin/CreateInvoiceDialog'
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
import type { Payment, PaymentList } from '#/lib/billing'
import { hintClassName } from '#/lib/ui-classes'

const PAGE_SIZE = 20

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: PaymentList }

/** Admin: a user's invoices and payments; open one for details and its PDF. */
export default function UserPaymentsForm({ userId }: { userId: string }) {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [open, setOpen] = useState<Payment | null>(null)
  const [creating, setCreating] = useState(false)

  async function load(target: number) {
    setState({ status: 'loading' })
    try {
      const res = await apiFetch<PaymentList>(
        `/admin/users/${userId}/payments?page=${target}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success || !res.data) {
        setState({
          status: 'error',
          message: res.message || 'Could not load payments',
        })
        return
      }
      setState({ status: 'ready', list: res.data })
    } catch {
      setState({ status: 'error', message: 'Unable to reach the server' })
    }
  }

  useEffect(() => {
    void load(page)
  }, [userId, page])

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Payments</h2>
          <p className={hintClassName}>Checkouts and invoices.</p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          New invoice
        </Button>
      </div>

      {state.status === 'loading' ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted)]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading payments…
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-[var(--muted)]">{state.message}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load(page)}
          >
            Retry
          </Button>
        </div>
      ) : state.list.total === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center text-sm text-[var(--muted)]">
          No payments yet.
        </p>
      ) : (
        <div className="space-y-4">
          <PaymentTable payments={state.list.items} onOpen={setOpen} />
          <ListPagination
            page={state.list.page}
            pageSize={state.list.pageSize}
            totalItems={state.list.total}
            totalPages={Math.max(
              1,
              Math.ceil(state.list.total / state.list.pageSize),
            )}
            onPageChange={setPage}
          />
        </div>
      )}

      <CreateInvoiceDialog
        userId={userId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(payment) => {
          setCreating(false)
          setPage(1)
          void load(1)
          setOpen(payment)
        }}
      />

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(null)
            // The dialog may have checked the status: show what it found.
            void load(page)
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
    </section>
  )
}
