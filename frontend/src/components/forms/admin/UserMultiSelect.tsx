import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, LoaderCircle, Plus, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { apiFetch } from '#/lib/api'
import type { AdminUser } from '#/lib/adminUser'
import type { BroadcastRecipient } from '#/lib/broadcast'
import { useDebouncedValue } from '#/lib/useDebouncedValue'
import { cn } from '#/lib/utils'

/** Search users by email and pick several; picked ones show as chips. */
export default function UserMultiSelect({
  value,
  onChange,
}: {
  value: BroadcastRecipient[]
  onChange: (users: BroadcastRecipient[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const [results, setResults] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const q = debounced.trim()
    apiFetch<AdminUser[]>(
      q ? `/admin/users?${new URLSearchParams({ email: q })}` : '/admin/users',
    )
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          toast.error(res.message || 'Failed to load users')
          return
        }
        setResults(res.data)
      })
      .catch(() => {
        if (!cancelled) toast.error('Unable to reach the server')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, open])

  const picked = new Set(value.map((user) => user.id))

  function toggle(user: AdminUser) {
    onChange(
      picked.has(user.id)
        ? value.filter((item) => item.id !== user.id)
        : [...value, { id: user.id, email: user.email }],
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] py-0.5 pr-1 pl-2.5 text-xs"
          >
            {user.email}
            <button
              type="button"
              aria-label={`Remove ${user.email}`}
              onClick={() =>
                onChange(value.filter((item) => item.id !== user.id))
              }
              className="rounded-full p-0.5 text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              className="h-7 rounded-full bg-white text-xs font-normal"
            >
              <Plus aria-hidden />
              Add people
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search by email…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {loading ? (
                  <div className="flex justify-center py-4">
                    <LoaderCircle
                      className="size-4 animate-spin text-[var(--muted)]"
                      aria-label="Loading"
                    />
                  </div>
                ) : (
                  <CommandEmpty>No user matches.</CommandEmpty>
                )}
                <CommandGroup>
                  {results.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      disabled={user.isBlocked}
                      onSelect={() => toggle(user)}
                    >
                      <Check
                        className={cn(
                          picked.has(user.id) ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="truncate">{user.email}</span>
                      {user.isBlocked ? (
                        <span className="ml-auto text-xs text-[var(--muted)]">
                          Blocked
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value.length > 1 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-[var(--muted)] underline-offset-4 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}
