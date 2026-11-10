import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import type { PricingPlan } from '#/lib/plan'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; plans: PricingPlan[] }

export default function PricingGrid() {
  const { isAuthenticated, user } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })

  async function load() {
    setState({ status: 'loading' })
    try {
      const response = await apiFetch<PricingPlan[]>('/plans/pricing')
      if (!response.success || !response.data) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', plans: response.data })
    } catch {
      setState({ status: 'error' })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (state.status === 'loading') {
    return (
      <div className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Loading plans…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={`${cardClassName} px-4 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>Pricing could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (state.plans.length === 0) {
    return <p className={hintClassName}>No plans are published yet.</p>
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {state.plans.map((plan) => {
        const isCurrent = user?.plan.id === plan.id
        return (
          <li
            key={plan.id}
            className={`${cardClassName} flex flex-col overflow-hidden`}
          >
            <div
              aria-hidden
              className="h-1.5"
              style={{ backgroundColor: plan.color }}
            />
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-lg font-semibold text-[var(--ink)]">
                {plan.name}
              </h2>
              <p className="font-display mt-3 mb-6 text-3xl text-[var(--ink)]">
                {plan.pricingText || 'Contact us'}
              </p>
              <div className="mt-auto">
                {isCurrent ? (
                  <p className={hintClassName}>Your current plan</p>
                ) : isAuthenticated ? null : (
                  <Button asChild className="w-full">
                    <Link to="/register">Get started</Link>
                  </Button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
