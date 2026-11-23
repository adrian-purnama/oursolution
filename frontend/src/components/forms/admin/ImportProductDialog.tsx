import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { LoaderCircle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import type { Product } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'

/** The JSON object in `text`, tolerating a pasted ```json fence around it. */
function parseProductJson(
  text: string,
): { body: Record<string, unknown> } | { error: string } {
  const trimmed = text
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/, '')
    .trim()
  if (!trimmed) return { error: 'Paste the product JSON or choose a file' }
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch (error) {
    return {
      error: `Not valid JSON: ${error instanceof Error ? error.message : 'unreadable'}`,
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'Expected one product: a JSON object, not a list' }
  }
  return { body: value as Record<string, unknown> }
}

/**
 * Admin: create a product from the JSON the create-product skill writes,
 * the same body as POST /admin/products. Opens the new product afterwards
 * so images can be added.
 */
export default function ImportProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const parsed = text.trim() ? parseProductJson(text) : null
  const preview = parsed && 'body' in parsed ? parsed.body : null

  function handleOpenChange(next: boolean) {
    if (saving) return
    if (!next) {
      setText('')
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setText(await file.text())
      setError(null)
    } catch {
      setError('Could not read that file')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = parseProductJson(text)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch<Product>('/admin/products', {
        method: 'POST',
        body: JSON.stringify(result.body),
      })
      if (!response.success || !response.data) {
        setError(response.message || 'Failed to create the product')
        return
      }
      toast.success(`${response.data.name} created`)
      setText('')
      onOpenChange(false)
      await navigate({
        to: '/admin/products/$productId',
        params: { productId: response.data.id },
      })
    } catch {
      setError('Unable to reach the server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="min-w-0"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <DialogHeader>
            <DialogTitle>Upload product JSON</DialogTitle>
            <DialogDescription>
              Paste or choose the product JSON from the create-product skill.
              Add images after it is created.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-product-file">File</Label>
              <input
                id="import-product-file"
                type="file"
                accept=".json,application/json"
                onChange={(event) => void handleFile(event)}
                className={`block w-full text-sm file:mr-3 file:rounded-md file:border file:border-[var(--line)] file:bg-transparent file:px-3 file:py-1.5 file:text-sm ${hintClassName}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-product-json">JSON</Label>
              <Textarea
                id="import-product-json"
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setError(null)
                }}
                placeholder='{ "name": "n8n Starter", "kind": "subscription", … }'
                spellCheck={false}
                className="field-sizing-fixed h-64 min-w-0 resize-none font-mono text-xs break-all"
              />
            </div>

            {preview ? (
              <p className={hintClassName}>
                {String(preview.name ?? 'Unnamed')} ·{' '}
                {String(preview.kind ?? 'subscription')}
                {preview.showOnPricingPage === true
                  ? ' · listed on the pricing page'
                  : ' · hidden from the pricing page'}
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !text.trim()}>
              {saving ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              Create product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
