import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import TicketDetail from '#/components/forms/ticket/TicketDetail'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/_authenticated/support/$ticketId')({
  head: () => privatePage('Support ticket'),
  component: SupportTicketPage,
})

function SupportTicketPage() {
  const { ticketId } = Route.useParams()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-3xl px-6 py-10 text-[var(--ink)] sm:mt-12">
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
