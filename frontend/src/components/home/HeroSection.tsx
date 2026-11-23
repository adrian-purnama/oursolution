import { useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import HeroBuilders, { BUILD_SECONDS } from '#/components/home/HeroBuilders'
import HeroVisual from '#/components/home/HeroVisual'
import { Button } from '#/components/ui/button'
import { BRAND_NAME, CONTACT_URL } from '#/lib/config'
import { MOTION_OK, gsap, useGSAP } from '#/lib/gsap'

const lineMask = 'block overflow-hidden pb-[0.12em] -mb-[0.12em]'

const ASSURANCES = [
  'Software solutions',
  'Hosting solutions',
  'answr.id chatbot',
]

/**
 * Centered hero: the promise, two ways in, the three services by name, and
 * a moving example of what we deliver. On load three teammates' cursors lay
 * the blocks out (see HeroBuilders) and the backdrop keeps breathing; with
 * reduced motion everything is simply there.
 */
export default function HeroSection() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(MOTION_OK, () => {
        // The backdrop breathes: the accent grid glows and dims, and the
        // light behind it swells and drifts a little.
        gsap.to('[data-hero-grid-glow]', {
          opacity: 1,
          duration: 3.6,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        })
        gsap.to('[data-hero-light]', {
          x: 70,
          scale: 1.12,
          opacity: 0.6,
          duration: 7,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        })
      })
    },
    { scope: root },
  )

  return (
    <section
      ref={root}
      className="relative overflow-hidden border-b border-[var(--line)] bg-white text-[var(--ink)]"
    >
      {/* Backdrop: a faint grid that fades out, under a soft accent light.
          A second grid in the accent color sits on top and slowly glows and
          dims, while the light behind it drifts. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,black,transparent)] bg-[linear-gradient(to_right,rgba(0,32,96,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,32,96,0.06)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden
        data-hero-grid-glow
        className="pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_55%_50%_at_50%_0%,black,transparent)] bg-[linear-gradient(to_right,color-mix(in_srgb,var(--accent)_32%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--accent)_32%,transparent)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden
        data-hero-light
        className="pointer-events-none absolute -top-56 left-1/2 h-[30rem] w-[56rem] max-w-none -translate-x-1/2 rounded-full bg-[var(--accent)]/15 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 text-center sm:pt-24">
        <HeroBuilders />
        <h1 className="font-display mb-6 max-w-4xl text-[clamp(2.5rem,6.6vw,5.25rem)] leading-[1.02]">
          <span data-build="title1" className={lineMask}>
            <span data-hero-line className="block">
              We build your software.
            </span>
          </span>
          <span data-build="title2" className={lineMask}>
            <span data-hero-line className="block text-[var(--accent)]">
              Then we keep it running.
            </span>
          </span>
        </h1>

        <p
          data-build="copy"
          data-hero-fade
          className="mb-9 max-w-2xl text-lg leading-relaxed text-[var(--muted)]"
        >
          {BRAND_NAME} is a software studio with its own hosting. We design and
          ship the system your business needs, run ready-made tools on servers
          we manage, and make answr, an AI chatbot for your website.
        </p>

        <div
          data-build="actions"
          data-hero-fade
          className="flex flex-wrap justify-center gap-3"
        >
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
          data-build="assure"
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

        <div
          data-build="visual"
          data-hero-fade
          className="mt-14 w-full sm:mt-20"
        >
          <HeroVisual introDelay={BUILD_SECONDS} />
        </div>
      </div>
    </section>
  )
}
