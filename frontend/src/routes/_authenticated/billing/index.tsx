import { createFileRoute, redirect } from '@tanstack/react-router'

// Billing lives on the profile now; keep old links working.
export const Route = createFileRoute('/_authenticated/billing/')({
  beforeLoad: () => {
    throw redirect({ to: '/profile', search: { tab: 'billing' } })
  },
})
