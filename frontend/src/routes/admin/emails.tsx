import { createFileRoute } from '@tanstack/react-router'
import BroadcastsAdminForm from '#/components/forms/admin/BroadcastsAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/emails')({
  head: () => privatePage('Emails · Admin'),
  component: AdminEmailsPage,
})

function AdminEmailsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Emails</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Email one person, a product’s users, or everyone at once.
        </p>
      </div>
      <BroadcastsAdminForm />
    </div>
  )
}
