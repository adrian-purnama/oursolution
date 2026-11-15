import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { CONTACT_URL } from '#/lib/config'

export default function FinalCta() {
  return (
    <section id="contact" className="scroll-mt-20 bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div
          data-reveal
          className="relative overflow-hidden rounded-3xl bg-[var(--navy)] px-8 py-16 text-white sm:px-14 sm:py-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-[var(--accent)]/60 blur-3xl"
          />
          <div className="relative">
            <h2 className="font-display mb-5 max-w-3xl text-4xl leading-[1.05] sm:text-6xl">
              Tell us what you need.
            </h2>
            <p className="mb-10 max-w-xl text-lg leading-relaxed text-white/60">
              Tell us what slows your team down and we will reply with a plan
              and an estimate. Or pick a hosting plan in the shop and start
              today.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={CONTACT_URL}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-[var(--navy)] no-underline transition hover:bg-white/90"
              >
                Start a project
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <Link
                to="/pricing"
                className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-sm font-medium text-white no-underline transition hover:border-white/50"
              >
                Go to the shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
