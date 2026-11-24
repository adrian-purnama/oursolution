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
import { m } from '#/paraglide/messages'

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
        setError(res.message || m.redeem_failed())
        return
      }
      const { product, startsAt, endsAt } = res.data
      const starts = Date.parse(startsAt) > Date.now() + 60_000
      toast.success(
        product.kind === 'oneTime'
          ? m.redeem_yours({ name: product.name })
          : `${
              starts
                ? m.redeem_starts({
                    name: product.name,
                    date: formatDateTime(startsAt),
                  })
                : m.redeem_active({ name: product.name })
            }${endsAt ? m.redeem_until_suffix({ date: formatDateTime(endsAt) }) : ''}`,
      )
      setCode('')
      await refreshAuth()
    } catch {
      setError(m.common_error_network_short())
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${cardClassName} space-y-3 px-4 py-4`}>
      <div>
        <h2 className="text-sm font-medium">{m.redeem_title()}</h2>
        <p className={`text-xs ${hintClassName}`}>{m.redeem_copy()}</p>
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
          aria-label={m.redeem_aria()}
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
          {busy ? m.redeem_busy() : m.redeem_button()}
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
