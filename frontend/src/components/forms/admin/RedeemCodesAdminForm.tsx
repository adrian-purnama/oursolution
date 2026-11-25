import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from '@tanstack/react-router'
import { Copy, LoaderCircle, Plus, Ticket, Trash2 } from 'lucide-react'
import ProductBadge from '#/components/ProductBadge'
import CreateRedeemCodesDialog from '#/components/forms/admin/CreateRedeemCodesDialog'
import ListPagination from '#/components/forms/shared/ListPagination'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { apiFetch } from '#/lib/api'
import { formatDateTime } from '#/lib/product'
import {
  REDEEM_CODE_GROUPS,
  redeemLengthText,
  redeemStartText,
} from '#/lib/redeem'
import type {
  RedeemCode,
  RedeemCodeGroup,
  RedeemCodeList,
  RedeemCodeUser,
} from '#/lib/redeem'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

const PAGE_SIZE = 20

type State =
  | { status: 'loading'; list: RedeemCodeList | null }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: RedeemCodeList }

const STATUS_LABEL: Record<RedeemCode['status'], string> = {
  available: 'Not redeemed',
  redeemed: 'Redeemed',
  expired: 'Expired',
}

const STATUS_CLASS: Record<RedeemCode['status'], string> = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  redeemed: 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]',
  expired: 'border-amber-200 bg-amber-50 text-amber-800',
}

function UserCell({
  user,
  at,
}: {
  user: RedeemCodeUser | null
  at: string | null
}) {
  if (!at) return <span className="text-[var(--muted)]">—</span>
  return (
    <>
      {user ? (
        <Link
          to="/admin/users/$userId"
          params={{ userId: user.id }}
          className="block max-w-[14rem] truncate"
          title={user.email}
        >
          {user.email}
        </Link>
      ) : (
        <p>—</p>
      )}
      <p className="text-xs text-[var(--muted)]">{formatDateTime(at)}</p>
    </>
  )
}

/** Admin: redeem codes by status, with who made and who used each. */
export default function RedeemCodesAdminForm() {
  const [group, setGroup] = useState<RedeemCodeGroup>('all')
  const [page, setPage] = useState(1)
  const [state, setState] = useState<State>({ status: 'loading', list: null })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<RedeemCode | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const latest = useRef(0)

  async function load() {
    const request = ++latest.current
    setState((prev) => ({
      status: 'loading',
      list: prev.status === 'error' ? null : prev.list,
    }))
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (group !== 'all') params.set('status', group)
    try {
      const res = await apiFetch<RedeemCodeList>(
        `/admin/redeem-codes?${params}`,
      )
      if (request !== latest.current) return
      if (!res.success || !res.data) {
        setState({
          status: 'error',
          message: res.message || 'Could not load codes',
        })
        return
      }
      setState({ status: 'ready', list: res.data })
    } catch {
      if (request !== latest.current) return
      setState({ status: 'error', message: 'Unable to reach the server' })
    }
  }

  useEffect(() => {
    void load()
  }, [group, page])

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const res = await apiFetch<null>(`/admin/redeem-codes/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!res.success) {
        toast.error(res.message || 'Could not delete the code')
        return
      }
      toast.success('Code deleted')
      setDeleting(null)
      void load()
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setDeleteBusy(false)
    }
  }

  const list = state.status === 'error' ? null : state.list

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Tabs
          className="min-w-0 overflow-x-auto [scrollbar-width:none]"
          value={group}
          onValueChange={(value) => {
            setGroup(value as RedeemCodeGroup)
            setPage(1)
          }}
        >
          <TabsList>
            {REDEEM_CODE_GROUPS.map(({ key, label }) => (
              <TabsTrigger key={key} value={key}>
                {label}
                {list ? (
                  <span className="ml-1.5 tabular-nums opacity-60">
                    {list.counts[key]}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          type="button"
          aria-label="New codes"
          className="shrink-0"
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden />
          <span className="hidden sm:inline">New codes</span>
        </Button>
      </div>

      {state.status === 'error' ? (
        <div className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-[var(--muted)]">{state.message}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !list ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted)]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading codes…
        </div>
      ) : list.total === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-6 py-12 text-center">
          <Ticket
            className="mx-auto mb-3 size-6 text-[var(--muted)]"
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--ink)]">
            {list.counts.all === 0 ? 'No codes yet' : 'No codes here'}
          </p>
          <p className={`mt-1 ${hintClassName}`}>
            {list.counts.all === 0
              ? 'Make a code to give someone a product.'
              : 'Try another tab.'}
          </p>
          {list.counts.all === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setCreating(true)}
            >
              New codes
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'space-y-4 transition-opacity',
            state.status === 'loading' && 'opacity-60',
          )}
          aria-busy={state.status === 'loading'}
        >
          <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-white sm:hidden">
            {list.items.map((code) => (
              <li key={code.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => void copy(code.code)}
                    className="inline-flex items-center gap-1.5 font-mono text-sm font-medium"
                    aria-label={`Copy ${code.code}`}
                  >
                    {code.code}
                    <Copy
                      className="size-3.5 text-[var(--muted)]"
                      aria-hidden
                    />
                  </button>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {code.product?.name ?? 'Erased product'} ·{' '}
                    {redeemLengthText(code)}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {code.redeemedBy
                      ? `Redeemed by ${code.redeemedBy.email}`
                      : code.validUntil
                        ? `${code.status === 'expired' ? 'Expired' : 'Valid until'} ${formatDateTime(code.validUntil)}`
                        : 'Never expires'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      STATUS_CLASS[code.status],
                    )}
                  >
                    {STATUS_LABEL[code.status]}
                  </span>
                  {code.status !== 'redeemed' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${code.code}`}
                      onClick={() => setDeleting(code)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-[var(--line)] bg-white sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Redeemed</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="align-top">
                      <button
                        type="button"
                        onClick={() => void copy(code.code)}
                        className="inline-flex items-center gap-1.5 font-mono text-sm font-medium hover:underline"
                        aria-label={`Copy ${code.code}`}
                      >
                        {code.code}
                        <Copy
                          className="size-3.5 text-[var(--muted)]"
                          aria-hidden
                        />
                      </button>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            STATUS_CLASS[code.status],
                          )}
                        >
                          {STATUS_LABEL[code.status]}
                        </span>
                        {code.validUntil
                          ? `${code.status === 'expired' ? 'Expired' : 'Valid until'} ${formatDateTime(code.validUntil)}`
                          : 'Never expires'}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      {code.product ? (
                        <ProductBadge product={code.product} />
                      ) : (
                        <span className="text-[var(--muted)]">
                          Erased product
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <p>{redeemLengthText(code)}</p>
                      {code.product?.kind !== 'oneTime' ? (
                        <p className="text-xs text-[var(--muted)]">
                          {redeemStartText(code)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <UserCell user={code.createdBy} at={code.createdAt} />
                    </TableCell>
                    <TableCell className="align-top">
                      <UserCell user={code.redeemedBy} at={code.redeemedAt} />
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {code.status !== 'redeemed' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${code.code}`}
                          onClick={() => setDeleting(code)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={list.page}
            pageSize={list.pageSize}
            totalItems={list.total}
            totalPages={Math.max(1, Math.ceil(list.total / list.pageSize))}
            onPageChange={setPage}
          />
        </div>
      )}

      <CreateRedeemCodesDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setGroup('all')
          setPage(1)
          void load()
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.code}?</DialogTitle>
            <DialogDescription>
              Nobody will be able to redeem it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void handleDelete()}
            >
              {deleteBusy ? 'Deleting…' : 'Delete code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
