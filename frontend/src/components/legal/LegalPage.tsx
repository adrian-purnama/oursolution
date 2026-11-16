import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export type LegalSection = { id: string; title: string; body: ReactNode }

/** Shared layout for the privacy policy and terms of service. */
export default function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string
  title: string
  /** Shown as "Last updated …". */
  updated: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14 text-[var(--ink)] sm:py-20">
      <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display mb-3 text-4xl sm:text-5xl">{title}</h1>
      <p className="mb-10 text-sm text-[var(--muted)]">
        Last updated {updated}
      </p>

      <div className="grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 space-y-2 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[var(--muted)] no-underline transition hover:text-[var(--ink)]"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl space-y-10 leading-relaxed">
          <div className="space-y-4 text-[var(--muted)]">{intro}</div>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 space-y-3 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[var(--muted)] [&_ul]:space-y-1.5 [&_ul]:text-[var(--muted)]"
            >
              <h2 className="text-lg font-medium">
                {index + 1}. {section.title}
              </h2>
              {section.body}
            </section>
          ))}
          <p className="border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
            Questions about this page? Reach us through the{' '}
            <Link to="/contact" className="text-[var(--ink)] underline">
              contact page
            </Link>
            .
          </p>
        </article>
      </div>
    </main>
  )
}
