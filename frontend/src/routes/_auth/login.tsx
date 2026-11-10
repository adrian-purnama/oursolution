import { createFileRoute } from '@tanstack/react-router'
import LoginForm from '#/components/forms/auth/LoginForm'

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-md px-6 pt-12 pb-10 text-[var(--ink)] sm:mt-12 sm:pt-16">
      <LoginForm />
    </main>
  )
}
