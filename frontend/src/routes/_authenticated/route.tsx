import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { bootstrapAuth } from '#/context/authContext'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/_authenticated')({
  head: () => privatePage(m.seo_account()),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await bootstrapAuth()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
