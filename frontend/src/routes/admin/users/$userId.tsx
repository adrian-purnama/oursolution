import { createFileRoute, useNavigate } from '@tanstack/react-router'
import UserDeploymentsForm from '#/components/forms/admin/UserDeploymentsForm'
import UserBillingRegionForm from '#/components/forms/admin/UserBillingRegionForm'
import UserDetailForm from '#/components/forms/admin/UserDetailForm'
import UserPaymentsForm from '#/components/forms/admin/UserPaymentsForm'
import UserProductsForm from '#/components/forms/admin/UserProductsForm'
import UserPurchasesForm from '#/components/forms/admin/UserPurchasesForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { privatePage } from '#/lib/seo'

type UserTab = 'account' | 'deployments' | 'payments'

type UserSearch = {
  tab?: Exclude<UserTab, 'account'>
  /** Deployments tab: the product whose deployment is open. */
  deployment?: string
}

export const Route = createFileRoute('/admin/users/$userId')({
  head: () => privatePage('User · Admin'),
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    if (search.tab === 'payments') return { tab: 'payments' }
    if (search.tab !== 'deployments') return {}
    return typeof search.deployment === 'string' && search.deployment
      ? { tab: 'deployments', deployment: search.deployment }
      : { tab: 'deployments' }
  },
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { userId } = Route.useParams()
  const { tab = 'account', deployment } = Route.useSearch()
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
        <TabsList className="mb-6 sm:mb-8">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-10 sm:space-y-12">
          <UserDetailForm userId={userId} />
          <UserProductsForm userId={userId} />
          <UserPurchasesForm userId={userId} />
        </TabsContent>
        <TabsContent value="deployments">
          <UserDeploymentsForm
            userId={userId}
            open={deployment ?? null}
            onOpen={(productId) =>
              void navigate({
                search: productId
                  ? { tab: 'deployments', deployment: productId }
                  : { tab: 'deployments' },
              })
            }
          />
        </TabsContent>
        <TabsContent value="payments" className="space-y-10">
          <UserBillingRegionForm userId={userId} />
          <UserPaymentsForm userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
