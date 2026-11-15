import { createFileRoute } from '@tanstack/react-router'
import RegisterForm from '#/components/forms/auth/RegisterForm'
import { validateAuthSearch } from '#/lib/redirect'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_auth/register')({
  head: () =>
    seo({
      title: 'Create an account',
      description:
        'Create an Our Solution account to buy hosting plans and workflows, and track your services in one dashboard.',
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
