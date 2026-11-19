import { Power, RotateCw } from 'lucide-react'
import Tour from '#/components/tour/Tour'
import { Button } from '#/components/ui/button'
import type { TourStep } from '#/components/tour/Tour'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { ProductNotice } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** Shown in place of a service's notices while the tour is open. */
export const EXAMPLE_NOTICE: ProductNotice = {
  tone: 'info',
  text: '**Example notice.** Notes about this service, like planned maintenance or setup tips, show up here.',
}

/** Stands in for the settings of a service that has none, during the tour. */
export function ExampleSettings() {
  return (
    <section className="space-y-3" data-tour="settings">
      <div>
        <h3 className="text-sm font-medium">
          Settings
          <ExampleTag />
        </h3>
        <p className={`text-xs ${hintClassName}`}>
          This service has no settings. Services that do list them here.
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
          <p className={`text-xs ${hintClassName}`}>It can be set only once.</p>
        </div>
      </div>
    </section>
  )
}

/** A small "Example" tag for stand-ins shown during the tour. */
function ExampleTag() {
  return (
    <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs font-normal text-[var(--muted)] ring-1 ring-[var(--line)]">
      Example
    </span>
  )
}

const EXAMPLE_POWER = [
  { label: 'Restart', hint: 'Turns it off and on again.', Icon: RotateCw },
  { label: 'Turn off', hint: 'Stops it. Your data is kept.', Icon: Power },
]

/** Stands in for the power controls before the service is deployed. */
export function ExamplePowerControls() {
  return (
    <section className="space-y-3" data-tour="power">
      <h3 className="text-sm font-medium">
        Manage
        <ExampleTag />
      </h3>
      <ul className={`${cardClassName} divide-y divide-[var(--line)]`}>
        {EXAMPLE_POWER.map(({ label, hint, Icon }) => (
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

const STEPS: TourStep[] = [
  {
    target: '[data-tour="notices"]',
    title: 'Notices',
    body: 'Read these first. They hold anything you should know about this service, like maintenance or setup tips.',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings',
    body: 'Some settings must be filled in before the service can be turned on. Ones marked * can be set only once.',
  },
  {
    target: ['[data-tour="turn-on"]', '[data-tour="actions"]'],
    title: 'Turn it on',
    body: 'Once the settings are saved, press this to deploy and turn the service on.',
  },
  {
    target: '[data-tour="uptime"]',
    title: 'Uptime',
    body: "The service is checked every 5 minutes, so you always know your app's status.",
  },
  {
    target: '[data-tour="power"]',
    title: 'Power controls',
    body: 'Once it is running, turn the service off, back on, or restart it from here.',
  },
  {
    title: 'One last thing',
    body: 'After the service shows as deployed, it can take up to 15 minutes before its address works. If it still is not reachable after that, open a ticket.',
    nextLabel: 'Got it',
  },
]

/** The control panel part of the first-service tour. */
export default function PanelTour({ onEnd }: { onEnd: () => void }) {
  return <Tour label="Control panel tour" steps={STEPS} onEnd={onEnd} />
}
