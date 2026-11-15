import { createFileRoute } from '@tanstack/react-router'
import TicketsAdminForm from '#/components/forms/admin/TicketsAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/tickets/')({
  head: () => privatePage('Tickets · Admin'),
  component: AdminTicketsPage,
})

function AdminTicketsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Tickets</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Customers' support tickets, latest activity first.
        </p>
      </div>
      <TicketsAdminForm />
    </div>
  )
}
