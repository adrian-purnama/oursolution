import { createFileRoute } from '@tanstack/react-router'
import PaymentsAdminForm from '#/components/forms/admin/PaymentsAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/payments')({
  head: () => privatePage('Payments · Admin'),
  component: AdminPaymentsPage,
})

function AdminPaymentsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Payments</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Every customer's invoices, newest first.
        </p>
      </div>
      <PaymentsAdminForm />
    </div>
  )
}
