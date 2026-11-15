import { createFileRoute, redirect } from '@tanstack/react-router'
import { privatePage } from '#/lib/seo'

// Billing lives on the profile now; keep old links working.
export const Route = createFileRoute('/_authenticated/billing/')({
  head: () => privatePage('Billing'),
  beforeLoad: () => {
    throw redirect({ to: '/profile', search: { tab: 'billing' } })
  },
})
