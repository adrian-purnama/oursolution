import { createFileRoute } from '@tanstack/react-router'
import UsersAdminForm from '#/components/forms/admin/UsersAdminForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/users/')({
  head: () => privatePage('Users · Admin'),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Users</h1>
      </div>

      <UsersAdminForm />
    </div>
  )
}
