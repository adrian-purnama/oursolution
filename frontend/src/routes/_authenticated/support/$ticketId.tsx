import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import TicketDetail from '#/components/forms/ticket/TicketDetail'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/_authenticated/support/$ticketId')({
  head: () => privatePage(m.seo_ticket()),
  component: SupportTicketPage,
})

function SupportTicketPage() {
  const { ticketId } = Route.useParams()
  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-3xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <Link
        to="/support"
        className={`mb-6 inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        All tickets
      </Link>
      <TicketDetail key={ticketId} ticketId={ticketId} view="customer" />
    </main>
  )
}
