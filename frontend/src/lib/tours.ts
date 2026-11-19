import { useCallback, useState } from 'react'
import { useAuth } from '#/context/authContext'

/**
 * Guided tours a customer sees once. Kept in this browser, per account:
 * the user record has no place for preferences, and seeing a tour twice
 * on a new device does no harm.
 *
 * - `welcome`: the dashboard with no services yet.
 * - `firstService`: after the first purchase. `panel` means the dashboard
 *   part is over and the control panel part is next.
 */
export type TourId = 'welcome' | 'firstService'
export type TourStage = 'panel' | 'done'

function storageKey(tour: TourId, email: string): string {
  return `fedier:tour:${tour}:${email.toLowerCase()}`
}

function readStage(tour: TourId, email: string): TourStage | null {
  try {
    const value = window.localStorage.getItem(storageKey(tour, email))
    return value === 'panel' || value === 'done' ? value : null
  } catch {
    return null
  }
}

function writeStage(tour: TourId, email: string, stage: TourStage): void {
  try {
    window.localStorage.setItem(storageKey(tour, email), stage)
  } catch {
    // Without storage the tour may show again; nothing else breaks.
  }
}

/**
 * Where the signed-in user is in a tour, and a setter that remembers it.
 * `undefined` while nobody is signed in.
 */
export function useTourStage(
  tour: TourId,
): [TourStage | null | undefined, (stage: TourStage) => void] {
  const { user } = useAuth()
  const email = user?.email
  const [saved, setSaved] = useState<{
    email: string
    stage: TourStage | null
  } | null>(null)

  const stage =
    email === undefined
      ? undefined
      : saved?.email === email
        ? saved.stage
        : readStage(tour, email)

  const setStage = useCallback(
    (next: TourStage) => {
      if (email === undefined) return
      writeStage(tour, email, next)
      setSaved({ email, stage: next })
    },
    [tour, email],
  )

  return [stage, setStage]
}
