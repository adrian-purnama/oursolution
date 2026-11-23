import { createFileRoute } from '@tanstack/react-router'
import TermsOfService from '#/components/legal/TermsOfService'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/terms')({
  head: () =>
    seo({
      title: m.nav_terms(),
      description: m.seo_terms_description(),
      path: '/terms',
    }),
  component: TermsOfService,
})
