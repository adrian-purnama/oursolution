import { createFileRoute } from '@tanstack/react-router'
import PricingGrid from '#/components/home/PricingGrid'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  return (
    <main className="text-[var(--ink)]">
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
          <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
            Pricing
          </p>
          <h1 className="font-display mx-auto max-w-2xl text-4xl sm:text-5xl">
            Pay only for what you run.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Each product is billed on its own. Hosting runs for a period and you
            extend it when you like; workflows are yours after one purchase.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <PricingGrid />
      </div>
    </main>
  )
}
