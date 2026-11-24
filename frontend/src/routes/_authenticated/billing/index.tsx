import { createFileRoute, redirect } from '@tanstack/react-router'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

// Billing lives on the profile now; keep old links working.
export const Route = createFileRoute('/_authenticated/billing/')({
  head: () => privatePage(m.seo_billing()),
  validateSearch: (search: Record<string, unknown>): { _ptxn?: string } =>
    typeof search._ptxn === 'string' && search._ptxn.startsWith('txn_')
      ? { _ptxn: search._ptxn }
      : {},
  beforeLoad: ({ search }) => {
    // Paddle's emails (update your card) land here with the transaction.
    throw redirect({
      to: '/profile',
      search: { tab: 'billing', ptxn: search._ptxn },
    })
  },
})
