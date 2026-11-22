import { useEffect } from 'react'
import {
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import FinalCta from '#/components/home/FinalCta'
import HeroSection from '#/components/home/HeroSection'
import RevealScope from '#/components/home/RevealScope'
import ServicesOverview from '#/components/home/ServicesOverview'
import WhyUs from '#/components/home/WhyUs'
import { useAuth } from '#/context/authContext'
import { wantsHome } from '#/lib/home'
import { DEFAULT_KEYWORDS, seo } from '#/lib/seo'

export const Route = createFileRoute('/')({
  head: () => seo({ path: '/', keywords: DEFAULT_KEYWORDS }),
  component: HomePage,
})

/**
 * Who we are, the three services, why us, and how to start. A signed-in
 * user goes on to the dashboard, unless they picked the home page from a
 * menu (`showHome` in the history state).
 */
function HomePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const showHome = useRouterState({
    select: (state) => wantsHome(state.location.state),
  })

  useEffect(() => {
    if (!isLoading && isAuthenticated && !showHome) {
      void navigate({ to: '/dashboard', replace: true })
    }
  }, [isLoading, isAuthenticated, showHome, navigate])

  return (
    <RevealScope className="overflow-x-clip bg-white text-[var(--ink)]">
      <HeroSection />
      <ServicesOverview />
      <WhyUs />
      <FinalCta />
    </RevealScope>
  )
}
