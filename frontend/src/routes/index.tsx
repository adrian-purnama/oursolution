import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import FeatureGrid from '#/components/home/FeatureGrid'
import FinalCta from '#/components/home/FinalCta'
import HeroSection from '#/components/home/HeroSection'
import HowItWorks from '#/components/home/HowItWorks'
import PricingGrid from '#/components/home/PricingGrid'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="bg-white text-[var(--ink)]">
      <HeroSection />

      <PricingGrid
        limit={3}
        grouped={false}
        preview={(grid) => (
          <section className="border-b border-[var(--line)]">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
                    Products
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl">
                    Start with what you need.
                  </h2>
                </div>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink)] no-underline hover:underline"
                >
                  All pricing
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
              {grid}
            </div>
          </section>
        )}
      />

      <FeatureGrid />
      <HowItWorks />
      <FinalCta />
    </main>
  )
}
