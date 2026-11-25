import { createFileRoute } from '@tanstack/react-router'
import AppConfigForm from '#/components/forms/admin/AppConfigForm'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/app-config')({
  head: () => privatePage('App config · Admin'),
  component: AdminAppConfigPage,
})

function AdminAppConfigPage() {
  return (
    <div className="mx-auto w-full max-w-2xl text-[var(--ink)]">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-2xl font-medium tracking-tight">App config</h1>
      </div>

      <AppConfigForm />
    </div>
  )
}
