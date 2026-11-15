import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle, ReceiptText } from 'lucide-react'
import { PaymentTable } from '#/components/forms/billing/PaymentParts'
import ListPagination from '#/components/forms/shared/ListPagination'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import type { PaymentList } from '#/lib/billing'

const PAGE_SIZE = 20

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: PaymentList }

/** The signed-in user's invoices, newest first. */
export default function BillingHistory() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [state, setState] = useState<State>({ status: 'loading' })

  async function load(target: number) {
    setState({ status: 'loading' })
    try {
      const res = await apiFetch<PaymentList>(
        `/me/payments?page=${target}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success || !res.data) {
        setState({
          status: 'error',
          message: res.message || 'Could not load your invoices',
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
  }, [page])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading invoices…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        <Button type="button" variant="outline" onClick={() => void load(page)}>
          Retry
        </Button>
      </div>
    )
  }

  if (state.list.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
        <ReceiptText
          className="mx-auto mb-3 size-6 text-[var(--muted)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--ink)]">No invoices yet</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Invoices appear here after your first checkout.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/pricing">Browse the shop</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PaymentTable
        payments={state.list.items}
        onOpen={(payment) =>
          void navigate({
            to: '/billing/$paymentId',
            params: { paymentId: payment.id },
          })
        }
      />
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
  )
}
