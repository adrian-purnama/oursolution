import { createFileRoute } from '@tanstack/react-router'
import ServicesPage from '#/components/services/ServicesPage'

export const Route = createFileRoute('/services/')({
  component: ServicesPage,
})
