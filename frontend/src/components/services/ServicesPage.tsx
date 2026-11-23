import FinalCta from '#/components/home/FinalCta'
import RevealScope from '#/components/home/RevealScope'
import ServiceCard from '#/components/services/ServiceCard'
import { SERVICES } from '#/lib/services'
import { m } from '#/paraglide/messages'

/** /services: the three services side by side, each leading to its own page. */
export default function ServicesPage() {
  return (
    <RevealScope className="bg-white text-[var(--ink)]">
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
          <p className="eyebrow mb-3">{m.services_eyebrow()}</p>
          <h1 className="font-display mx-auto mb-5 max-w-3xl text-4xl sm:text-6xl">
            {m.services_title()}
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            {m.services_copy()}
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <ul className="mx-auto grid max-w-6xl gap-5 px-6 py-16 sm:py-20 lg:grid-cols-3">
          {SERVICES.map((service, index) => (
            <li key={service.slug}>
              <ServiceCard service={service} index={index} />
            </li>
          ))}
        </ul>
      </section>

      <FinalCta />
    </RevealScope>
  )
}
