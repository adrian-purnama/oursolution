import { BRAND_NAME } from '#/lib/config'
import { m } from '#/paraglide/messages'

const reasons = () => [
  { title: m.home_why_1_title(), body: m.home_why_1_body() },
  { title: m.home_why_2_title(), body: m.home_why_2_body() },
  { title: m.home_why_3_title(), body: m.home_why_3_body() },
]

/** Three short reasons to pick us, between the services and the final CTA. */
export default function WhyUs() {
  return (
    <section className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div data-reveal className="mb-12 max-w-2xl lg:mb-16">
          <p className="eyebrow mb-3">
            {m.home_why_eyebrow({ brand: BRAND_NAME })}
          </p>
          <h2 className="font-display text-3xl text-[var(--ink)] sm:text-5xl">
            {m.home_why_title()}
          </h2>
        </div>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {reasons().map((reason, index) => (
            <li
              key={reason.title}
              data-reveal
              className="border-t border-[var(--ink)] pt-6"
            >
              <p className="mb-6 font-mono text-xs text-[var(--muted)]">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="font-display mb-2.5 text-xl text-[var(--ink)]">
                {reason.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {reason.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
