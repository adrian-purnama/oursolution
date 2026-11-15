import { createFileRoute } from '@tanstack/react-router'
import LoginForm from '#/components/forms/auth/LoginForm'
import { validateAuthSearch } from '#/lib/redirect'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/_auth/login')({
  head: () =>
    seo({
      title: 'Sign in',
      description:
        'Sign in to Our Solution to manage your hosted apps, billing and support tickets.',
      path: '/login',
    }),
  validateSearch: validateAuthSearch,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-md px-6 pt-12 pb-10 text-[var(--ink)] sm:mt-12 sm:pt-16">
      <LoginForm redirect={redirect} />
    </main>
  )
}
