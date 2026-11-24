import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { ProductMark } from '#/components/ProductBadge'
import BulkDeploymentActions, {
  bulkKey,
} from '#/components/forms/admin/BulkDeploymentActions'
import {
  BeatBar,
  Stat,
  StateBadge,
} from '#/components/forms/deployment/ServiceStatus'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { apiFetch } from '#/lib/api'
import ExpiryNotice from '#/components/forms/deployment/ExpiryNotice'
import {
  BUSY_STATES,
  expiryOf,
  formatDate,
  formatDaysLeft,
  formatUptime,
} from '#/lib/deployment'
import type { Deployment } from '#/lib/deployment'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

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
  if (BUSY_STATES.includes(deployment.state)) return m.dep_list_working()
  switch (deployment.state) {
    case 'notDeployed':
      return deployment.entitled
        ? m.dep_list_ready()
        : m.dep_list_expired_deploy()
    case 'stopped':
      return m.dep_list_stopped()
    case 'failed':
      return m.dep_list_failed()
    default:
      return m.dep_list_running()
  }
}

const CARD_CLASS = `${cardClassName} group flex h-full w-full flex-col gap-4 p-4 text-left sm:p-5 text-[var(--ink)] no-underline transition hover:border-[var(--ink)]`

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
        data-tour="service"
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
      data-tour="service"
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
  const expiry = expiryOf(deployment)
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
            {deployment.hosts.at(0) ?? m.dep_list_no_address()}
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
            {m.dep_list_down()}
          </span>
        ) : status && status.uptime !== null ? (
          <span>
            {m.dep_list_uptime({ uptime: formatUptime(status.uptime) })}
            {status.responseMs !== null
              ? m.dep_list_ms({ ms: status.responseMs })
              : ''}
          </span>
        ) : null}
        <span
          className={cn(
            'ml-auto truncate',
            expiry?.kind === 'expired' &&
              'font-medium text-[var(--destructive)]',
            expiry?.kind === 'expiring' && 'font-medium text-amber-700',
          )}
        >
          {expiry?.kind === 'expired'
            ? m.dep_list_expired()
            : expiry?.kind === 'expiring'
              ? m.dep_list_ends({ when: formatDaysLeft(expiry.daysLeft) })
              : deployment.subscriptionEndsAt
                ? m.dep_list_until({
                    date: formatDate(deployment.subscriptionEndsAt),
                  })
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
  bulkUserId,
}: {
  apiBase?: string
  onSelect?: (productId: string) => void
  admin?: boolean
  /** Admin: whose deployments, so they can be selected and acted on at once. */
  bulkUserId?: string
}) {
  const [deployments, setDeployments] = useState<Deployment[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

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
          {admin ? m.dep_list_failed_load_admin() : m.dep_list_failed_load()}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(false)}
        >
          {m.common_retry()}
        </Button>
      </div>
    )
  }
  if (!deployments) {
    return (
      <p className={`flex items-center gap-2 ${hintClassName}`}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {admin ? m.dep_list_loading_admin() : m.dep_list_loading()}
      </p>
    )
  }
  if (deployments.length === 0 && admin) {
    return <p className={hintClassName}>{m.dep_list_user_none()}</p>
  }
  if (deployments.length === 0) {
    return (
      <div className={`${cardClassName} px-5 py-10 text-center`}>
        <p className="font-medium">{m.dep_list_none_title()}</p>
        <p className={`mt-1 mb-4 ${hintClassName}`}>{m.dep_list_none_copy()}</p>
        <Button asChild>
          <Link to="/pricing" className="no-underline">
            {m.dep_list_see_products()}
          </Link>
        </Button>
      </div>
    )
  }

  const selection: Selection | undefined = bulkUserId
    ? {
        has: (productId) => selected.has(bulkKey(bulkUserId, productId)),
        toggle: (productId, on) => {
          const next = new Set(selected)
          const key = bulkKey(bulkUserId, productId)
          if (on) next.add(key)
          else next.delete(key)
          setSelected(next)
        },
      }
    : undefined

  const expired = admin
    ? []
    : deployments.filter((item) => expiryOf(item)?.kind === 'expired')
  if (expired.length === 0) {
    return (
      <div className="space-y-4">
        {bulkUserId ? (
          <BulkDeploymentActions
            shown={deployments.map((item) => ({
              key: bulkKey(bulkUserId, item.product.id),
              userId: bulkUserId,
              productId: item.product.id,
            }))}
            selected={selected}
            onSelectedChange={setSelected}
            onDone={() => load(true)}
          />
        ) : null}
        <Overview
          deployments={deployments}
          onSelect={onSelect}
          admin={admin}
          selection={selection}
        />
      </div>
    )
  }
  const active = deployments.filter((item) => !expired.includes(item))

  return (
    <Tabs defaultValue="active">
      <TabsList className="mb-4">
        <TabsTrigger value="active">
          {m.dep_list_tab_active()}
          <span className="text-[var(--muted)]">{active.length}</span>
        </TabsTrigger>
        <TabsTrigger value="expired">
          {m.dep_list_tab_expired()}
          <span className="text-[var(--muted)]">{expired.length}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active">
        {active.length > 0 ? (
          <Overview deployments={active} onSelect={onSelect} admin={admin} />
        ) : (
          <div className={`${cardClassName} px-5 py-10 text-center`}>
            <p className="font-medium">{m.dep_list_no_active_title()}</p>
            <p className={`mt-1 ${hintClassName}`}>
              {m.dep_list_no_active_copy()}
            </p>
          </div>
        )}
      </TabsContent>
      <TabsContent value="expired" className="space-y-3">
        <p className={`text-sm ${hintClassName}`}>
          {m.dep_list_expired_copy()}
        </p>
        <ServiceGrid deployments={expired} onSelect={onSelect} />
      </TabsContent>
    </Tabs>
  )
}

/** Admin: which cards are ticked for a bulk action. */
type Selection = {
  has: (productId: string) => boolean
  toggle: (productId: string, on: boolean) => void
}

function ServiceGrid({
  deployments,
  onSelect,
  selection,
}: {
  deployments: Deployment[]
  onSelect?: (productId: string) => void
  selection?: Selection
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {deployments.map((deployment) => (
        <li
          key={deployment.product.id}
          className={cn('min-w-0', selection && 'flex items-start gap-3')}
        >
          {selection ? (
            <Checkbox
              className="mt-5 bg-white"
              checked={selection.has(deployment.product.id)}
              aria-label={m.dep_list_select({ name: deployment.product.name })}
              onCheckedChange={(checked) =>
                selection.toggle(deployment.product.id, checked === true)
              }
            />
          ) : null}
          <div className="h-full min-w-0 flex-1">
            <ServiceCard deployment={deployment} onSelect={onSelect} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Stats, the ending-soon reminder, and the cards. */
function Overview({
  deployments,
  onSelect,
  admin,
  selection,
}: {
  deployments: Deployment[]
  onSelect?: (productId: string) => void
  admin: boolean
  selection?: Selection
}) {
  const running = deployments.filter((item) => item.state === 'running').length
  const uptimes = deployments
    .flatMap((item) => item.status)
    .flatMap((item) => (item.uptime === null ? [] : [item.uptime]))
  const attention = deployments.filter(needsAttention).length

  return (
    <div className="space-y-4">
      {admin ? null : <ExpiryNotice deployments={deployments} />}
      <dl
        className={`${cardClassName} grid grid-cols-3 gap-px overflow-hidden bg-[var(--line)]`}
      >
        <Stat label={m.dep_list_stat_running()}>
          {running}
          <span className="text-sm font-normal text-[var(--muted)]">
            {m.dep_list_of({ count: deployments.length })}
          </span>
        </Stat>
        <Stat label={m.dep_list_stat_uptime()}>
          {uptimes.length > 0
            ? formatUptime(
                uptimes.reduce((sum, uptime) => sum + uptime, 0) /
                  uptimes.length,
              )
            : '—'}
        </Stat>
        <Stat label={m.dep_list_stat_attention()}>
          {attention > 0 ? (
            <span className="text-[var(--destructive)]">{attention}</span>
          ) : (
            <span>
              0
              <span className="hidden text-sm font-normal text-[var(--muted)] sm:inline">
                {m.dep_list_all_good()}
              </span>
            </span>
          )}
        </Stat>
      </dl>

      <ServiceGrid
        deployments={deployments}
        onSelect={onSelect}
        selection={selection}
      />
    </div>
  )
}
