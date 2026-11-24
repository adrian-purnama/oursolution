import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import Tour from '#/components/tour/Tour'
import type { TourStep } from '#/components/tour/Tour'
import { fireConfetti } from '#/components/tour/confetti'
import type { Deployment } from '#/lib/deployment'
import { useTourStage } from '#/lib/tours'
import type { TourId } from '#/lib/tours'
import { m } from '#/paraglide/messages'

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
      title: m.tour_shop_title(),
      body: hasServices ? m.tour_shop_body_has() : m.tour_shop_body_none(),
    },
    {
      target: '[data-tour="tickets"]',
      title: m.tour_help_title(),
      body: m.tour_help_body(),
    },
    {
      target: PROFILE_TARGETS,
      onEnter: openMobileMenu,
      title: m.tour_profile_title(),
      body: m.tour_profile_body(),
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
        label={m.tour_welcome_label()}
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
      label={m.tour_first_label()}
      steps={[
        {
          title: m.tour_first_title(),
          body: m.tour_first_body({ name: first.product.name }),
          nextLabel: m.tour_first_next(),
          onShow: () => fireConfetti(),
        },
        {
          target: '[data-tour="service"]',
          title: m.tour_open_title(),
          body: m.tour_open_body(),
          interactive: true,
          nextLabel: m.tour_open_next(),
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
