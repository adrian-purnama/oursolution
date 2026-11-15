import { createFileRoute } from '@tanstack/react-router'
import ServicesPage from '#/components/services/ServicesPage'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/services/')({
  head: () =>
    seo({
      title: 'Services',
      description:
        'Three ways we help: custom software built around how you work, ready-made tools hosted for you, and answr.id, an AI chatbot for your website.',
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
