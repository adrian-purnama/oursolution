import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Compass, PartyPopper } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import type { Deployment } from '#/lib/deployment'
import { cardClassName } from '#/lib/ui-classes'
import { m } from '#/paraglide/messages'

/** Plays the dashboard tours again, on the dashboard. */
export default function TourReplay() {
  /** Null while loading; the service tour needs a service to show. */
  const [hasService, setHasService] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<Deployment[]>('/me/deployments')
      .then((response) => {
        if (!cancelled) {
          setHasService(response.success && (response.data ?? []).length > 0)
        }
      })
      .catch(() => {
        if (!cancelled) setHasService(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className={`${cardClassName} space-y-3 px-4 py-4`}>
      <h2 className="text-sm font-medium">{m.replay_title()}</h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/dashboard"
            search={{ tour: 'welcome' }}
            className="no-underline"
          >
            <Compass aria-hidden />
            {m.replay_dashboard()}
          </Link>
        </Button>
        {hasService ? (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/dashboard"
              search={{ tour: 'firstService' }}
              className="no-underline"
            >
              <PartyPopper aria-hidden />
              {m.replay_service()}
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title={m.replay_service_hint()}
          >
            <PartyPopper aria-hidden />
            {m.replay_service()}
          </Button>
        )}
      </div>
    </section>
  )
}
