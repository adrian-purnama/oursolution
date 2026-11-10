import { createFileRoute } from '@tanstack/react-router'
import UserDetailForm from '#/components/forms/admin/UserDetailForm'
import UserProductsForm from '#/components/forms/admin/UserProductsForm'
import UserPurchasesForm from '#/components/forms/admin/UserPurchasesForm'

export const Route = createFileRoute('/admin/users/$userId')({
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  return (
    <div className="mx-auto w-full max-w-3xl space-y-12">
      <UserDetailForm userId={userId} />
      <UserProductsForm userId={userId} />
      <UserPurchasesForm userId={userId} />
    </div>
  )
}
