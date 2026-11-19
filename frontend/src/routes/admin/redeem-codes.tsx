import { createFileRoute } from '@tanstack/react-router'
import RedeemCodesAdminForm from '#/components/forms/admin/RedeemCodesAdminForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/redeem-codes')({
  head: () => privatePage('Redeem codes · Admin'),
  component: AdminRedeemCodesPage,
})

function AdminRedeemCodesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">Redeem codes</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Codes that give a product to whoever redeems them.
        </p>
      </div>
      <RedeemCodesAdminForm />
    </div>
  )
}
