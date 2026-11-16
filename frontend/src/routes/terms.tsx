import { createFileRoute } from '@tanstack/react-router'
import TermsOfService from '#/components/legal/TermsOfService'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/terms')({
  head: () =>
    seo({
      title: 'Terms of service',
      description:
        "The terms for using Our Solution's website, products and hosted services.",
      path: '/terms',
    }),
  component: TermsOfService,
})
