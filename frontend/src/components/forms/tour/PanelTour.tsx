import { Power, RotateCw } from 'lucide-react'
import Tour from '#/components/tour/Tour'
import { Button } from '#/components/ui/button'
import type { TourStep } from '#/components/tour/Tour'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { ProductNotice } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

/** Shown in place of a service's notices while the tour is open. */
export const EXAMPLE_NOTICE: ProductNotice = {
  tone: 'info',
  get text() {
    return m.tour_example_notice()
  },
}

/** Stands in for the settings of a service that has none, during the tour. */
export function ExampleSettings() {
  return (
    <section className="space-y-3" data-tour="settings">
      <div>
        <h3 className="text-sm font-medium">
          {m.tour_settings_title()}
          <ExampleTag />
        </h3>
        <p className={`text-xs ${hintClassName}`}>
          {m.tour_example_settings_empty()}
        </p>
      </div>
      <div
        className={`${cardClassName} grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2`}
      >
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="tour-example-setting">
            <span className="font-mono text-[13px]">
              ADMIN_EMAIL
              <span
                aria-hidden
                className="ml-0.5 font-sans text-[var(--destructive)]"
              >
                *
              </span>
            </span>
          </Label>
          <Input
            id="tour-example-setting"
            disabled
            placeholder="you@example.com"
            className="bg-white font-mono text-[13px] md:text-[13px]"
          />
          <p className={`text-xs ${hintClassName}`}>{m.panel_once()}</p>
        </div>
      </div>
    </section>
  )
}

/** A small "Example" tag for stand-ins shown during the tour. */
function ExampleTag() {
  return (
    <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-normal text-[var(--muted)] ring-1 ring-[var(--line)]">
      {m.tour_example_tag()}
    </span>
  )
}

const examplePower = () => [
  {
    label: m.tour_example_restart(),
    hint: m.tour_example_restart_hint(),
    Icon: RotateCw,
  },
  {
    label: m.tour_example_off(),
    hint: m.tour_example_off_hint(),
    Icon: Power,
  },
]

/** Stands in for the power controls before the service is deployed. */
export function ExamplePowerControls() {
  return (
    <section className="space-y-3" data-tour="power">
      <h3 className="text-sm font-medium">
        {m.panel_manage()}
        <ExampleTag />
      </h3>
      <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
        {examplePower().map(({ label, hint, Icon }) => (
          <li
            key={label}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
          >
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm font-medium">{label}</p>
              <p className={`text-xs ${hintClassName}`}>{hint}</p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled>
              <Icon aria-hidden />
              {label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const steps = (): TourStep[] => [
  {
    target: '[data-tour="notices"]',
    title: m.tour_notices_title(),
    body: m.tour_notices_body(),
  },
  {
    target: '[data-tour="settings"]',
    title: m.tour_settings_title(),
    body: m.tour_settings_body(),
  },
  {
    target: ['[data-tour="turn-on"]', '[data-tour="actions"]'],
    title: m.tour_on_title(),
    body: m.tour_on_body(),
  },
  {
    target: '[data-tour="uptime"]',
    title: m.tour_uptime_title(),
    body: m.tour_uptime_body(),
  },
  {
    target: '[data-tour="power"]',
    title: m.tour_power_title(),
    body: m.tour_power_body(),
  },
  {
    title: m.tour_last_title(),
    body: m.tour_last_body(),
    nextLabel: m.tour_last_next(),
  },
]

/** The control panel part of the first-service tour. */
export default function PanelTour({ onEnd }: { onEnd: () => void }) {
  return <Tour label={m.tour_panel_label()} steps={steps()} onEnd={onEnd} />
}
