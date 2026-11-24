import { useEffect, useId, useRef, useState } from 'react'
import { CircleCheck, LoaderCircle } from 'lucide-react'
import { openPaddleCheckout } from '#/lib/billing'
import { m } from '#/paraglide/messages'

type Phase = 'loading' | 'shown' | 'completed' | 'unavailable'

/**
 * Paddle's checkout for an invoice billed outside Indonesia, inside the
 * page like Midtrans' form: details and card on one page.
 */
export default function PaddlePay({
  transactionId,
  onChange,
}: {
  transactionId: string
  /** Paddle says something happened: look the payment up again. */
  onChange: () => void
}) {
  // Paddle finds the element by class name.
  const frameClass = `paddle-frame-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [phase, setPhase] = useState<Phase>('loading')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const controller = new AbortController()
    let stop: () => void = () => undefined
    setPhase('loading')
    void openPaddleCheckout(
      transactionId,
      frameClass,
      (event) => {
        if (event.name === 'checkout.loaded') {
          setPhase('shown')
        } else if (event.name === 'checkout.completed') {
          setPhase('completed')
          onChangeRef.current()
        } else if (event.name === 'checkout.error') {
          onChangeRef.current()
        }
      },
      controller.signal,
    ).then((result) => {
      // Unmounted just after it opened: take it away again.
      if (controller.signal.aborted) {
        result.stop()
        return
      }
      stop = result.stop
      if (!result.opened) setPhase('unavailable')
    })
    return () => {
      controller.abort()
      stop()
    }
  }, [transactionId, frameClass])

  if (phase === 'completed') {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-[var(--muted)]">
        <CircleCheck className="size-4 text-emerald-600" aria-hidden />
        {m.invoice_paddle_processing()}
      </p>
    )
  }

  return (
    <div>
      {phase === 'loading' ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {m.snap_loading()}
        </div>
      ) : null}
      {phase === 'unavailable' ? (
        <p className="p-5 text-sm text-[var(--muted)]">
          {m.invoice_paddle_unavailable()}
        </p>
      ) : null}
      <div
        className={phase === 'unavailable' ? 'hidden' : `${frameClass} px-2`}
      />
      {phase === 'shown' ? (
        <p className="px-5 pb-4 text-xs text-[var(--muted)]">
          {m.invoice_paddle_hint()}
        </p>
      ) : null}
    </div>
  )
}
