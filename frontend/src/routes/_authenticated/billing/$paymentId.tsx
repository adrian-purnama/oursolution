import { createFileRoute } from '@tanstack/react-router'
import InvoiceDetail from '#/components/forms/billing/InvoiceDetail'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/_authenticated/billing/$paymentId')({
  head: () => privatePage(m.seo_invoice()),
  component: InvoicePage,
})

function InvoicePage() {
  const { paymentId } = Route.useParams()
  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-5xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <InvoiceDetail key={paymentId} paymentId={paymentId} />
    </main>
  )
}
