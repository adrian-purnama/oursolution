import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import Tour from '#/components/tour/Tour'
import type { TourStep } from '#/components/tour/Tour'
import { fireConfetti } from '#/components/tour/confetti'
import type { Deployment } from '#/lib/deployment'
import { useTourStage } from '#/lib/tours'
import type { TourId } from '#/lib/tours'

/**
 * The header's account menu; on small screens the profile link at the
 * bottom of the menu drawer, which the step opens.
 */
const PROFILE_TARGETS = [
  '[data-tour="profile"]',
  '[data-tour="profile-drawer"]',
]

/** On small screens, opens the menu drawer unless it is open already. */
function openMobileMenu() {
  const button = document.querySelector<HTMLElement>(
    '[data-tour="profile-mobile"]',
  )
  if (!button || button.getBoundingClientRect().width === 0) return
  if (button.getAttribute('aria-expanded') !== 'true') button.click()
}

function welcomeSteps(hasServices: boolean): TourStep[] {
  return [
    {
      target: '[data-tour="shop"]',
      title: 'The shop',
      body: hasServices
        ? 'Find new services here, or extend the ones you have.'
        : "You don't have any services yet. Find them in the shop, where you can also extend them later.",
    },
    {
      target: '[data-tour="tickets"]',
      title: 'Need help?',
      body: 'If something goes wrong, open a ticket here and we will get back to you.',
    },
    {
      target: PROFILE_TARGETS,
      onEnter: openMobileMenu,
      title: 'Your profile',
      body: "Reset your password here, or link your Google account if you haven't yet.",
    },
  ]
}

/**
 * The dashboard's tours: a welcome for a customer with no services, and
 * a celebration after the first purchase that leads into the service's
 * control panel. Each shows once; `replay` (from the profile) shows one
 * again.
 */
export default function DashboardTours({
  deployments,
  replay,
  onReplayEnd,
}: {
  /** Null while loading. */
  deployments: Deployment[] | null
  replay?: TourId
  onReplayEnd: () => void
}) {
  const navigate = useNavigate()
  const [welcome, setWelcome] = useTourStage('welcome')
  const [firstService, setFirstService] = useTourStage('firstService')
  /** The tour on screen. Held so saving progress does not close it. */
  const [running, setRunning] = useState<TourId | null>(null)
  const [closed, setClosed] = useState(false)

  const first = deployments?.at(0)
  const due: TourId | null =
    replay ??
    (deployments === null
      ? null
      : deployments.length === 0
        ? welcome === null
          ? 'welcome'
          : null
        : // Just one: an older customer with several gets no "first service".
          deployments.length === 1 && firstService === null
          ? 'firstService'
          : null)

  useEffect(() => {
    if (!closed && running === null && due !== null) {
      if (due === 'firstService' && !first) return
      setRunning(due)
    }
  }, [due, closed, running, first])

  if (running === null) return null

  function close() {
    setRunning(null)
    setClosed(true)
    if (replay) onReplayEnd()
  }

  if (running === 'welcome') {
    return (
      <Tour
        label="Welcome tour"
        steps={welcomeSteps((deployments?.length ?? 0) > 0)}
        onEnd={() => {
          setWelcome('done')
          close()
        }}
      />
    )
  }

  if (!first) return null
  const openPanel = () =>
    void navigate({
      to: '/dashboard/deployments/$productId',
      params: { productId: first.product.id },
    })

  return (
    <Tour
      label="Your first service"
      steps={[
        {
          title: 'Yay, this is your first service!',
          body: `${first.product.name} is yours. Let's take a quick look at how to get it running.`,
          nextLabel: "Let's go",
          onShow: () => fireConfetti(),
        },
        {
          target: '[data-tour="service"]',
          title: 'Open your service',
          body: 'Press it to open its control panel, where you set it up and turn it on.',
          interactive: true,
          nextLabel: 'Open it',
          onNext: openPanel,
          // From here the control panel takes over, wherever it is opened.
          onShow: () => {
            setFirstService('panel')
            setWelcome('done')
            // So going back to the dashboard does not replay it.
            if (replay) onReplayEnd()
          },
        },
      ]}
      onEnd={(end) => {
        if (end === 'skipped') {
          setFirstService('done')
          close()
          return
        }
        // "Open it" is on its way to the control panel; leave the URL be.
        setRunning(null)
        setClosed(true)
      }}
    />
  )
}
