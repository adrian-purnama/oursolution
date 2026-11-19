import { useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Gift } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import { formatRedeemInput } from '#/lib/redeem'
import type { RedeemResult } from '#/lib/redeem'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

/** A user redeems a code for a product. */
export default function RedeemCodeForm() {
  const { refreshAuth } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete = code.length === 14

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!complete) return
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<RedeemResult>('/me/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      if (!res.success || !res.data) {
        setError(res.message || 'Could not redeem the code')
        return
      }
      const { product, startsAt, endsAt } = res.data
      const starts = Date.parse(startsAt) > Date.now() + 60_000
      toast.success(
        product.kind === 'oneTime'
          ? `${product.name} is yours`
          : `${product.name} ${starts ? `starts ${formatDateTime(startsAt)}` : 'is active'}${endsAt ? ` until ${formatDateTime(endsAt)}` : ''}`,
      )
      setCode('')
      await refreshAuth()
    } catch {
      setError('Unable to reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${cardClassName} space-y-3 px-4 py-4`}>
      <div>
        <h2 className="text-sm font-medium">Redeem a code</h2>
        <p className={`text-xs ${hintClassName}`}>
          Got a code? Enter it to add the product to your account.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Input
          value={code}
          onChange={(event) => {
            setCode(formatRedeemInput(event.target.value))
            setError(null)
          }}
          placeholder="XXXX-XXXX-XXXX"
          aria-label="Redeem code"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'redeem-error' : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={14}
          className="font-mono uppercase tracking-wider sm:max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={busy || !complete}>
          <Gift aria-hidden />
          {busy ? 'Redeeming…' : 'Redeem'}
        </Button>
      </form>
      {error ? (
        <p id="redeem-error" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  )
}
