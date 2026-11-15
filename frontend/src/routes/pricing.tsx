import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import PricingGrid from '#/components/home/PricingGrid'
import { useAuth } from '#/context/authContext'
import { hintClassName } from '#/lib/ui-classes'
import { seo } from '#/lib/seo'

export const Route = createFileRoute('/pricing')({
  head: () =>
    seo({
      title: 'Pricing',
      description:
        'Plans for managed hosting and ready-made workflows. Hosting runs by the period; workflows are yours after one purchase.',
      path: '/pricing',
      keywords: [
        'managed hosting pricing',
        'hosting plans',
        'business workflows',
        'Our Solution pricing',
      ],
    }),
  component: PricingPage,
})

function PricingPage() {
  const { isAuthenticated } = useAuth()

  return (
    <main className="text-[var(--ink)]">
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
        />
        {isAuthenticated && (
          <div className="relative mx-auto max-w-6xl px-6 pt-6">
            <Link
              to="/dashboard"
              className={`inline-flex items-center gap-1.5 no-underline hover:text-[var(--ink)] ${hintClassName}`}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Dashboard
            </Link>
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
          <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
            Shop
          </p>
          <h1 className="font-display mx-auto max-w-2xl text-4xl sm:text-5xl">
            Pay only for what you run.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Hosting runs by the period. Workflows are yours after one purchase.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <PricingGrid />
      </div>
    </main>
  )
}
