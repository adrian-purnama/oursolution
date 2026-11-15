import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { PAYMENT_STATUS_LABELS, formatDateTime, formatIdr } from '#/lib/billing'
import type { Payment, PaymentStatus } from '#/lib/billing'
import { cn } from '#/lib/utils'

const STATUS_CLASSES: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  expired: 'bg-[var(--surface)] text-[var(--muted)]',
  cancelled: 'bg-[var(--surface)] text-[var(--muted)]',
  refunded: 'bg-violet-50 text-violet-700',
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status],
        className,
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}

/** "n8n hosting × 3, Lead scraper" */
export function itemsSummary(payment: Payment): string {
  return payment.items
    .map((item) =>
      item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name,
    )
    .join(', ')
}

/** Payments, newest first. `actions` renders the last cell of each row. */
export function PaymentTable({
  payments,
  actions,
  onOpen,
}: {
  payments: Payment[]
  actions?: (payment: Payment) => ReactNode
  onOpen?: (payment: Payment) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Products</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            {actions ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow
              key={payment.id}
              className={onOpen ? 'cursor-pointer' : undefined}
              onClick={onOpen ? () => onOpen(payment) : undefined}
            >
              <TableCell className="align-top">
                <p className="font-medium">{payment.invoiceNumber}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatDateTime(payment.createdAt)}
                </p>
              </TableCell>
              <TableCell className="max-w-[18rem] align-top">
                <p className="truncate" title={itemsSummary(payment)}>
                  {itemsSummary(payment)}
                </p>
                {payment.needsReview ? (
                  <p className="text-xs text-red-600">Needs review</p>
                ) : null}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {formatIdr(payment.amountIdr)}
              </TableCell>
              <TableCell className="align-top">
                <PaymentStatusBadge status={payment.status} />
              </TableCell>
              {actions ? (
                <TableCell
                  className="text-right align-top"
                  onClick={(event) => event.stopPropagation()}
                >
                  {actions(payment)}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
