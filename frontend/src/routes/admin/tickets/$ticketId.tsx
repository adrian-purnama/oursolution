import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import TicketDetail from '#/components/forms/ticket/TicketDetail'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/admin/tickets/$ticketId')({
  component: AdminTicketPage,
})

function AdminTicketPage() {
  const { ticketId } = Route.useParams()
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <Link
        to="/admin/tickets"
        className={`mb-6 inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        All tickets
      </Link>
      <TicketDetail key={ticketId} ticketId={ticketId} view="admin" />
    </div>
  )
}
