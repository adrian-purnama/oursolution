import { createFileRoute } from '@tanstack/react-router'
import RegisterForm from '#/components/forms/auth/RegisterForm'

export const Route = createFileRoute('/_auth/register')({
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-md px-6 pt-12 pb-10 text-[var(--ink)] sm:mt-12 sm:pt-16">
      <RegisterForm />
    </main>
  )
}
