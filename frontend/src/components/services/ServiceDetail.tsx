import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import PricingGrid from '#/components/home/PricingGrid'
import ServiceAction from '#/components/services/ServiceAction'
import ServiceIcon from '#/components/services/ServiceIcon'
import ServiceLogo from '#/components/services/ServiceLogo'
import { SERVICES } from '#/lib/services'
import type { Service } from '#/lib/services'
import { m } from '#/paraglide/messages'

/** /services/<slug>: what one service is, what you get, and how it works. */
export default function ServiceDetail({ service }: { service: Service }) {
  const others = SERVICES.filter((other) => other.slug !== service.slug)

  return (
    <main className="bg-white text-[var(--ink)]">
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_65%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-16 sm:pb-24">
          <Link
            to="/services"
            className="mb-12 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] no-underline transition hover:text-[var(--ink)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {m.service_all_services()}
          </Link>

          <div className="max-w-3xl">
            <ServiceLogo service={service} className="mb-8 h-12 text-base" />
            <h1 className="font-display mb-5 text-4xl leading-[1.05] sm:text-6xl">
              {service.tagline}
            </h1>
            <p className="mb-9 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
              {service.intro}
            </p>
            <div className="flex flex-wrap gap-3">
              <ServiceAction action={service.primary} />
              {service.secondary ? (
                <ServiceAction action={service.secondary} variant="outline" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <p className="eyebrow mb-3">{m.service_what_you_get()}</p>
          <h2 className="font-display mb-12 max-w-2xl text-3xl sm:text-4xl">
            {m.service_everything_included({ name: service.name })}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {service.features.map(({ icon: FeatureIcon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-[var(--line)] bg-white p-6"
              >
                <span className="mb-6 inline-flex size-10 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  <FeatureIcon className="size-5" aria-hidden />
                </span>
                <h3 className="mb-1.5 text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[var(--navy)] text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <div>
            <p className="eyebrow mb-3 !text-white/50">
              {m.service_how_it_works()}
            </p>
            <h2 className="font-display mb-4 text-3xl sm:text-4xl">
              {m.service_steps_title({ count: service.steps.length })}
            </h2>
            <p className="max-w-sm leading-relaxed text-white/60">
              {m.service_steps_copy()}
            </p>
          </div>
          <ol>
            {service.steps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[3rem_1fr] gap-x-4 border-t border-white/15 py-6 last:border-b"
              >
                <span className="pt-1 font-mono text-xs text-white/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display mb-1.5 text-xl sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="max-w-md text-sm leading-relaxed text-white/60">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {service.slug === 'hosting' ? (
        <PricingGrid
          limit={3}
          grouped={false}
          preview={(grid) => (
            <section className="border-b border-[var(--line)]">
              <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow mb-3">{m.service_from_shop()}</p>
                    <h2 className="font-display text-3xl sm:text-4xl">
                      {m.service_popular_plans()}
                    </h2>
                  </div>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline"
                  >
                    {m.service_see_shop()}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
                {grid}
              </div>
            </section>
          )}
        />
      ) : null}

      <section className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display max-w-xl text-3xl sm:text-4xl">
              {m.service_ready()}
            </h2>
            <div className="flex flex-wrap gap-3">
              <ServiceAction action={service.primary} />
            </div>
          </div>

          <p className="eyebrow mb-4">{m.service_other()}</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  to="/services/$slug"
                  params={{ slug: other.slug }}
                  className="group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 no-underline transition hover:border-[var(--ink)]/25"
                >
                  <ServiceIcon service={other} className="size-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {other.name}
                    </span>
                    <span className="block truncate text-sm text-[var(--muted)]">
                      {other.tagline}
                    </span>
                  </span>
                  <ArrowRight
                    className="ml-auto size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
