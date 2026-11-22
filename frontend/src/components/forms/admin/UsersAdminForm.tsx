import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { ChevronRight, LoaderCircle, Search, UserPlus } from 'lucide-react'
import CreateUserDialog from '#/components/forms/admin/CreateUserDialog'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import ListPagination from '#/components/forms/shared/ListPagination'
import { USER_ROLE_LABELS } from '#/lib/adminUser'
import type { AdminUser } from '#/lib/adminUser'
import { apiFetch } from '#/lib/api'
import { DEFAULT_PAGE_SIZE, paginate } from '#/lib/pagination'
import { useDebouncedValue } from '#/lib/useDebouncedValue'
import { cardClassName, hintClassName, inputClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

export default function UsersAdminForm() {
  const [emailQuery, setEmailQuery] = useState('')
  const debouncedQuery = useDebouncedValue(emailQuery, 250)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<AdminUser[]>([])
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    setLoading(true)

    void (async () => {
      try {
        const params = new URLSearchParams()
        const q = debouncedQuery.trim()
        if (q) params.set('email', q)
        const path = params.size
          ? `/admin/users?${params.toString()}`
          : '/admin/users'
        const response = await apiFetch<AdminUser[]>(path)
        if (!response.success || !response.data) {
          if (!run.cancelled)
            toast.error(response.message || 'Failed to load users')
          return
        }
        if (!run.cancelled) {
          setResults(response.data)
          setPage(1)
        }
      } catch {
        if (!run.cancelled) toast.error('Unable to reach the server')
      } finally {
        if (!run.cancelled) setLoading(false)
      }
    })()

    return () => {
      run.cancelled = true
    }
  }, [debouncedQuery])

  const {
    pageItems,
    totalPages,
    page: safePage,
  } = useMemo(() => paginate(results, page, DEFAULT_PAGE_SIZE), [results, page])

  useEffect(() => {
    if (safePage !== page) setPage(safePage)
  }, [safePage, page])

  const query = debouncedQuery.trim()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={emailQuery}
            onChange={(event) => setEmailQuery(event.target.value)}
            placeholder="Search email…"
            aria-label="Search users by email"
            className={cn(inputClassName, 'pl-10')}
            autoComplete="off"
          />
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <UserPlus aria-hidden />
          Add user
        </Button>
      </div>

      {loading && results.length === 0 ? (
        <div className={`flex items-center gap-2 py-4 ${hintClassName}`}>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading users…
        </div>
      ) : results.length === 0 ? (
        <p
          className={`${cardClassName} px-4 py-8 text-center ${hintClassName}`}
        >
          {query ? `No users found for “${query}”.` : 'No users yet.'}
        </p>
      ) : (
        <div
          className={cn(
            'space-y-4 transition-opacity',
            loading && 'opacity-60',
          )}
          aria-busy={loading}
        >
          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--line)] hover:bg-transparent">
                  <TableHead className="pl-4">Email</TableHead>
                  <TableHead className="w-28">Role</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-10 pr-4">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((user) => (
                  <TableRow
                    key={user.id}
                    className="group relative cursor-pointer border-[var(--line)] hover:bg-[var(--surface)]"
                  >
                    <TableCell className="max-w-0 pl-4">
                      {/* The link covers the whole row. */}
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: user.id }}
                        title={user.email}
                        className="block truncate font-medium text-[var(--ink)] no-underline after:absolute after:inset-0"
                      >
                        {user.email}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[var(--ink)]/80">
                      {USER_ROLE_LABELS[user.role]}
                    </TableCell>
                    <TableCell>
                      {user.isBlocked ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          Blocked
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <ChevronRight
                        className="ml-auto size-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--ink)]"
                        aria-hidden
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={results.length}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
      <CreateUserDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(user) =>
          setResults((current) =>
            [...current.filter((u) => u.id !== user.id), user].sort((a, b) =>
              a.email.localeCompare(b.email),
            ),
          )
        }
      />
    </div>
  )
}
