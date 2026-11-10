import { createFileRoute } from '@tanstack/react-router'
import AppConfigForm from '#/components/forms/admin/AppConfigForm'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/admin/app-config')({
  component: AdminAppConfigPage,
})

function AdminAppConfigPage() {
  return (
    <div className="mx-auto w-full max-w-2xl text-[var(--ink)]">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight">App config</h1>
        <p className={`mt-2 ${hintClassName}`}>
          Update branding and whether login or registration stays open.
        </p>
      </div>

      <AppConfigForm />
    </div>
  )
}
