import { createFileRoute } from '@tanstack/react-router'
import FinalCta from '#/components/home/FinalCta'
import HeroSection from '#/components/home/HeroSection'
import RevealScope from '#/components/home/RevealScope'
import ServicesOverview from '#/components/home/ServicesOverview'
import WhyUs from '#/components/home/WhyUs'
import { DEFAULT_KEYWORDS, seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  head: () => seo({ path: '/', keywords: DEFAULT_KEYWORDS }),
  component: HomePage,
})

/** Who we are, the three services, why us, and how to start. */
function HomePage() {
  return (
    <RevealScope className="overflow-x-clip bg-white text-[var(--ink)]">
      <HeroSection />
      <ServicesOverview />
      <WhyUs />
      <FinalCta />
    </RevealScope>
  )
}
