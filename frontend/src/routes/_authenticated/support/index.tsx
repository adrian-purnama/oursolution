import { createFileRoute } from '@tanstack/react-router'
import SupportForm from '#/components/forms/ticket/SupportForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/_authenticated/support/')({
  head: () => privatePage('Support'),
  component: SupportPage,
})

function SupportPage() {
  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-3xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-medium tracking-tight">Support</h1>
      <p className={`mt-2 mb-8 ${hintClassName}`}>
        Tell us what is wrong and we will reply here.
      </p>
      <SupportForm />
    </main>
  )
}
