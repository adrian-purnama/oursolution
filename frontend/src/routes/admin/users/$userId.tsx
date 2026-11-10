import { createFileRoute } from '@tanstack/react-router'
import UserDetailForm from '#/components/forms/admin/UserDetailForm'
import UserPlanForm from '#/components/forms/admin/UserPlanForm'

export const Route = createFileRoute('/admin/users/$userId')({
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  return (
    <div className="mx-auto w-full max-w-2xl space-y-12">
      <UserDetailForm userId={userId} />
      <UserPlanForm userId={userId} />
    </div>
  )
}
