import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import ServiceLogo from '#/components/services/ServiceLogo'
import type { Service } from '#/lib/services'
import { m } from '#/paraglide/messages'

/** One service as a card; the whole card opens that service's page. */
export default function ServiceCard({
  service,
  index,
}: {
  service: Service
  index: number
}) {
  return (
    <Link
      to="/services/$slug"
      params={{ slug: service.slug }}
      className="group flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-7 text-[var(--ink)] no-underline transition duration-300 hover:-translate-y-1 hover:border-[var(--ink)]/20 hover:shadow-[0_24px_48px_-28px_rgba(12,12,11,0.3)] sm:p-8"
    >
      <div className="mb-9 flex items-start justify-between">
        <ServiceLogo service={service} className="h-10 text-sm" />
        <span className="shrink-0 pl-4 font-mono text-xs text-[var(--muted)]">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>

      <h3 className="font-display mb-2 text-2xl">{service.name}</h3>
      <p className="mb-6 text-sm leading-relaxed text-[var(--muted)]">
        {service.summary}
      </p>

      <ul className="mb-8 space-y-2.5 border-t border-[var(--line)] pt-6">
        {service.points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm">
            <Check
              className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
              aria-hidden
            />
            {point}
          </li>
        ))}
      </ul>

      <span className="mt-auto inline-flex items-center gap-2 text-sm font-medium">
        {m.service_learn_more()}
        <ArrowRight
          className="size-4 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden
        />
      </span>
    </Link>
  )
}
