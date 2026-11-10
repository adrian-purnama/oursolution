import { createFileRoute } from '@tanstack/react-router'
import PlansAdminForm from '#/components/forms/admin/PlansAdminForm'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/admin/plans')({
  component: AdminPlansPage,
})

function AdminPlansPage() {
  return (
    <div className="mx-auto w-full max-w-3xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Plans</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Plans decide what an account can use. Assign them from a user&apos;s
          page.
        </p>
      </div>

      <PlansAdminForm />
    </div>
  )
}
