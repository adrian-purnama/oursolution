import { BRAND_NAME } from '#/lib/config'

const REASONS = [
  {
    title: 'One team, start to finish',
    body: 'The people who build your system are the people who host and maintain it. Nothing gets lost in a handover.',
  },
  {
    title: 'Clear before you commit',
    body: 'Projects start with a plan and an estimate. Hosting plans show their price up front in the shop.',
  },
  {
    title: 'We stay on',
    body: 'Monitoring, backups, updates and the next round of improvements are part of the job, not an afterthought.',
  },
]

/** Three short reasons to pick us, between the services and the final CTA. */
export default function WhyUs() {
  return (
    <section className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div data-reveal className="mb-12 max-w-2xl lg:mb-16">
          <p className="eyebrow mb-3">Why {BRAND_NAME}</p>
          <h2 className="font-display text-3xl text-[var(--ink)] sm:text-5xl">
            Built by us, run by us.
          </h2>
        </div>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {REASONS.map((reason, index) => (
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
