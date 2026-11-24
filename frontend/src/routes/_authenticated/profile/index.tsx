import { createFileRoute, useNavigate } from '@tanstack/react-router'
import PaddlePay from '#/components/forms/billing/PaddlePay'
import BillingHistory from '#/components/forms/billing/BillingHistory'
import UnpaidNotice from '#/components/forms/billing/UnpaidNotice'
import ProductsPlansForm from '#/components/forms/profile/ProductsPlansForm'
import ProfileForm from '#/components/forms/profile/ProfileForm'
import RedeemCodeForm from '#/components/forms/profile/RedeemCodeForm'
import TourReplay from '#/components/forms/profile/TourReplay'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

type ProfileTab = 'account' | 'products' | 'billing'

export const Route = createFileRoute('/_authenticated/profile/')({
  head: () => privatePage(m.seo_profile()),
  validateSearch: (search: Record<string, unknown>): {
    tab?: ProfileTab
    ptxn?: string
  } => {
    const ptxn =
      typeof search.ptxn === 'string' && search.ptxn.startsWith('txn_')
        ? search.ptxn
        : undefined
    if (search.tab === 'products' || search.tab === 'billing') {
      return { tab: search.tab, ...(ptxn ? { ptxn } : {}) }
    }
    return {}
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { tab = 'account', ptxn } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <main className="mx-auto mt-0 mb-8 w-full sm:mb-12 max-w-4xl px-4 py-6 text-[var(--ink)] sm:mt-12 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-2xl font-medium">{m.profile_title()}</h1>
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
          <TabsTrigger value="account">{m.profile_tab_account()}</TabsTrigger>
          <TabsTrigger value="products">{m.profile_tab_products()}</TabsTrigger>
          <TabsTrigger value="billing">{m.profile_tab_billing()}</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-4">
          <ProfileForm />
          <RedeemCodeForm />
          <TourReplay />
        </TabsContent>
        <TabsContent value="products">
          <ProductsPlansForm />
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          {ptxn ? (
            <section className="rounded-xl border border-[var(--line)] bg-white">
              <h2 className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold">
                {m.billing_update_card_title()}
              </h2>
              <PaddlePay
                transactionId={ptxn}
                onChange={() =>
                  void navigate({ search: { tab: 'billing' }, replace: true })
                }
              />
            </section>
          ) : null}
          <BillingHistory />
        </TabsContent>
      </Tabs>
    </main>
  )
}
