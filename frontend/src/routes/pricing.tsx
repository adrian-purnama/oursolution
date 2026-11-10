import { createFileRoute } from '@tanstack/react-router'
import PricingGrid from '#/components/home/PricingGrid'
import { hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-5xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <div className="mb-10">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Pricing
        </h1>
        <p className={`mt-3 ${hintClassName}`}>
          Check out each product on its own. Buying again extends it.
        </p>
      </div>
      <PricingGrid />
    </main>
  )
}
