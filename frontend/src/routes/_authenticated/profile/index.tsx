import { createFileRoute } from '@tanstack/react-router'
import ProfileForm from '#/components/forms/profile/ProfileForm'

export const Route = createFileRoute('/_authenticated/profile/')({
  component: ProfilePage,
})

function ProfilePage() {
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-3xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <h1 className="mb-8 text-2xl font-medium">Profile</h1>
      <ProfileForm />
    </main>
  )
}
