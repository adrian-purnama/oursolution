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
  formatIdr,
  periodLabel,
} from '#/lib/billing'
import type { Payment } from '#/lib/billing'
import { cn } from '#/lib/utils'

/** While unpaid, ask the server (which asks Midtrans) this often. */
const POLL_MS = 4000

type State =
  | { status: 'loading' }
  | { status: 'missing'; message: string }
  | { status: 'ready'; payment: Payment }

function paidWith(payment: Payment): string {
  if (payment.paymentType) return payment.paymentType.replace(/_/g, ' ')
  return payment.provider === 'midtrans' ? 'Midtrans' : payment.provider
}

/** One line under the invoice number: when it was issued and how it stands. */
function metaLine(payment: Payment): string {
  const issued = `Issued ${formatDateTime(payment.createdAt)}`
  const who = payment.user ? ` · ${payment.user.email}` : ''
  if (payment.status === 'paid' && payment.paidAt) {
    return `${issued} · Paid ${formatDateTime(payment.paidAt)} with ${paidWith(payment)}${who}`
  }
  if (payment.status === 'pending') {
    return `${issued} · Pay before ${formatDateTime(payment.expiresAt)}${who}`
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
          message: res.message || 'Invoice not found',
        })
        return
      }
      const payment = res.data
      if (
        !admin &&
        lastStatus.current === 'pending' &&
        payment.status === 'paid'
      ) {
        toast.success('Payment received. Your products are active.')
        void refreshAuth()
      }
      lastStatus.current = payment.status
      setState({ status: 'ready', payment })
    } catch {
      if (!quiet) toast.error('Unable to reach the server')
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
      toast.error(error instanceof Error ? error.message : 'Could not download')
    } finally {
      setDownloading(false)
    }
  }

  async function cancel() {
    setCancelling(true)
    try {
      const res = await apiFetch<Payment>(`${base}/cancel`, { method: 'POST' })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Could not cancel the invoice')
        return
      }
      lastStatus.current = res.data.status
      setState({ status: 'ready', payment: res.data })
      setConfirmCancel(false)
      toast.success('Invoice cancelled')
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setCancelling(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading invoice…
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
              All invoices
            </Link>
          </Button>
        )}
      </div>
    )
  }

  const { payment } = state
  const payHere = !admin && payment.status === 'pending'

  return (
    <div className="space-y-8">
      {admin ? null : (
        <Link
          to="/profile"
          search={{ tab: 'billing' }}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] no-underline hover:text-[var(--ink)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Billing
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-[var(--ink)]">
              {payment.invoiceNumber}
            </h2>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)] first-letter:uppercase">
            {metaLine(payment)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              Check status
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            onClick={() => void download(payment)}
          >
            {downloading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Invoice PDF
          </Button>
        </div>
      </div>

      {payment.needsReview && payment.reviewNote ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {admin
            ? payment.reviewNote
            : 'Something about this payment needs a check by our team. We will be in touch.'}
        </p>
      ) : null}

      <div
        className={cn(
          'grid gap-8',
          payHere && 'lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start',
        )}
      >
        <div className="space-y-5">
          {payHere ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <LoaderCircle
                  className="size-4 animate-spin text-amber-600"
                  aria-hidden
                />
                Waiting for your payment
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[var(--muted)]"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel invoice
              </Button>
            </div>
          ) : null}

          <ItemsTable payment={payment} />

          {!admin && payment.status === 'paid' ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
              {payment.grantedAt ? (
                <CircleCheck className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              )}
              {payment.grantedAt
                ? 'Added to your account.'
                : 'Adding to your account…'}
              {payment.grantedAt ? (
                <Link
                  to="/profile"
                  search={{ tab: 'products' }}
                  className="text-[var(--ink)] underline-offset-4 hover:underline"
                >
                  View your products
                </Link>
              ) : null}
            </p>
          ) : null}

          {payment.status !== 'pending' && payment.status !== 'paid' ? (
            <p className="text-sm text-[var(--muted)]">
              {payment.status === 'refunded'
                ? 'This payment was refunded.'
                : payment.failureReason
                  ? `Not paid: ${payment.failureReason}`
                  : 'Not paid. Nothing was charged.'}
            </p>
          ) : null}
        </div>

        {payHere ? (
          <section
            aria-label="Pay"
            className="overflow-hidden rounded-xl border border-[var(--line)] bg-white"
          >
            {payment.snapToken || payment.redirectUrl ? (
              <SnapEmbed
                token={payment.snapToken}
                redirectUrl={payment.redirectUrl}
                onChange={() => void load(true)}
              />
            ) : (
              <p className="p-5 text-sm text-[var(--muted)]">
                This invoice can no longer be paid.
              </p>
            )}
          </section>
        ) : null}
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {payment.invoiceNumber}?</DialogTitle>
            <DialogDescription>
              You won’t be able to pay this invoice anymore. If you already paid
              at Midtrans, your products are still activated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCancel(false)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void cancel()}
            >
              {cancelling ? 'Cancelling…' : 'Cancel invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ItemsTable({ payment }: { payment: Payment }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
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
                      ? 'One-time purchase'
                      : periodLabel(item.quantity, item.durationDays)}
                  </p>
                )}
                {item.description ? (
                  <p className="mt-0.5 max-w-md text-xs whitespace-pre-line text-[var(--muted)]">
                    {item.description}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIdr(item.unitPriceIdr)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatIdr(item.amountIdr)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-right font-medium">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatIdr(payment.amountIdr)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
