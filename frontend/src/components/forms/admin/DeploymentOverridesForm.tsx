import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Plus, RotateCcw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import type {
  Deployment,
  DeploymentChange,
  DeploymentOverrides,
  DeploymentVariable,
} from '#/lib/deployment'
import { formatDateTime } from '#/lib/product'
import { cardClassName, hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** One variable: what the product gives, and the override (null: none). */
type Row = { key: string; productValue: string | null; override: string | null }

function rowsOf(overrides: DeploymentOverrides): Row[] {
  return overrides.env.map(({ key, productValue, override }) => ({
    key,
    productValue,
    override,
  }))
}

/** What is sent: only the overridden variables. */
function payloadOf(rows: Row[]): { key: string; value: string }[] {
  return rows.flatMap((row) =>
    row.override === null ? [] : [{ key: row.key, value: row.override }],
  )
}

function changeLine(change: DeploymentChange): string {
  const what = change.target === 'env' ? change.key : 'compose file'
  if (change.after === null) return `Reset ${what} to the product's`
  if (change.target === 'compose') {
    return change.before === null
      ? 'Replaced the compose file'
      : 'Edited the compose file'
  }
  return change.before === null
    ? `Set ${what} = ${change.after}`
    : `Changed ${what}: ${change.before} → ${change.after}`
}

/**
 * Admin: the environment and compose file this one deployment runs with.
 * Changing a value overrides the product's for this customer only, from
 * the next deploy or redeploy on; every change is logged and can
 * be reset.
 */
export default function DeploymentOverridesForm({
  url,
  overrides,
  variables,
  onSaved,
}: {
  /** The deployment's admin URL, e.g. "/admin/users/:id/deployments/:productId". */
  url: string
  overrides: DeploymentOverrides
  /** The deployment's variables, with the values they run as. */
  variables: DeploymentVariable[]
  onSaved: (deployment: Deployment) => void
}) {
  const byKey = new Map(variables.map((variable) => [variable.key, variable]))
  /** Filled in by the customer: edited under Customer values instead. */
  const customerKeys = new Set(
    variables.filter((variable) => variable.editable).map(({ key }) => key),
  )
  const [rows, setRows] = useState<Row[]>(() => rowsOf(overrides))
  const [compose, setCompose] = useState<string | null>(overrides.composeFile)
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)

  // A fresh answer from the server replaces the form only when what is
  // saved changed, so polling while a run goes does not wipe typing.
  const saved = JSON.stringify([overrides.env, overrides.composeFile])
  const [baseline, setBaseline] = useState(saved)
  useEffect(() => {
    if (saved === baseline) return
    setBaseline(saved)
    setRows(rowsOf(overrides))
    setCompose(overrides.composeFile)
  }, [saved])

  const dirty =
    JSON.stringify([payloadOf(rows), compose]) !==
    JSON.stringify([payloadOf(rowsOf(overrides)), overrides.composeFile])
  const overriddenCount = payloadOf(rowsOf(overrides)).length
  // Customer values are left out unless they were overridden here already.
  const listed = rows.flatMap((row, index) =>
    customerKeys.has(row.key) && row.override === null ? [] : [{ row, index }],
  )

  function setValue(index: number, value: string) {
    setRows(
      rows.map((row, at) =>
        at !== index
          ? row
          : {
              ...row,
              // Typing the product's value back is the same as no override.
              override:
                row.productValue !== null && value === row.productValue
                  ? null
                  : value,
            },
      ),
    )
  }

  function reset(index: number) {
    const row = rows[index]
    setRows(
      row.productValue === null
        ? rows.filter((_item, at) => at !== index)
        : rows.map((item, at) =>
            at === index ? { ...item, override: null } : item,
          ),
    )
  }

  function addRow() {
    const key = newKey.trim()
    if (!key) return
    if (customerKeys.has(key) && !listed.some(({ row }) => row.key === key)) {
      toast.error(`${key} is a customer value: change it under Customer values`)
      return
    }
    if (rows.some((row) => row.key === key)) {
      toast.error(`${key} is already in the list`)
      return
    }
    setRows([...rows, { key, productValue: null, override: '' }])
    setNewKey('')
  }

  async function save(nextRows: Row[], nextCompose: string | null) {
    setSaving(true)
    try {
      const response = await apiFetch<Deployment>(`${url}/overrides`, {
        method: 'PUT',
        body: JSON.stringify({
          env: payloadOf(nextRows),
          composeFile: nextCompose,
        }),
      })
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to save the overrides')
        return
      }
      toast.success('Saved. Applies on the next deploy or redeploy')
      onSaved(response.data)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3">
      <Button
        type="button"
        size="sm"
        disabled={!dirty || saving}
        onClick={() => void save(rows, compose)}
      >
        {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        Save overrides
      </Button>
      {dirty ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setRows(rowsOf(overrides))
              setCompose(overrides.composeFile)
            }}
          >
            Discard changes
          </Button>
          <span className={`text-xs ${hintClassName}`}>Not saved yet</span>
        </>
      ) : overriddenCount > 0 || overrides.composeFile !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() =>
            void save(
              rows.map((row) => ({ ...row, override: null })),
              null,
            )
          }
        >
          <RotateCcw aria-hidden />
          Reset all to the product's
        </Button>
      ) : null}
    </div>
  )

  return (
    <>
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Environment</h3>
          <p className={`text-xs ${hintClassName}`}>
            The product's values, which you can override for this customer
            only. Applies on the next deploy or redeploy.{' '}
            <code>{'${USERNAME}'}</code> and the other built-ins work; write{' '}
            <code>$$</code> for a dollar sign.
          </p>
        </div>

        <div className={`${cardClassName} overflow-hidden`}>
          <div className="space-y-3 p-5">
            {listed.length === 0 ? (
              <p className={`text-sm ${hintClassName}`}>
                The product has no other variables.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {listed.map(({ row, index }) => {
                  const changed = row.override !== null
                  const variable = byKey.get(row.key)
                  const typed = row.override ?? row.productValue ?? ''
                  const runsAs =
                    !changed && variable && variable.value !== typed
                      ? variable.value
                      : null
                  return (
                    <li
                      key={row.key}
                      className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)_5.5rem] sm:items-start"
                    >
                      <div className="min-w-0 pt-2">
                        <p className="font-mono text-[13px] break-all">
                          {row.key}
                        </p>
                        {variable?.visibility === 'hidden' ? (
                          <p className={`text-xs ${hintClassName}`}>
                            Hidden from the customer
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <Input
                          value={typed}
                          aria-label={row.key}
                          spellCheck={false}
                          autoComplete="off"
                          className={cn(
                            'bg-white font-mono text-[13px] md:text-[13px]',
                            changed && 'border-amber-500',
                          )}
                          onChange={(event) =>
                            setValue(index, event.target.value)
                          }
                        />
                        {changed ? (
                          <p className="text-xs break-all text-amber-800">
                            Overridden. Product's:{' '}
                            <span className="font-mono">
                              {row.productValue ?? 'not a product variable'}
                            </span>
                          </p>
                        ) : runsAs !== null ? (
                          <p className={`text-xs break-all ${hintClassName}`}>
                            Runs as{' '}
                            <span className="font-mono">
                              {runsAs || 'empty'}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      {changed ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => reset(index)}
                        >
                          <RotateCcw aria-hidden />
                          Reset
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Input
                value={newKey}
                placeholder="NEW_VARIABLE"
                aria-label="Name of another variable"
                className="max-w-56 bg-white font-mono text-[13px] md:text-[13px]"
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addRow()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!newKey.trim() || saving}
                onClick={addRow}
              >
                <Plus aria-hidden />
                Add variable
              </Button>
            </div>
          </div>
          {actions}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Compose file</h3>
            <p className={`text-xs ${hintClassName}`}>
              {compose === null
                ? "Uses the product's, for the variant the subscription is on."
                : 'A copy just for this customer. Applies on the next deploy or redeploy.'}
            </p>
          </div>
          {compose === null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setCompose(overrides.productComposeFile)}
            >
              Edit for this customer
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setCompose(null)}
            >
              <RotateCcw aria-hidden />
              Use the product's
            </Button>
          )}
        </div>
        {compose === null ? (
          <details className={`${cardClassName} px-5 py-3`}>
            <summary className={`cursor-pointer text-sm ${hintClassName}`}>
              Show the product's compose file
            </summary>
            <pre className="mt-3 max-h-[32rem] overflow-auto rounded-md bg-[var(--surface)] p-3 font-mono text-[12px] leading-relaxed">
              {overrides.productComposeFile}
            </pre>
          </details>
        ) : (
          <div className={`${cardClassName} overflow-hidden`}>
            <div className="p-5">
              <Label htmlFor="override-compose" className="sr-only">
                Compose file for this customer
              </Label>
              <Textarea
                id="override-compose"
                value={compose}
                spellCheck={false}
                className="max-h-[32rem] min-h-48 border-amber-500 bg-white font-mono text-[13px]"
                onChange={(event) => setCompose(event.target.value)}
              />
            </div>
            {actions}
          </div>
        )}
      </section>

      {overrides.changes.length > 0 ? (
        <details className={`${cardClassName} px-5 py-3`}>
          <summary className="cursor-pointer text-sm font-medium">
            Override history ({overrides.changes.length})
          </summary>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {overrides.changes.map((change) => (
              <li key={change.id} className="space-y-0.5 py-2 text-sm">
                <p className="break-all">{changeLine(change)}</p>
                <p className={`text-xs ${hintClassName}`}>
                  {formatDateTime(change.at)} by {change.byEmail}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}
