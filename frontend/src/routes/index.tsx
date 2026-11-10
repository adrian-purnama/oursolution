import { createFileRoute } from '@tanstack/react-router'
import FeatureGrid from '#/components/home/FeatureGrid'
import FinalCta from '#/components/home/FinalCta'
import HeroSection from '#/components/home/HeroSection'
import HowItWorks from '#/components/home/HowItWorks'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="bg-[var(--ink)] text-[var(--paper)]">
      <HeroSection />
      <FeatureGrid />
      <HowItWorks />
      <FinalCta />
    </main>
  )
}
