import { createFileRoute, useNavigate } from '@tanstack/react-router'
import BillingHistory from '#/components/forms/billing/BillingHistory'
import UnpaidNotice from '#/components/forms/billing/UnpaidNotice'
import ProductsPlansForm from '#/components/forms/profile/ProductsPlansForm'
import ProfileForm from '#/components/forms/profile/ProfileForm'
import RedeemCodeForm from '#/components/forms/profile/RedeemCodeForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { privatePage } from '#/lib/seo'

type ProfileTab = 'account' | 'products' | 'billing'

export const Route = createFileRoute('/_authenticated/profile/')({
  head: () => privatePage('Profile'),
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTab } =>
    search.tab === 'products' || search.tab === 'billing'
      ? { tab: search.tab }
      : {},
  component: ProfilePage,
})

function ProfilePage() {
  const { tab = 'account' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-4xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-medium">Profile</h1>
      <UnpaidNotice className="mb-6" />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({
            search:
              value === 'products' || value === 'billing' ? { tab: value } : {},
            replace: true,
          })
        }
      >
        <TabsList className="mb-8">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="products">Products & plans</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-4">
          <ProfileForm />
          <RedeemCodeForm />
        </TabsContent>
        <TabsContent value="products">
          <ProductsPlansForm />
        </TabsContent>
        <TabsContent value="billing">
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </main>
  )
}
