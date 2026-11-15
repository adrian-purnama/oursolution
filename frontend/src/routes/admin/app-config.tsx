import { createFileRoute } from '@tanstack/react-router'
import AppConfigForm from '#/components/forms/admin/AppConfigForm'
import { hintClassName } from '#/lib/ui-classes'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/app-config')({
  head: () => privatePage('App config · Admin'),
  component: AdminAppConfigPage,
})

function AdminAppConfigPage() {
  return (
    <div className="mx-auto w-full max-w-2xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">App config</h1>
        <p className={`mt-2 ${hintClassName}`}>Branding and account access.</p>
      </div>

      <AppConfigForm />
    </div>
  )
}
