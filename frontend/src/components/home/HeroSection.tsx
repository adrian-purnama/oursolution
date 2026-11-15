import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import HeroVisual from '#/components/home/HeroVisual'
import { Button } from '#/components/ui/button'
import { BRAND_NAME, CONTACT_URL } from '#/lib/config'
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '#/lib/gsap'

const lineMask = 'block overflow-hidden pb-[0.12em] -mb-[0.12em]'

const ASSURANCES = [
  'Software solutions',
  'Hosting solutions',
  'answr.id chatbot',
]

/**
 * Centered hero: the promise, two ways in, the three services by name, and
 * an example of the kind of system we deliver. Lines and blocks ease in once on load; with reduced
 * motion everything is simply there.
 */
export default function HeroSection() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(MOTION_OK, () => {
        gsap
          .timeline({ defaults: { ease: EASE_OUT } })
          .to('[data-hero-line]', {
            y: 0,
            duration: 1,
            ease: 'power4.out',
            stagger: 0.12,
            delay: 0.1,
          })
          .to(
            '[data-hero-fade]',
            { opacity: 1, y: 0, duration: 0.8, stagger: 0.09 },
            '-=0.65',
          )
      })
    },
    { scope: root },
  )

  return (
    <section
      ref={root}
      className="relative overflow-hidden border-b border-[var(--line)] bg-white text-[var(--ink)]"
    >
      {/* Backdrop: a faint grid that fades out, under a soft green light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)] bg-[linear-gradient(to_right,rgba(12,12,11,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,12,11,0.06)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 left-1/2 h-[30rem] w-[56rem] max-w-none -translate-x-1/2 rounded-full bg-[var(--accent)]/15 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 text-center sm:pt-24">
        <p
          data-hero-fade
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 py-1 pr-3.5 pl-1.5 text-xs font-medium text-[var(--muted)] shadow-[0_1px_2px_rgba(12,12,11,0.04)] backdrop-blur-sm"
        >
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
            {BRAND_NAME}
          </span>
          Software, hosting and an AI chatbot
        </p>

        <h1 className="font-display mb-6 max-w-4xl text-[clamp(2.5rem,6.6vw,5.25rem)] leading-[1.02]">
          <span className={lineMask}>
            <span data-hero-line className="block">
              We build your software.
            </span>
          </span>
          <span className={lineMask}>
            <span data-hero-line className="block text-[var(--accent)]">
              Then we keep it running.
            </span>
          </span>
        </h1>

        <p
          data-hero-fade
          className="mb-9 max-w-2xl text-lg leading-relaxed text-[var(--muted)]"
        >
          {BRAND_NAME} is a software studio with its own hosting. We design and
          ship the system your business needs, run ready-made tools on servers
          we manage, and make answr, an AI chatbot for your website.
        </p>

        <div data-hero-fade className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <a href={CONTACT_URL} className="no-underline">
              Start a project
              <ArrowRight aria-hidden />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full bg-white px-6"
          >
            <Link to="/services" className="no-underline">
              See our services
            </Link>
          </Button>
        </div>

        <ul
          data-hero-fade
          className="mt-9 flex flex-col items-center gap-x-7 gap-y-2 text-sm text-[var(--muted)] sm:flex-row"
        >
          {ASSURANCES.map((item) => (
            <li key={item} className="inline-flex items-center gap-2">
              <Check className="size-4 text-[var(--accent)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <div data-hero-fade className="mt-14 w-full sm:mt-20">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
