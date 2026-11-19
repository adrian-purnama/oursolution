import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Compass, PartyPopper } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import type { Deployment } from '#/lib/deployment'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

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
      <div>
        <h2 className="text-sm font-medium">Guided tours</h2>
        <p className={`text-xs ${hintClassName}`}>
          Take a tour again whenever you like.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            to="/dashboard"
            search={{ tour: 'welcome' }}
            className="no-underline"
          >
            <Compass aria-hidden />
            Dashboard tour
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
              Service tour
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled>
            <PartyPopper aria-hidden />
            Service tour
          </Button>
        )}
      </div>
      {hasService === false ? (
        <p className={`text-xs ${hintClassName}`}>
          The service tour is available once you have a service.
        </p>
      ) : null}
    </section>
  )
}
