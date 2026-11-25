import { createFileRoute } from '@tanstack/react-router'
import BroadcastsAdminForm from '#/components/forms/admin/BroadcastsAdminForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/emails')({
  head: () => privatePage('Emails · Admin'),
  component: AdminEmailsPage,
})

function AdminEmailsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Emails</h1>
      </div>
      <BroadcastsAdminForm />
    </div>
  )
}
