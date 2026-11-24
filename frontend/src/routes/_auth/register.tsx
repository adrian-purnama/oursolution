import { createFileRoute } from '@tanstack/react-router'
import RegisterForm from '#/components/forms/auth/RegisterForm'
import { validateAuthSearch } from '#/lib/redirect'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/_auth/register')({
  head: () =>
    seo({
      title: m.seo_register_title(),
      description: m.seo_register_description(),
      path: '/register',
    }),
  validateSearch: validateAuthSearch,
  component: RegisterPage,
})

function RegisterPage() {
  const { redirect } = Route.useSearch()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-md px-6 pt-12 pb-10 text-[var(--ink)] sm:mt-12 sm:pt-16">
      <RegisterForm redirect={redirect} />
    </main>
  )
}
