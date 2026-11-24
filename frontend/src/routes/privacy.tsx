import { createFileRoute } from '@tanstack/react-router'
import PrivacyPolicy from '#/components/legal/PrivacyPolicy'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/privacy')({
  head: () =>
    seo({
      title: m.nav_privacy(),
      description: m.seo_privacy_description(),
      path: '/privacy',
    }),
  component: PrivacyPolicy,
})
