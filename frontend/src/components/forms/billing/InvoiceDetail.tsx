import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import {
  AlertCircle,
  ArrowLeft,
  CircleCheck,
  Download,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { PaymentStatusBadge } from '#/components/forms/billing/PaymentParts'
import PaddlePay from '#/components/forms/billing/PaddlePay'
import SnapEmbed from '#/components/forms/billing/SnapEmbed'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import {
  downloadInvoice,
  formatDateTime,
  formatMoney,
  periodLabel,
} from '#/lib/billing'
import type { Payment } from '#/lib/billing'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** While unpaid, ask the server (which asks Midtrans) this often. */
const POLL_MS = 4000

type State =
  | { status: 'loading' }
  | { status: 'missing'; message: string }
  | { status: 'ready'; payment: Payment }

function paidWith(payment: Payment): string {
  if (payment.paymentType) return payment.paymentType.replace(/_/g, ' ')
  if (payment.provider === 'paddle') return 'Paddle'
  return payment.provider === 'midtrans' ? 'Midtrans' : payment.provider
}

/** One line under the invoice number: when it was issued and how it stands. */
function metaLine(payment: Payment): string {
  const issued = m.invoice_issued({ date: formatDateTime(payment.createdAt) })
  const who = payment.user ? ` · ${payment.user.email}` : ''
  if (payment.status === 'paid' && payment.paidAt) {
    return `${issued} · ${m.invoice_paid({
      date: formatDateTime(payment.paidAt),
      method: paidWith(payment),
    })}${who}`
  }
  if (payment.status === 'pending') {
    return `${issued} · ${m.invoice_pay_before({
      date: formatDateTime(payment.expiresAt),
    })}${who}`
  }
  return `${issued}${who}`
}

/**
 * One invoice: its products and total. While unpaid, Midtrans' payment form
 * sits next to it and the page updates by itself once paid. Admins see any
 * user's invoice, read-only.
 */
export default function InvoiceDetail({
  paymentId,
  admin = false,
}: {
  paymentId: string
  admin?: boolean
}) {
  const { refreshAuth } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const lastStatus = useRef<Payment['status'] | null>(null)
  const base = admin
    ? `/admin/payments/${paymentId}`
    : `/me/payments/${paymentId}`

  async function load(quiet = false) {
    if (!quiet) setRefreshing(true)
    try {
      const res = await apiFetch<Payment>(base)
      if (!res.success || !res.data) {
        setState({
          status: 'missing',
          message: res.message || m.invoice_not_found(),
        })
        return
      }
      const payment = res.data
      if (
        !admin &&
        lastStatus.current === 'pending' &&
        payment.status === 'paid'
      ) {
        toast.success(m.invoice_paid_toast())
        void refreshAuth()
      }
      lastStatus.current = payment.status
      setState({ status: 'ready', payment })
    } catch {
      if (!quiet) toast.error(m.common_error_network_short())
    } finally {
      if (!quiet) setRefreshing(false)
    }
  }

  useEffect(() => {
    lastStatus.current = null
    setState({ status: 'loading' })
    void load(true)
  }, [base])

  const pending = state.status === 'ready' && state.payment.status === 'pending'
  // Also wait for granting to finish, so "active" is true when shown.
  const granting =
    state.status === 'ready' &&
    state.payment.status === 'paid' &&
    !state.payment.grantedAt
  useEffect(() => {
    if ((!pending && !granting) || admin) return
    const timer = window.setInterval(() => void load(true), POLL_MS)
    return () => window.clearInterval(timer)
  }, [pending, granting, admin, base])

  async function download(payment: Payment) {
    setDownloading(true)
    try {
      await downloadInvoice(
        `${base}/invoice.pdf`,
        `${payment.invoiceNumber}.pdf`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : m.invoice_download_failed(),
      )
    } finally {
      setDownloading(false)
    }
  }

  async function cancel() {
    setCancelling(true)
    try {
      const res = await apiFetch<Payment>(`${base}/cancel`, { method: 'POST' })
      if (!res.success || !res.data) {
        toast.error(res.message || m.invoice_cancel_failed())
        return
      }
      lastStatus.current = res.data.status
      setState({ status: 'ready', payment: res.data })
      setConfirmCancel(false)
      toast.success(m.invoice_cancelled())
    } catch {
      toast.error(m.common_error_network_short())
    } finally {
      setCancelling(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {m.invoice_loading()}
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className="flex flex-col items-start gap-3 py-12">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        {admin ? null : (
          <Button asChild variant="outline">
            <Link to="/profile" search={{ tab: 'billing' }}>
              {m.invoice_all()}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  const { payment } = state
  const payHere = !admin && payment.status === 'pending'

  return (
    <div className="space-y-5 sm:space-y-8">
      {admin ? null : (
        <Link
          to="/profile"
          search={{ tab: 'billing' }}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] no-underline hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {m.invoice_back()}
        </Link>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-xl text-[var(--ink)] sm:text-2xl">
              {payment.invoiceNumber}
            </h2>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)] first-letter:uppercase">
            {metaLine(payment)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {admin ? (
            <Button
              type="button"
              variant="ghost"
              disabled={refreshing}
              onClick={() => void load()}
            >
              <RefreshCw
                className={refreshing ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden
              />
              {m.invoice_check_status()}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            aria-label={m.invoice_download_aria()}
            className="size-9 px-0 sm:size-auto sm:px-4"
            onClick={() => void download(payment)}
          >
            {downloading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            <span className="hidden sm:inline">{m.invoice_pdf()}</span>
          </Button>
        </div>
      </div>

      {payment.needsReview && payment.reviewNote ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {admin ? payment.reviewNote : m.invoice_review_user()}
        </p>
      ) : null}

      <div
        className={cn(
          'grid gap-5 sm:gap-8',
          payHere && 'lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start',
        )}
      >
        <div className="space-y-4 sm:space-y-5">
          <ItemsTable payment={payment} />

          {payHere ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-3 text-[var(--muted)]"
              onClick={() => setConfirmCancel(true)}
            >
              {m.invoice_cancel()}
            </Button>
          ) : null}

          {!admin && payment.status === 'paid' ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
              {payment.grantedAt ? (
                <CircleCheck className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              )}
              {payment.grantedAt ? m.invoice_granted() : m.invoice_granting()}
              {payment.grantedAt ? (
                <Link
                  to="/profile"
                  search={{ tab: 'products' }}
                  className="text-[var(--ink)] underline-offset-4 hover:underline"
                >
                  {m.invoice_view_products()}
                </Link>
              ) : null}
            </p>
          ) : null}

          {payment.status !== 'pending' && payment.status !== 'paid' ? (
            <p className="text-sm text-[var(--muted)]">
              {payment.status === 'refunded'
                ? m.invoice_refunded()
                : payment.failureReason
                  ? m.invoice_not_paid_reason({
                      reason: payment.failureReason,
                    })
                  : m.invoice_not_paid()}
            </p>
          ) : null}
        </div>

        {payHere ? (
          <section
            aria-label={m.invoice_pay_aria()}
            className="order-first overflow-hidden rounded-xl border border-[var(--line)] bg-white lg:order-none"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
              <p className="text-sm font-medium text-[var(--ink)]">
                {m.invoice_pay_amount({
                  amount: formatMoney(payment.amountIdr, payment.currency),
                })}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-amber-700">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                {m.invoice_waiting()}
              </p>
            </div>
            {payment.paddleTransactionId ? (
              <PaddlePay
                transactionId={payment.paddleTransactionId}
                amount={formatMoney(payment.amountIdr, payment.currency)}
                onChange={() => void load(true)}
              />
            ) : payment.snapToken || payment.redirectUrl ? (
              <SnapEmbed
                token={payment.snapToken}
                redirectUrl={payment.redirectUrl}
                onChange={() => void load(true)}
              />
            ) : (
              <p className="p-5 text-sm text-[var(--muted)]">
                {m.invoice_no_longer()}
              </p>
            )}
          </section>
        ) : null}
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.invoice_cancel_title({ number: payment.invoiceNumber })}
            </DialogTitle>
            <DialogDescription>{m.invoice_cancel_copy()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCancel(false)}
            >
              {m.invoice_keep()}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void cancel()}
            >
              {cancelling ? m.invoice_cancelling() : m.invoice_cancel()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ItemsTable({ payment }: { payment: Payment }) {
  const money = (value: number) => formatMoney(value, payment.currency)
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.invoice_col_item()}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {m.invoice_col_qty()}
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {m.invoice_col_unit()}
            </TableHead>
            <TableHead className="text-right">
              {m.invoice_col_amount()}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payment.items.map((item, index) => (
            <TableRow key={item.productId ?? `custom-${index}`}>
              <TableCell className="whitespace-normal">
                <p className="font-medium">{item.name}</p>
                {item.kind === 'custom' ? null : (
                  <p className="text-xs text-[var(--muted)]">
                    {item.kind === 'oneTime'
                      ? m.product_kind_onetime()
                      : periodLabel(item.quantity, item.durationDays)}
                  </p>
                )}
                {item.quantity > 1 ? (
                  <p className="text-xs text-[var(--muted)] tabular-nums sm:hidden">
                    {item.quantity} × {money(item.unitPriceIdr)}
                  </p>
                ) : null}
                {item.description ? (
                  <p className="mt-0.5 max-w-md text-xs whitespace-pre-line text-[var(--muted)]">
                    {item.description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {item.quantity}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {money(item.unitPriceIdr)}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {money(item.amountIdr)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="hidden sm:table-cell" />
            <TableCell className="text-right font-medium">
              {m.common_total()}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {money(payment.amountIdr)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
