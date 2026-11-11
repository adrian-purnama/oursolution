import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'
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
import type { DokployProject } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** A searchable dropdown of the projects on the Dokploy server. */
export default function DokployProjectCombobox({
  id,
  value,
  onChange,
}: {
  id: string
  /** The chosen project's id, or '' for none. */
  value: string
  onChange: (projectId: string) => void
}) {
  const [projects, setProjects] = useState<DokployProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<DokployProject[]>(
        '/admin/dokploy/projects',
      )
      if (!response.success || !response.data) {
        setError(response.message || 'Failed to load Dokploy projects')
        return
      }
      setProjects(response.data)
    } catch {
      setError('Unable to reach the server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selected = projects.find((project) => project.id === value)
  const label = selected
    ? selected.name
    : loading
      ? 'Loading projects…'
      : value
        ? 'A project that no longer exists'
        : 'Choose a project…'

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!loading && !error && Boolean(value) && !selected}
            disabled={loading || Boolean(error)}
            className="w-full justify-between bg-white font-normal sm:w-80"
          >
            <span
              className={cn('truncate', !selected && 'text-[var(--muted)]')}
            >
              {label}
            </span>
            {loading ? (
              <LoaderCircle className="animate-spin opacity-60" aria-hidden />
            ) : (
              <ChevronsUpDown className="opacity-50" aria-hidden />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
        >
          <Command>
            <CommandInput placeholder="Search projects…" />
            <CommandList>
              <CommandEmpty>No project matches.</CommandEmpty>
              <CommandGroup>
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    keywords={[project.name, project.description]}
                    onSelect={() => {
                      onChange(project.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 self-start',
                        project.id === value ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{project.name}</span>
                      {project.description ? (
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {project.description}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--destructive)]">
          {error}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </p>
      ) : !loading && projects.length === 0 ? (
        <p className={`text-xs ${hintClassName}`}>
          Dokploy has no projects yet. Create one there, then reload.
        </p>
      ) : null}
    </div>
  )
}
