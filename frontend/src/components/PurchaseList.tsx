import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import ProductBadge from '#/components/ProductBadge'
import { Button } from '#/components/ui/button'
import { formatDateTime } from '#/lib/product'
import type { Purchase } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** One-time products a user owns, each with its access link when it has one. */
export default function PurchaseList({
  purchases,
  actions,
  emptyText = 'No purchases yet.',
}: {
  purchases: Purchase[]
  /** Extra controls per purchase, e.g. an admin "Take back". */
  actions?: (purchase: Purchase) => ReactNode
  emptyText?: string
}) {
  if (purchases.length === 0) {
    return <p className={hintClassName}>{emptyText}</p>
  }

  return (
    <ul className="space-y-2">
      {purchases.map((purchase) => (
        <li
          key={purchase.purchaseId}
          className={`${cardClassName} flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3`}
        >
          <div className="min-w-0 flex-1">
            <ProductBadge product={purchase.product} />
            <p className={`mt-0.5 text-[11px] ${hintClassName}`}>
              {purchase.source === 'admin' ? 'Given' : 'Bought'}{' '}
              {formatDateTime(purchase.purchasedAt)}
            </p>
          </div>
          {purchase.accessUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={purchase.accessUrl} target="_blank" rel="noreferrer">
                Open
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
          {actions ? actions(purchase) : null}
        </li>
      ))}
    </ul>
  )
}
