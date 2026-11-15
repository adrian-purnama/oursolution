import { createFileRoute } from '@tanstack/react-router'
import DeploymentsAdminForm from '#/components/forms/admin/DeploymentsAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/deployments')({
  head: () => privatePage('Deployments · Admin'),
  component: AdminDeploymentsPage,
})

function AdminDeploymentsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Deployments</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Every customer's deployment and its status.
        </p>
      </div>
      <DeploymentsAdminForm />
    </div>
  )
}
