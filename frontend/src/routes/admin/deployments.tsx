import { createFileRoute } from '@tanstack/react-router'
import DeploymentsAdminForm from '#/components/forms/admin/DeploymentsAdminForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/deployments')({
  head: () => privatePage('Deployments · Admin'),
  component: AdminDeploymentsPage,
})

function AdminDeploymentsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Deployments</h1>
      </div>
      <DeploymentsAdminForm />
    </div>
  )
}
