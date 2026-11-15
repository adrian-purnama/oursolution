import { createFileRoute } from '@tanstack/react-router'
import UsersAdminForm from '#/components/forms/admin/UsersAdminForm'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Users</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Search by email and open a user to manage them.
        </p>
      </div>

      <UsersAdminForm />
    </div>
  )
}
