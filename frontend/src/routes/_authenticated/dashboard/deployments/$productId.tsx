import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import DeploymentPanel from '#/components/forms/deployment/DeploymentPanel'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute(
  '/_authenticated/dashboard/deployments/$productId',
)({
  head: () => privatePage('Deployment'),
  component: DeploymentPage,
})

function DeploymentPage() {
  const { productId } = Route.useParams()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-4xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <Link
        to="/dashboard"
        className={`mb-6 inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Dashboard
      </Link>
      <DeploymentPanel
        key={productId}
        apiBase="/me/deployments"
        productId={productId}
      />
    </main>
  )
}
