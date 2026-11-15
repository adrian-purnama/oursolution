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
    <main className="mx-auto mt-8 mb-12 w-full max-w-3xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <h1 className="text-2xl font-medium tracking-tight">Support</h1>
      <p className={`mt-2 mb-8 ${hintClassName}`}>
        Tell us what is wrong and we will reply here.
      </p>
      <SupportForm />
    </main>
  )
}
