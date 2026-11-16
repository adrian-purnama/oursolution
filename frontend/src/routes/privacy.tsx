import { createFileRoute } from '@tanstack/react-router'
import PrivacyPolicy from '#/components/legal/PrivacyPolicy'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/privacy')({
  head: () =>
    seo({
      title: 'Privacy policy',
      description:
        'How Our Solution collects, uses and protects your personal data.',
      path: '/privacy',
    }),
  component: PrivacyPolicy,
})
