import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import ServiceCard from '#/components/services/ServiceCard'
import { SERVICES } from '#/lib/services'
import { m } from '#/paraglide/messages'

/** The heart of the landing page: the three services, each with its own page. */
export default function ServicesOverview() {
  return (
    <section
      id="services"
      className="scroll-mt-20 border-b border-[var(--line)] bg-[var(--surface)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div
          data-reveal
          className="mb-12 flex flex-col gap-6 lg:mb-16 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">{m.home_services_eyebrow()}</p>
            <h2 className="font-display mb-4 text-3xl text-[var(--ink)] sm:text-5xl">
              {m.home_services_title()}
            </h2>
            <p className="max-w-xl leading-relaxed text-[var(--muted)]">
              {m.home_services_copy()}
            </p>
          </div>
          <Link
            to="/services"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--ink)] no-underline hover:underline"
          >
            {m.home_services_compare()}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <ul className="grid gap-5 lg:grid-cols-3">
          {SERVICES.map((service, index) => (
            <li key={service.slug} data-reveal>
              <ServiceCard service={service} index={index} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
