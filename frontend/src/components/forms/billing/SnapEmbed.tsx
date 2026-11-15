import { useEffect, useId, useState } from 'react'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { loadSnap } from '#/lib/billing'

type Phase = 'loading' | 'shown' | 'unavailable'

/**
 * Midtrans' payment form inside our page. Falls back to a link to Midtrans'
 * own page when Snap cannot be shown here.
 */
export default function SnapEmbed({
  token,
  redirectUrl,
  onChange,
}: {
  token: string | null
  redirectUrl: string | null
  /** Snap says something happened: look the payment up again. */
  onChange: () => void
}) {
  const embedId = `snap-${useId().replace(/:/g, '')}`
  const [phase, setPhase] = useState<Phase>(token ? 'loading' : 'unavailable')
  // Bumped to show the form again after the user closes it.
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!token) {
      setPhase('unavailable')
      return
    }
    let active = true
    setPhase('loading')
    void loadSnap().then((snap) => {
      if (!active) return
      if (!snap) {
        setPhase('unavailable')
        return
      }
      try {
        snap.embed(token, {
          embedId,
          onSuccess: onChange,
          onPending: onChange,
          onError: onChange,
          onClose: () => {
            onChange()
            setRound((value) => value + 1)
          },
        })
        setPhase('shown')
      } catch {
        setPhase('unavailable')
      }
    })
    return () => {
      active = false
      try {
        window.snap?.hide()
      } catch {
        // Nothing shown, nothing to hide.
      }
    }
    // onChange is a fresh closure each render; the form only depends on the token.
  }, [token, embedId, round])

  return (
    <div>
      {phase === 'loading' ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading payment options…
        </div>
      ) : null}
      {phase === 'unavailable' && redirectUrl ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-[var(--muted)]">
            Finish paying on Midtrans’ page.
          </p>
          <Button asChild>
            <a href={redirectUrl}>
              Open payment page
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
      ) : null}
      <div
        id={embedId}
        className={phase === 'shown' ? 'h-[38rem] w-full' : 'hidden'}
      />
    </div>
  )
}
