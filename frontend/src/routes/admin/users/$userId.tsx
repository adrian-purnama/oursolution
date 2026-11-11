import { createFileRoute, useNavigate } from '@tanstack/react-router'
import UserDeploymentsForm from '#/components/forms/admin/UserDeploymentsForm'
import UserDetailForm from '#/components/forms/admin/UserDetailForm'
import UserProductsForm from '#/components/forms/admin/UserProductsForm'
import UserPurchasesForm from '#/components/forms/admin/UserPurchasesForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'

type UserTab = 'account' | 'deployments'

export const Route = createFileRoute('/admin/users/$userId')({
  validateSearch: (search: Record<string, unknown>): { tab?: UserTab } =>
    search.tab === 'deployments' ? { tab: 'deployments' } : {},
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
            search: value === 'deployments' ? { tab: 'deployments' } : {},
            replace: true,
          })
        }
      >
        <TabsList className="mb-8">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-12">
          <UserDetailForm userId={userId} />
          <UserProductsForm userId={userId} />
          <UserPurchasesForm userId={userId} />
        </TabsContent>
        <TabsContent value="deployments">
          <UserDeploymentsForm userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
