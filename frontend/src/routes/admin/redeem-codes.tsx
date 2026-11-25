import { createFileRoute } from '@tanstack/react-router'
import RedeemCodesAdminForm from '#/components/forms/admin/RedeemCodesAdminForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/redeem-codes')({
  head: () => privatePage('Redeem codes · Admin'),
  component: AdminRedeemCodesPage,
})

function AdminRedeemCodesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Redeem codes</h1>
      </div>
      <RedeemCodesAdminForm />
    </div>
  )
}
