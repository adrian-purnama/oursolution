import { createFileRoute } from '@tanstack/react-router'
import PricingGrid from '#/components/home/PricingGrid'
import PricingHero from '#/components/home/PricingHero'
import { seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/pricing')({
  head: () =>
    seo({
      title: m.seo_pricing_title(),
      description: m.seo_pricing_description(),
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

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <PricingGrid />
      </div>
    </main>
  )
}
