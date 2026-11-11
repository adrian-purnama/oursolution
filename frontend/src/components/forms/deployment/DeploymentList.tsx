import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { ProductMark } from '#/components/ProductBadge'
import {
  BeatBar,
  Stat,
  StateBadge,
} from '#/components/forms/deployment/ServiceStatus'
import { Button } from '#/components/ui/button'
import { apiFetch } from '#/lib/api'
import { BUSY_STATES, formatDate, formatUptime } from '#/lib/deployment'
import type { Deployment } from '#/lib/deployment'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

const REFRESH_MS = 60_000

/** True when the customer should look at it. */
function needsAttention(deployment: Deployment): boolean {
  return (
    deployment.state === 'failed' ||
    deployment.status.some((item) => item.state === 'down')
  )
}

/** What to say about a service that has no checks to show. */
function quietLine(deployment: Deployment): string {
  if (BUSY_STATES.includes(deployment.state)) return 'Working on it…'
  switch (deployment.state) {
    case 'notDeployed':
      return deployment.entitled
        ? 'Ready to deploy.'
        : 'Renew the subscription to deploy.'
    case 'stopped':
      return 'Turned off. Your data is kept.'
    case 'failed':
      return 'Something went wrong. Open it to try again.'
    default:
      return 'Running.'
  }
}

const CARD_CLASS = `${cardClassName} group flex h-full w-full flex-col gap-4 p-5 text-left text-[var(--ink)] no-underline transition hover:border-[var(--ink)]`

/** The customer's own page, or (admin) a click that opens it in place. */
function CardShell({
  deployment,
  onSelect,
  children,
}: {
  deployment: Deployment
  onSelect?: (productId: string) => void
  children: ReactNode
}) {
  if (onSelect) {
    return (
      <button
        type="button"
        className={CARD_CLASS}
        onClick={() => onSelect(deployment.product.id)}
      >
        {children}
      </button>
    )
  }
  return (
    <Link
      to="/dashboard/deployments/$productId"
      params={{ productId: deployment.product.id }}
      className={CARD_CLASS}
    >
      {children}
    </Link>
  )
}

function ServiceCard({
  deployment,
  onSelect,
}: {
  deployment: Deployment
  onSelect?: (productId: string) => void
}) {
  const status = deployment.status.at(0)
  return (
    <CardShell deployment={deployment} onSelect={onSelect}>
      <div className="flex items-start gap-3">
        <ProductMark
          product={deployment.product}
          className="size-10 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{deployment.product.name}</p>
          <p className={`truncate text-sm ${hintClassName}`}>
            {deployment.hosts.at(0) ?? 'No address yet'}
          </p>
        </div>
        <StateBadge state={deployment.state} />
      </div>

      {status && status.beats.length > 0 ? (
        <BeatBar status={status} />
      ) : (
        <p
          className={
            deployment.state === 'failed'
              ? 'text-sm text-[var(--destructive)]'
              : `text-sm ${hintClassName}`
          }
        >
          {quietLine(deployment)}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 text-xs text-[var(--muted)]">
        {status?.state === 'down' ? (
          <span className="font-medium text-[var(--destructive)]">
            Not responding
          </span>
        ) : status && status.uptime !== null ? (
          <span>
            {formatUptime(status.uptime)} uptime
            {status.responseMs !== null ? ` · ${status.responseMs} ms` : ''}
          </span>
        ) : null}
        <span className="ml-auto truncate">
          {!deployment.entitled
            ? 'Subscription not active'
            : deployment.subscriptionEndsAt
              ? `Until ${formatDate(deployment.subscriptionEndsAt)}`
              : ''}
        </span>
        <ArrowRight
          className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </CardShell>
  )
}

/**
 * Services at a glance, each opening its own page. Customers see their
 * own; an admin passes a user's `apiBase` and opens cards with `onSelect`.
 */
export default function DeploymentList({
  apiBase = '/me/deployments',
  onSelect,
  admin = false,
}: {
  apiBase?: string
  onSelect?: (productId: string) => void
  admin?: boolean
}) {
  const [deployments, setDeployments] = useState<Deployment[] | null>(null)
  const [failed, setFailed] = useState(false)

  async function load(quiet: boolean) {
    if (!quiet) setFailed(false)
    try {
      const response = await apiFetch<Deployment[]>(apiBase)
      if (!response.success || !response.data) {
        if (!quiet) setFailed(true)
        return
      }
      setDeployments(response.data)
    } catch {
      if (!quiet) setFailed(true)
    }
  }

  useEffect(() => {
    void load(false)
    const timer = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [apiBase])

  if (failed) {
    return (
      <div className={`${cardClassName} px-5 py-8 text-center`}>
        <p className={`mb-3 ${hintClassName}`}>
          {admin ? 'Deployments' : 'Your services'} could not be loaded.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(false)}
        >
          Retry
        </Button>
      </div>
    )
  }
  if (!deployments) {
    return (
      <p className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {admin ? 'Loading deployments…' : 'Loading your services…'}
      </p>
    )
  }
  if (deployments.length === 0 && admin) {
    return (
      <p className={hintClassName}>
        This user has no subscription with something to deploy.
      </p>
    )
  }
  if (deployments.length === 0) {
    return (
      <div className={`${cardClassName} px-5 py-10 text-center`}>
        <p className="font-medium">No services yet</p>
        <p className={`mt-1 mb-4 ${hintClassName}`}>
          Pick a product and it shows up here, ready to deploy.
        </p>
        <Button asChild>
          <Link to="/pricing" className="no-underline">
            See products
          </Link>
        </Button>
      </div>
    )
  }

  const running = deployments.filter((item) => item.state === 'running').length
  const uptimes = deployments
    .flatMap((item) => item.status)
    .flatMap((item) => (item.uptime === null ? [] : [item.uptime]))
  const attention = deployments.filter(needsAttention).length

  return (
    <div className="space-y-4">
      <dl
        className={`${cardClassName} grid grid-cols-1 gap-px overflow-hidden bg-[var(--line)] sm:grid-cols-3`}
      >
        <Stat label="Running">
          {running}
          <span className="text-sm font-normal text-[var(--muted)]">
            {' '}
            of {deployments.length}
          </span>
        </Stat>
        <Stat label="Uptime, last 24 hours">
          {uptimes.length > 0
            ? formatUptime(
                uptimes.reduce((sum, uptime) => sum + uptime, 0) /
                  uptimes.length,
              )
            : '—'}
        </Stat>
        <Stat label="Needs attention">
          {attention > 0 ? (
            <span className="text-[var(--destructive)]">{attention}</span>
          ) : (
            <span>
              0
              <span className="text-sm font-normal text-[var(--muted)]">
                {' '}
                all good
              </span>
            </span>
          )}
        </Stat>
      </dl>

      <ul className="grid gap-4 sm:grid-cols-2">
        {deployments.map((deployment) => (
          <li key={deployment.product.id}>
            <ServiceCard deployment={deployment} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  )
}
