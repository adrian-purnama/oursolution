import { createFileRoute } from '@tanstack/react-router'
import ServicesPage from '#/components/services/ServicesPage'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/services/')({
  head: () =>
    seo({
      title: m.seo_services_title(),
      description: m.seo_services_description(),
      path: '/services',
      keywords: [
        'software development services',
        'managed hosting',
        'AI chatbot',
        'Our Solution services',
      ],
    }),
  component: ServicesPage,
})
