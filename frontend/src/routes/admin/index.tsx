import { createFileRoute, redirect } from '@tanstack/react-router'
import { privatePage } from '#/lib/seo'

export const Route = createFileRoute('/admin/')({
  head: () => privatePage('Admin'),
  beforeLoad: () => {
    throw redirect({ to: '/admin/app-config' })
  },
})
