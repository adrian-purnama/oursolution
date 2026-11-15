import FinalCta from '#/components/home/FinalCta'
import RevealScope from '#/components/home/RevealScope'
import ServiceCard from '#/components/services/ServiceCard'
import { SERVICES } from '#/lib/services'

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
          <p className="eyebrow mb-3">Services</p>
          <h1 className="font-display mx-auto mb-5 max-w-3xl text-4xl sm:text-6xl">
            Three ways we can help.
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-[var(--muted)]">
            Have us build your software, run a ready-made tool on our servers,
            or add our AI chatbot to your site. Pick one to see what you get and
            how it works.
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
