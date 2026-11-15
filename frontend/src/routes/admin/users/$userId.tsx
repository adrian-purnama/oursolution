import { createFileRoute, useNavigate } from '@tanstack/react-router'
import UserDeploymentsForm from '#/components/forms/admin/UserDeploymentsForm'
import UserDetailForm from '#/components/forms/admin/UserDetailForm'
import UserPaymentsForm from '#/components/forms/admin/UserPaymentsForm'
import UserProductsForm from '#/components/forms/admin/UserProductsForm'
import UserPurchasesForm from '#/components/forms/admin/UserPurchasesForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

type UserTab = 'account' | 'deployments' | 'payments'

export const Route = createFileRoute('/admin/users/$userId')({
  validateSearch: (search: Record<string, unknown>): { tab?: UserTab } =>
    search.tab === 'deployments' || search.tab === 'payments'
      ? { tab: search.tab }
      : {},
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const { tab = 'account' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({
            search:
              value === 'deployments' || value === 'payments'
                ? { tab: value }
                : {},
            replace: true,
          })
        }
      >
        <TabsList className="mb-8">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-12">
          <UserDetailForm userId={userId} />
          <UserProductsForm userId={userId} />
          <UserPurchasesForm userId={userId} />
        </TabsContent>
        <TabsContent value="deployments">
          <UserDeploymentsForm userId={userId} />
        </TabsContent>
        <TabsContent value="payments">
          <UserPaymentsForm userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
