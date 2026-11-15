import { createFileRoute } from '@tanstack/react-router'
import InvoiceDetail from '#/components/forms/billing/InvoiceDetail'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/_authenticated/billing/$paymentId')({
  head: () => privatePage('Invoice'),
  component: InvoicePage,
})

function InvoicePage() {
  const { paymentId } = Route.useParams()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-5xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <InvoiceDetail key={paymentId} paymentId={paymentId} />
    </main>
  )
}
