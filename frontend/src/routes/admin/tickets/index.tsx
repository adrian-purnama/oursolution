import { createFileRoute } from '@tanstack/react-router'
import TicketsAdminForm from '#/components/forms/admin/TicketsAdminForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/tickets/')({
  head: () => privatePage('Tickets · Admin'),
  component: AdminTicketsPage,
})

function AdminTicketsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Tickets</h1>
      </div>
      <TicketsAdminForm />
    </div>
  )
}
