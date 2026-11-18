import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  LoaderCircle,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react'
import DokployProjectCombobox from '#/components/forms/admin/DokployProjectCombobox'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import { VARIABLE_VISIBILITY_LABELS } from '#/lib/product'
import type {
  ComposeIssue,
  DeploymentCheck,
  DeploymentCommand,
  DeploymentVariable,
  ProductDeployment,
  VariableVisibility,
} from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { useDebouncedValue } from '#/lib/useDebouncedValue'

/** The deployment settings as typed; ports stay text until saved. */
export type DeploymentDraft = {
  projectId: string
  name: string
  composeFile: string
  variables: DeploymentVariable[]
  domains: { serviceName: string; subdomain: string; port: string }[]
  commands: DeploymentCommand[]
}

export const EMPTY_DEPLOYMENT: DeploymentDraft = {
  projectId: '',
  name: '',
  composeFile: '',
  variables: [],
  domains: [],
  commands: [],
}

export function toDeploymentDraft(
  deployment: ProductDeployment | null,
): DeploymentDraft {
  if (!deployment) return EMPTY_DEPLOYMENT
  return {
    projectId: deployment.projectId,
    name: deployment.name,
    composeFile: deployment.composeFile,
    variables: deployment.variables,
    domains: deployment.domains.map((domain) => ({
      ...domain,
      port: String(domain.port),
    })),
    commands: deployment.commands,
  }
}

/** What the API takes, minus the type and project. */
export function toDeploymentBody(draft: DeploymentDraft) {
  return {
    name: draft.name,
    composeFile: draft.composeFile,
    variables: draft.variables,
    domains: draft.domains.map((domain) => ({ ...domain, port: domain.port })),
    commands: draft.commands,
  }
}

/** Asks the server to check the settings. Null when it could not be reached. */
export async function checkDeployment(
  draft: DeploymentDraft,
): Promise<DeploymentCheck | null> {
  try {
    const response = await apiFetch<DeploymentCheck>(
      '/admin/products/deployment/check',
      { method: 'POST', body: JSON.stringify(toDeploymentBody(draft)) },
    )
    return response.success ? response.data : null
  } catch {
    return null
  }
}

const COMPOSE_PLACEHOLDER = `services:
  n8n:
    image: n8nio/n8n:1.70.0
    restart: unless-stopped
    environment:
      - N8N_HOST=\${N8N_HOST}
      - GENERIC_TIMEZONE=\${TIMEZONE}
    volumes:
      - /mnt/nas-sda/n8n/\${USERNAME}:/home/node/.n8n`

const VISIBILITIES: VariableVisibility[] = [
  'editable',
  'readOnly',
  'hidden',
  'setOnce',
  'setOnceHidden',
]

const subheadingClassName = 'text-sm font-medium'
const monoInputClassName = 'bg-white font-mono text-[13px] md:text-[13px]'

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.92em]">{children}</code>
}

/** Renders `code` spans in a server message. */
function IssueMessage({ text }: { text: string }) {
  return (
    <>
      {text
        .split('`')
        .map((part, index) =>
          index % 2 === 1 ? <Code key={index}>{part}</Code> : part,
        )}
    </>
  )
}

/** The input an issue's field points at. */
function fieldElementId(field: string | undefined): string | null {
  if (field === 'name') return 'deployment-name'
  const [list, index] = field?.split('.') ?? []
  if (list === 'variables') return `variable-${index}-key`
  if (list === 'domains') return `domain-${index}-subdomain`
  return null
}

function focusField(field: string | undefined) {
  const id = fieldElementId(field)
  const element = id ? document.getElementById(id) : null
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element?.focus({ preventScroll: true })
}

function IssueRow({ issue }: { issue: ComposeIssue }) {
  const isError = issue.severity === 'error'
  const Icon = isError ? CircleX : TriangleAlert
  const target = fieldElementId(issue.field)
  return (
    <li className="flex gap-2 px-3 py-2 text-sm">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${isError ? 'text-[var(--destructive)]' : 'text-amber-600'}`}
        aria-label={isError ? 'Error' : 'Warning'}
      />
      <span className="min-w-0">
        {issue.file === 'compose' ? (
          <span className="font-medium">
            Compose file{issue.line ? `, line ${issue.line}` : ''}:{' '}
          </span>
        ) : null}
        <IssueMessage text={issue.message} />
        {target ? (
          <button
            type="button"
            className="ml-2 text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
            onClick={() => focusField(issue.field)}
          >
            Show
          </button>
        ) : null}
      </span>
    </li>
  )
}

function Preview({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return (
    <p className={`truncate text-xs ${hintClassName}`}>
      Becomes <Code>{value}</Code>
    </p>
  )
}

/**
 * Everything a subscription needs to deploy into Dokploy: the project, a
 * per-customer name, the compose file, its environment and its domains.
 * Checked on the server as the admin types.
 */
export default function DeploymentFields({
  value,
  onChange,
}: {
  value: DeploymentDraft
  onChange: (value: DeploymentDraft) => void
}) {
  const [check, setCheck] = useState<DeploymentCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [formatting, setFormatting] = useState(false)
  // Kept while the file is briefly unparsable, so the pickers do not empty.
  const [services, setServices] = useState<string[]>([])
  const debounced = useDebouncedValue(value, 500)
  const latest = useRef(0)
  // Tab indents; Esc, then Tab, moves on to the next field.
  const leaving = useRef(false)

  useEffect(() => {
    if (!debounced.composeFile.trim()) {
      setCheck(null)
      return
    }
    const run = ++latest.current
    setChecking(true)
    void checkDeployment(debounced).then((result) => {
      if (run !== latest.current) return
      setCheck(result)
      if (result && result.services.length > 0) setServices(result.services)
      setChecking(false)
    })
  }, [debounced])

  const set = (patch: Partial<DeploymentDraft>) =>
    onChange({ ...value, ...patch })

  function setVariable(index: number, patch: Partial<DeploymentVariable>) {
    set({
      variables: value.variables.map((variable, at) =>
        at === index ? { ...variable, ...patch } : variable,
      ),
    })
  }

  /** Moves a variable by one place; customers see them in this order. */
  function moveVariable(index: number, by: -1 | 1) {
    const to = index + by
    if (to < 0 || to >= value.variables.length) return
    const variables = [...value.variables]
    ;[variables[index], variables[to]] = [variables[to], variables[index]]
    set({ variables })
  }

  function setDomain(
    index: number,
    patch: Partial<DeploymentDraft['domains'][number]>,
  ) {
    set({
      domains: value.domains.map((domain, at) =>
        at === index ? { ...domain, ...patch } : domain,
      ),
    })
  }

  function setCommand(index: number, patch: Partial<DeploymentCommand>) {
    set({
      commands: value.commands.map((command, at) =>
        at === index ? { ...command, ...patch } : command,
      ),
    })
  }

  async function handleFormat() {
    setFormatting(true)
    const result = await checkDeployment(value)
    setFormatting(false)
    if (!result) {
      toast.error('Unable to reach the server')
      return
    }
    set({ composeFile: result.composeFile })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      leaving.current = true
      return
    }
    if (event.key !== 'Tab' || event.shiftKey || leaving.current) return
    event.preventDefault()
    const area = event.currentTarget
    const start = area.selectionStart
    const text = value.composeFile
    set({
      composeFile: `${text.slice(0, start)}  ${text.slice(area.selectionEnd)}`,
    })
    requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2))
  }

  const issues = check?.issues ?? []
  const errors = issues.filter((issue) => issue.severity === 'error')
  const invalid = (field: string) =>
    errors.some((issue) => issue.field === field)
  const username = check?.preview.username ?? 'janedoe42'
  const baseDomain = check?.preview.domain ?? 'example.com'

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="deployment-project">Dokploy project</Label>
          <DokployProjectCombobox
            id="deployment-project"
            value={value.projectId}
            onChange={(projectId) => set({ projectId })}
          />
          <p className={`text-xs ${hintClassName}`}>
            Every deployment of this product goes here.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deployment-name">Name in Dokploy</Label>
          <Input
            id="deployment-name"
            aria-invalid={invalid('name')}
            value={value.name}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="n8n-${USERNAME}"
            className={monoInputClassName}
            onChange={(event) => set({ name: event.target.value })}
          />
          {check?.preview.name ? (
            <Preview value={check.preview.name} />
          ) : (
            <p className={`text-xs ${hintClassName}`}>
              Must differ per customer, so include <Code>{'${USERNAME}'}</Code>.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="compose-file">Compose file</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={formatting || !value.composeFile.trim()}
            onClick={() => void handleFormat()}
          >
            <AlignLeft aria-hidden />
            {formatting ? 'Tidying…' : 'Tidy spacing'}
          </Button>
        </div>
        <Textarea
          id="compose-file"
          value={value.composeFile}
          rows={16}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={errors.some((issue) => issue.file === 'compose')}
          placeholder={COMPOSE_PLACEHOLDER}
          className="field-sizing-fixed resize-y overflow-x-auto bg-white font-mono text-[13px] leading-relaxed md:text-[13px]"
          onChange={(event) => set({ composeFile: event.target.value })}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            leaving.current = false
          }}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className={subheadingClassName}>Environment</legend>
        <p className={`text-xs ${hintClassName}`}>
          Fills the compose file&apos;s variables. Customers see them in this
          order. The first four are set automatically. Use any variable as{' '}
          <Code>{'${KEY}'}</Code>, in a value, the name or a subdomain, e.g.{' '}
          <Code>{'n8n-${USERNAME}'}</Code>.
        </p>

        <div className="space-y-2">
          <div
            className={`hidden gap-2 text-xs sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_11rem_6rem] ${hintClassName}`}
            aria-hidden
          >
            <span>Key</span>
            <span>Value</span>
            <span>Customer</span>
          </div>
          {[
            ['USERNAME', `From the email, e.g. ${username}`],
            ['EMAIL', "The customer's email"],
            ['USER_ID', "The customer's account ID"],
            ['DOMAIN', `The deploy domain, ${baseDomain}`],
          ].map(([key, description]) => (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-x-2 gap-y-0.5 rounded-md bg-[var(--surface)] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_11rem_6rem]"
            >
              <code className="truncate font-mono text-[13px]">{key}</code>
              <span className="truncate text-sm text-[var(--muted)]">
                {description}
              </span>
              <span className="col-span-2 text-xs text-[var(--muted)] sm:col-span-1 sm:text-sm">
                Set automatically
              </span>
            </div>
          ))}
          {value.variables.map((variable, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 border-b border-[var(--line)] pb-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_11rem_6rem] sm:border-0 sm:pb-0"
            >
              <Input
                id={`variable-${index}-key`}
                aria-label={`Variable ${index + 1} name`}
                aria-invalid={invalid(`variables.${index}`)}
                value={variable.key}
                placeholder="KEY"
                spellCheck={false}
                autoCapitalize="off"
                className={monoInputClassName}
                onChange={(event) =>
                  setVariable(index, { key: event.target.value })
                }
              />
              <div className="flex items-center justify-end sm:order-last">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  aria-label={`Move variable ${variable.key || index + 1} up`}
                  onClick={() => moveVariable(index, -1)}
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === value.variables.length - 1}
                  aria-label={`Move variable ${variable.key || index + 1} down`}
                  onClick={() => moveVariable(index, 1)}
                >
                  <ChevronDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove variable ${variable.key || index + 1}`}
                  onClick={() =>
                    set({
                      variables: value.variables.filter(
                        (_, at) => at !== index,
                      ),
                    })
                  }
                >
                  <X aria-hidden />
                </Button>
              </div>
              <Input
                aria-label={`Variable ${index + 1} value`}
                aria-invalid={invalid(`variables.${index}`)}
                value={variable.value}
                placeholder={
                  variable.visibility === 'editable'
                    ? 'Default value'
                    : variable.visibility === 'setOnce' ||
                        variable.visibility === 'setOnceHidden'
                      ? 'Example shown to the customer'
                      : 'e.g. ${USERNAME}'
                }
                spellCheck={false}
                autoCapitalize="off"
                className={`col-span-2 sm:col-span-1 ${monoInputClassName}`}
                onChange={(event) =>
                  setVariable(index, { value: event.target.value })
                }
              />
              <div className="col-span-2 sm:col-span-1">
                <Select
                  value={variable.visibility}
                  onValueChange={(visibility) =>
                    setVariable(index, {
                      visibility: visibility as VariableVisibility,
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={`Variable ${index + 1}: what the customer can do`}
                    className="w-full bg-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITIES.map((visibility) => (
                      <SelectItem key={visibility} value={visibility}>
                        {VARIABLE_VISIBILITY_LABELS[visibility]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              variables: [
                ...value.variables,
                { key: '', value: '', visibility: 'hidden' },
              ],
            })
          }
        >
          <Plus aria-hidden />
          Add variable
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={subheadingClassName}>Domains</legend>
        <p className={`text-xs ${hintClassName}`}>
          Use a unique subdomain per customer, e.g.{' '}
          <Code>{'n8n-${USERNAME}'}</Code>.
        </p>

        {value.domains.length > 0 ? (
          <div className="space-y-3">
            <div
              className={`hidden gap-2 text-xs sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_6.5rem_2.25rem] ${hintClassName}`}
              aria-hidden
            >
              <span>Service</span>
              <span>Subdomain</span>
              <span>Container port</span>
            </div>
            {value.domains.map((domain, index) => {
              const options = services.includes(domain.serviceName)
                ? services
                : [domain.serviceName, ...services].filter(Boolean)
              return (
                <div key={index} className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_2.25rem] gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_6.5rem_2.25rem]">
                    <Select
                      value={domain.serviceName || undefined}
                      disabled={options.length === 0}
                      onValueChange={(serviceName) =>
                        setDomain(index, { serviceName })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Domain ${index + 1} service`}
                        className="col-span-3 w-full bg-white sm:col-span-1"
                      >
                        <SelectValue
                          placeholder={
                            options.length === 0 ? 'No services yet' : 'Service'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex min-w-0 items-center rounded-md border border-input bg-white shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-aria-invalid:border-destructive">
                      <input
                        id={`domain-${index}-subdomain`}
                        aria-label={`Domain ${index + 1} subdomain`}
                        aria-invalid={invalid(`domains.${index}`)}
                        value={domain.subdomain}
                        placeholder="n8n-${USERNAME}"
                        spellCheck={false}
                        autoCapitalize="off"
                        className="h-9 min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none"
                        onChange={(event) =>
                          setDomain(index, { subdomain: event.target.value })
                        }
                      />
                      <span className="truncate pr-3 font-mono text-[13px] text-[var(--muted)]">
                        .{baseDomain}
                      </span>
                    </div>
                    <Input
                      aria-label={`Domain ${index + 1} container port`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={65535}
                      value={domain.port}
                      placeholder="5678"
                      className={monoInputClassName}
                      onChange={(event) =>
                        setDomain(index, { port: event.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove domain ${index + 1}`}
                      onClick={() =>
                        set({
                          domains: value.domains.filter(
                            (_, at) => at !== index,
                          ),
                        })
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  <div className="sm:pl-[calc(10rem+0.5rem)]">
                    <Preview value={check?.preview.hosts[index]} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              domains: [
                ...value.domains,
                {
                  serviceName: services.length === 1 ? services[0] : '',
                  subdomain: '',
                  port: '',
                },
              ],
            })
          }
        >
          <Plus aria-hidden />
          Add domain
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className={subheadingClassName}>Commands</legend>
        <p className={`text-xs ${hintClassName}`}>
          Customers see only the label and a Run button, while the service runs.
          The command runs with <Code>sh -c</Code> in the service&apos;s
          container, e.g. <Code>n8n user-management:reset</Code>. Each customer
          can run commands 5 times an hour and 20 times a day.
        </p>

        {value.commands.length > 0 ? (
          <div className="space-y-3">
            <div
              className={`hidden gap-2 text-xs sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.4fr)_2.25rem] ${hintClassName}`}
              aria-hidden
            >
              <span>Label</span>
              <span>Service</span>
              <span>Command</span>
            </div>
            {value.commands.map((command, index) => {
              const options = services.includes(command.serviceName)
                ? services
                : [command.serviceName, ...services].filter(Boolean)
              return (
                <div
                  key={command.id || `new-${index}`}
                  className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2 border-b border-[var(--line)] pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.4fr)_2.25rem] sm:border-0 sm:pb-0"
                >
                  <Input
                    aria-label={`Command ${index + 1} label`}
                    value={command.label}
                    maxLength={60}
                    placeholder="Reset owner password"
                    className="bg-white"
                    onChange={(event) =>
                      setCommand(index, { label: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="sm:order-last"
                    aria-label={`Remove command ${command.label || index + 1}`}
                    onClick={() =>
                      set({
                        commands: value.commands.filter(
                          (_, at) => at !== index,
                        ),
                      })
                    }
                  >
                    <X aria-hidden />
                  </Button>
                  <div className="col-span-2 sm:col-span-1">
                    <Select
                      value={command.serviceName || undefined}
                      disabled={options.length === 0}
                      onValueChange={(serviceName) =>
                        setCommand(index, { serviceName })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Command ${index + 1} service`}
                        className="w-full bg-white"
                      >
                        <SelectValue
                          placeholder={
                            options.length === 0 ? 'No services yet' : 'Service'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    aria-label={`Command ${index + 1} command`}
                    value={command.command}
                    maxLength={2000}
                    placeholder="n8n user-management:reset"
                    spellCheck={false}
                    autoCapitalize="off"
                    className={`col-span-2 sm:col-span-1 ${monoInputClassName}`}
                    onChange={(event) =>
                      setCommand(index, { command: event.target.value })
                    }
                  />
                </div>
              )
            })}
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              commands: [
                ...value.commands,
                {
                  id: '',
                  label: '',
                  serviceName: services.length === 1 ? services[0] : '',
                  command: '',
                },
              ],
            })
          }
        >
          <Plus aria-hidden />
          Add command
        </Button>
      </fieldset>

      <div aria-live="polite">
        {!value.composeFile.trim() ? null : !check ? (
          <p className={`flex items-center gap-2 ${hintClassName}`}>
            {checking ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Checking…
              </>
            ) : (
              'The deployment could not be checked. It is checked again on save.'
            )}
          </p>
        ) : issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 text-[var(--accent)]" aria-hidden />
            No problems found.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
            <p className="border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium">
              {errors.length > 0
                ? `${errors.length} ${errors.length === 1 ? 'problem' : 'problems'} to fix before saving`
                : `${issues.length} ${issues.length === 1 ? 'warning' : 'warnings'}. You can still save`}
            </p>
            <ul className="divide-y divide-[var(--line)]">
              {issues.map((issue, index) => (
                <IssueRow key={index} issue={issue} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
