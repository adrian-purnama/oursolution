import { useEffect, useRef, useState } from 'react'
import { CircleCheck, LoaderCircle, Lock } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { openPaddleCheckout } from '#/lib/billing'
import { m } from '#/paraglide/messages'

type Phase = 'idle' | 'opening' | 'open' | 'completed' | 'unavailable'

/**
 * Paddle's checkout for an invoice billed outside Indonesia. It opens over
 * the page by itself the first time, and again from the button.
 */
export default function PaddlePay({
  transactionId,
  amount,
  onChange,
}: {
  transactionId: string
  /** Formatted, e.g. "$9.00". */
  amount: string
  /** Paddle says something happened: look the payment up again. */
  onChange: () => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const stopRef = useRef<() => void>(() => undefined)
  const openedFor = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  async function open() {
    stopRef.current()
    setPhase('opening')
    const { opened, stop } = await openPaddleCheckout(
      transactionId,
      (event) => {
        if (event.name === 'checkout.completed') {
          setPhase('completed')
          onChangeRef.current()
        } else if (event.name === 'checkout.closed') {
          setPhase((current) => (current === 'completed' ? current : 'idle'))
          onChangeRef.current()
        }
      },
    )
    stopRef.current = stop
    setPhase(opened ? 'open' : 'unavailable')
  }

  useEffect(() => {
    if (openedFor.current !== transactionId) {
      openedFor.current = transactionId
      void open()
    }
    return () => stopRef.current()
  }, [transactionId])

  if (phase === 'completed') {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-[var(--muted)]">
        <CircleCheck className="size-4 text-emerald-600" aria-hidden />
        {m.invoice_paddle_processing()}
      </p>
    )
  }

  return (
    <div className="space-y-3 p-5">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={phase === 'opening'}
        onClick={() => void open()}
      >
        {phase === 'opening' ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Lock className="size-4" aria-hidden />
        )}
        {m.invoice_paddle_open({ amount })}
      </Button>
      <p className="text-xs text-[var(--muted)]">
        {phase === 'unavailable'
          ? m.invoice_paddle_unavailable()
          : m.invoice_paddle_hint()}
      </p>
    </div>
  )
}
