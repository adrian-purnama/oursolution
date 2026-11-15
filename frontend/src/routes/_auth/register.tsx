import { createFileRoute } from '@tanstack/react-router'
import RegisterForm from '#/components/forms/auth/RegisterForm'
import { validateAuthSearch } from '#/lib/redirect'

export const Route = createFileRoute('/_auth/register')({
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
