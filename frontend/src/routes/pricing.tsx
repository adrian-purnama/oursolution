import { createFileRoute } from '@tanstack/react-router'
import PricingGrid from '#/components/home/PricingGrid'
import PricingHero from '#/components/home/PricingHero'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/pricing')({
  head: () =>
    seo({
      title: 'Hosting plans and pricing',
      description:
        'Our Solution Hosting plans: apps like n8n set up, backed up, monitored and updated for you, plus ready-made workflows you buy once.',
      path: '/pricing',
      keywords: [
        'managed hosting pricing',
        'hosting plans',
        'business workflows',
        'Our Solution Hosting',
        'Our Solution pricing',
      ],
    }),
  component: PricingPage,
})

function PricingPage() {
  return (
    <main className="text-[var(--ink)]">
      <PricingHero />

      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <PricingGrid />
      </div>
    </main>
  )
}
