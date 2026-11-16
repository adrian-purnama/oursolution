import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { apiFetch, apiUpload, toAbsoluteMediaUrl } from '#/lib/api'
import type { Product, ProductImage } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { cn } from '#/lib/utils'

/** Matches the server's MAX_PRODUCT_IMAGES. */
export const MAX_PRODUCT_IMAGES = 10

/** An image already on the server, or a picked file not yet uploaded. */
export type ImageItem =
  | { key: string; kind: 'saved'; id: string; url: string }
  | { key: string; kind: 'new'; file: File; url: string }

export function toImageItems(images: ProductImage[]): ImageItem[] {
  return images.map((image) => ({
    key: image.id,
    kind: 'saved',
    id: image.id,
    url: toAbsoluteMediaUrl(image.url) ?? image.url,
  }))
}

/**
 * Brings the product's images on the server in line with `items`: removes
 * the dropped ones, uploads the new ones, then saves the order. Returns an
 * error message, or null when everything went through.
 */
export async function saveProductImages(
  product: Product,
  items: ImageItem[],
): Promise<string | null> {
  const kept = new Set(
    items.flatMap((item) => (item.kind === 'saved' ? [item.id] : [])),
  )
  let current = product.images.map((image) => image.id)

  for (const id of current) {
    if (kept.has(id)) continue
    const response = await apiFetch<Product>(
      `/admin/products/${product.id}/images/${id}`,
      { method: 'DELETE' },
    )
    if (!response.success || !response.data) {
      return response.message || 'An image could not be removed'
    }
    current = response.data.images.map((image) => image.id)
  }

  const order: string[] = []
  for (const item of items) {
    if (item.kind === 'saved') {
      order.push(item.id)
      continue
    }
    const formData = new FormData()
    formData.append('file', item.file)
    const response = await apiUpload<Product>(
      `/admin/products/${product.id}/images`,
      formData,
    )
    if (!response.success || !response.data) {
      return response.message || `${item.file.name} could not be uploaded`
    }
    const next = response.data.images.map((image) => image.id)
    const added = next.find((id) => !current.includes(id))
    if (added) order.push(added)
    current = next
  }

  if (order.join() !== current.join()) {
    const response = await apiFetch<Product>(
      `/admin/products/${product.id}/images/order`,
      { method: 'PUT', body: JSON.stringify({ ids: order }) },
    )
    if (!response.success) {
      return response.message || 'The image order could not be saved'
    }
  }
  return null
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Product images: add several, drag (or use the arrows) to reorder. */
export default function ProductImagesField({
  value,
  onChange,
}: {
  value: ImageItem[]
  onChange: (items: ImageItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  // Blob URLs of picked files are released when they leave the list.
  const blobs = useRef(new Set<string>())
  useEffect(() => {
    const live = new Set(
      value.flatMap((item) => (item.kind === 'new' ? [item.url] : [])),
    )
    for (const url of blobs.current) {
      if (!live.has(url)) {
        URL.revokeObjectURL(url)
        blobs.current.delete(url)
      }
    }
  }, [value])
  useEffect(
    () => () => {
      for (const url of blobs.current) URL.revokeObjectURL(url)
    },
    [],
  )

  const room = MAX_PRODUCT_IMAGES - value.length

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, room)
    event.target.value = ''
    if (files.length === 0) return
    const added: ImageItem[] = files.map((file) => {
      const url = URL.createObjectURL(file)
      blobs.current.add(url)
      return { key: url, kind: 'new', file, url }
    })
    onChange([...value, ...added])
  }

  function handleDrop(event: DragEvent, index: number) {
    event.preventDefault()
    if (dragging !== null && dragging !== index) {
      onChange(move(value, dragging, index))
    }
    setDragging(null)
    setOver(null)
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Images</legend>
      <p className={`text-xs ${hintClassName}`}>
        Public. Drag to reorder: the first is the cover on the pricing page. Up
        to {MAX_PRODUCT_IMAGES}.
      </p>

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((item, index) => (
          <li
            key={item.key}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              setDragging(index)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setOver(index)
            }}
            onDragLeave={() => setOver((at) => (at === index ? null : at))}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            className={cn(
              'group relative aspect-square cursor-grab overflow-hidden rounded-md border bg-[var(--surface)] active:cursor-grabbing',
              over === index && dragging !== index
                ? 'border-[var(--ink)] ring-2 ring-[var(--ink)]/20'
                : 'border-[var(--line)]',
              dragging === index && 'opacity-40',
            )}
          >
            <img
              src={item.url}
              alt={`Image ${index + 1}`}
              draggable={false}
              className="size-full object-cover"
            />
            {index === 0 ? (
              <span className="absolute top-1 left-1 rounded bg-[var(--ink)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                Cover
              </span>
            ) : null}
            {item.kind === 'new' ? (
              <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink)]">
                New
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`Remove image ${index + 1}`}
              onClick={() => onChange(value.filter((_, at) => at !== index))}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-sm hover:bg-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
            <div className="absolute right-1 bottom-1 flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                aria-label={`Move image ${index + 1} earlier`}
                disabled={index === 0}
                onClick={() => onChange(move(value, index, index - 1))}
                className="flex size-6 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-sm hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Move image ${index + 1} later`}
                disabled={index === value.length - 1}
                onClick={() => onChange(move(value, index, index + 1))}
                className="flex size-6 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow-sm hover:bg-white disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {room > 0 ? (
          <li className="aspect-square">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="size-full flex-col gap-1 border-dashed text-xs font-normal text-[var(--muted)]"
            >
              <ImagePlus className="size-5" aria-hidden />
              Add images
            </Button>
          </li>
        ) : null}
      </ol>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handlePick}
      />
    </fieldset>
  )
}
