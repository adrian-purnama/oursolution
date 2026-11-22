import { ArrowLeft } from 'lucide-react'
import DeploymentList from '#/components/forms/deployment/DeploymentList'
import DeploymentPanel from '#/components/forms/deployment/DeploymentPanel'
import { hintClassName } from '#/lib/ui-classes'

/**
 * A user's deployments at a glance, as the user sees them on their
 * dashboard; opening one shows it with the admin controls. Which one is
 * open lives in the URL, so other pages can link straight to it.
 */
export default function UserDeploymentsForm({
  userId,
  open,
  onOpen,
}: {
  userId: string
  /** The product whose deployment is open, or null for the list. */
  open: string | null
  onOpen: (productId: string | null) => void
}) {
  const apiBase = `/admin/users/${userId}/deployments`

  if (open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onOpen(null)}
          className={`mb-6 inline-flex items-center gap-1.5 hover:text-[var(--ink)] ${hintClassName}`}
        >
          <ArrowLeft className="size-4" aria-hidden />
          All deployments
        </button>
        <DeploymentPanel key={open} apiBase={apiBase} productId={open} admin />
      </div>
    )
  }

  return (
    <DeploymentList
      apiBase={apiBase}
      onSelect={onOpen}
      admin
      bulkUserId={userId}
    />
  )
}
