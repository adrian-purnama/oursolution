import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import toast from 'react-hot-toast'
import { LoaderCircle, Send } from 'lucide-react'
import UserMultiSelect from '#/components/forms/admin/UserMultiSelect'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { apiFetch } from '#/lib/api'
import {
  AUDIENCE_STATES,
  BODY_MAX,
  BROADCAST_TEMPLATES,
  BUTTON_LABEL_MAX,
  IN_APP_BODY_MAX,
  IN_APP_TITLE_MAX,
  SUBJECT_MAX,
} from '#/lib/broadcast'
import type {
  Broadcast,
  BroadcastAudience,
  BroadcastAudiencePreview,
  BroadcastRecipient,
} from '#/lib/broadcast'
import type { DeploymentState } from '#/lib/deployment'
import type { Product } from '#/lib/product'
import { hintClassName } from '#/lib/ui-classes'
import { useDebouncedValue } from '#/lib/useDebouncedValue'
import { cn } from '#/lib/utils'

type AudienceType = BroadcastAudience['type']
type ProductMatch = 'active' | 'deployment'

type Preview =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: BroadcastAudiencePreview }
  | { status: 'error'; message: string }

function chipClass(active: boolean) {
  return cn(
    'rounded-full border px-3 py-1 text-xs transition',
    active
      ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
      : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]/40',
  )
}

/** Admin: pick who gets an email, write it, and send it. */
export default function BroadcastComposeForm({
  onSent,
}: {
  onSent: (broadcast: Broadcast) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [audienceType, setAudienceType] = useState<AudienceType>('product')
  const [users, setUsers] = useState<BroadcastRecipient[]>([])
  const [productId, setProductId] = useState('')
  const [match, setMatch] = useState<ProductMatch>('active')
  const [states, setStates] = useState<DeploymentState[]>(['running'])

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [buttonLabel, setButtonLabel] = useState('')
  const [inApp, setInApp] = useState(false)

  const [preview, setPreview] = useState<Preview>({ status: 'idle' })
  const [showSample, setShowSample] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<Product[]>('/admin/products')
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          toast.error(res.message || 'Could not load products')
          return
        }
        setProducts(res.data.filter((product) => !product.deletedAt))
      })
      .catch(() => {
        if (!cancelled) toast.error('Unable to reach the server')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const product = products.find((item) => item.id === productId) ?? null
  // One-time products have no deployment to filter on.
  const canMatchDeployment = product?.kind === 'subscription'
  const effectiveMatch: ProductMatch = canMatchDeployment ? match : 'active'

  const audience = useMemo<BroadcastAudience | null>(() => {
    if (audienceType === 'all') return { type: 'all' }
    if (audienceType === 'users') {
      return users.length
        ? { type: 'users', userIds: users.map((user) => user.id) }
        : null
    }
    if (!productId) return null
    if (effectiveMatch === 'active') {
      return { type: 'product', productId, match: 'active' }
    }
    return states.length
      ? { type: 'product', productId, match: 'deployment', states }
      : null
  }, [audienceType, users, productId, effectiveMatch, states])

  const audienceKey = useDebouncedValue(JSON.stringify(audience), 250)

  useEffect(() => {
    const parsed = JSON.parse(audienceKey) as BroadcastAudience | null
    if (!parsed) {
      setPreview({ status: 'idle' })
      return
    }
    let cancelled = false
    setPreview({ status: 'loading' })
    apiFetch<BroadcastAudiencePreview>('/admin/broadcasts/audience', {
      method: 'POST',
      body: JSON.stringify({ audience: parsed }),
    })
      .then((res) => {
        if (cancelled) return
        if (!res.success || !res.data) {
          setPreview({
            status: 'error',
            message: res.message || 'Could not count recipients',
          })
          return
        }
        setPreview({ status: 'ready', data: res.data })
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ status: 'error', message: 'Unable to reach the server' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [audienceKey])

  function toggleState(state: DeploymentState) {
    setStates((current) =>
      current.includes(state)
        ? current.filter((item) => item !== state)
        : [...current, state],
    )
  }

  function applyTemplate(index: number) {
    const template = BROADCAST_TEMPLATES[index]
    if (!template) return
    setSubject(template.subject)
    setBody(template.body)
  }

  const subjectMax = inApp ? IN_APP_TITLE_MAX : SUBJECT_MAX
  const bodyMax = inApp ? IN_APP_BODY_MAX : BODY_MAX
  const linkProblem =
    link && (!link.startsWith('/') || link.startsWith('//'))
      ? 'Use a path on this site, starting with "/", like /dashboard'
      : null
  const count = preview.status === 'ready' ? preview.data.count : 0
  const ready =
    Boolean(audience) &&
    count > 0 &&
    subject.trim().length > 0 &&
    subject.length <= subjectMax &&
    body.trim().length > 0 &&
    body.length <= bodyMax &&
    !linkProblem

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setConfirming(true)
  }

  async function send() {
    if (!audience) return
    setSending(true)
    try {
      const res = await apiFetch<Broadcast>('/admin/broadcasts', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          body,
          link: link.trim() || null,
          buttonLabel: buttonLabel.trim() || null,
          inApp,
          audience,
        }),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || 'Could not send the email')
        return
      }
      toast.success(res.message)
      setConfirming(false)
      setSubject('')
      setBody('')
      setLink('')
      setButtonLabel('')
      onSent(res.data)
    } catch {
      toast.error('Unable to reach the server')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <section className="space-y-4" aria-labelledby="broadcast-recipients">
        <div>
          <h2 id="broadcast-recipients" className="text-base font-medium">
            Recipients
          </h2>
          <p className={`mt-1 ${hintClassName}`}>
            Blocked users never get these emails.
          </p>
        </div>

        <Tabs
          value={audienceType}
          onValueChange={(value) => setAudienceType(value as AudienceType)}
        >
          <TabsList>
            <TabsTrigger value="product">By product</TabsTrigger>
            <TabsTrigger value="users">Specific people</TabsTrigger>
            <TabsTrigger value="all">Everyone</TabsTrigger>
          </TabsList>
        </Tabs>

        {audienceType === 'users' ? (
          <UserMultiSelect value={users} onChange={setUsers} />
        ) : null}

        {audienceType === 'product' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-product">Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger
                  id="broadcast-product"
                  className="w-full bg-white sm:w-80"
                >
                  <SelectValue placeholder="Choose a product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {product ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Who</p>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Who"
                >
                  <button
                    type="button"
                    aria-pressed={effectiveMatch === 'active'}
                    onClick={() => setMatch('active')}
                    className={chipClass(effectiveMatch === 'active')}
                  >
                    Has it active
                  </button>
                  {canMatchDeployment ? (
                    <button
                      type="button"
                      aria-pressed={effectiveMatch === 'deployment'}
                      onClick={() => setMatch('deployment')}
                      className={chipClass(effectiveMatch === 'deployment')}
                    >
                      By instance state
                    </button>
                  ) : null}
                </div>

                {effectiveMatch === 'deployment' ? (
                  <fieldset className="pt-2">
                    <legend className={`mb-2 text-xs ${hintClassName}`}>
                      Instance is…
                    </legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {AUDIENCE_STATES.map(({ state, label }) => (
                        <label
                          key={state}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            className="bg-white"
                            checked={states.includes(state)}
                            onCheckedChange={() => toggleState(state)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <p className={`text-xs ${hintClassName}`}>
                    {product.kind === 'subscription'
                      ? 'Everyone whose subscription is running now.'
                      : 'Everyone who owns it.'}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <AudienceSummary
          preview={preview}
          showSample={showSample}
          onToggleSample={() => setShowSample((value) => !value)}
        />
      </section>

      <section className="space-y-5" aria-labelledby="broadcast-message">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="broadcast-message" className="text-base font-medium">
            Message
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs ${hintClassName}`}>Start from</span>
            {BROADCAST_TEMPLATES.map((template, index) => (
              <button
                key={template.label}
                type="button"
                onClick={() => applyTemplate(index)}
                className={chipClass(false)}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="broadcast-subject">Subject</Label>
          <Input
            id="broadcast-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Planned upgrade of your instance"
            className="bg-white"
          />
          <Counter value={subject.length} max={subjectMax} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="broadcast-body">Message</Label>
          <Textarea
            id="broadcast-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={9}
            placeholder="Write the email. Line breaks are kept."
            className="bg-white"
          />
          <Counter value={body.length} max={bodyMax} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-link">Button link (optional)</Label>
            <Input
              id="broadcast-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="/dashboard"
              aria-invalid={Boolean(linkProblem)}
              className="bg-white"
            />
            <p
              className={cn(
                'text-xs',
                linkProblem ? 'text-red-600' : hintClassName,
              )}
            >
              {linkProblem ?? 'A page on this site the email’s button opens.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-button">Button text</Label>
            <Input
              id="broadcast-button"
              value={buttonLabel}
              onChange={(event) => setButtonLabel(event.target.value)}
              placeholder="Open"
              maxLength={BUTTON_LABEL_MAX}
              disabled={!link}
              className="bg-white"
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            className="mt-0.5 bg-white"
            checked={inApp}
            onCheckedChange={(checked) => setInApp(checked === true)}
          />
          <span>
            Also show it as an in-app notification
            <span className={`block text-xs ${hintClassName}`}>
              In-app notices are shorter: subject up to {IN_APP_TITLE_MAX},
              message up to {IN_APP_BODY_MAX} characters.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] pt-5">
        <Button type="submit" disabled={!ready || sending}>
          <Send aria-hidden />
          {count > 0
            ? `Send to ${count} ${count === 1 ? 'person' : 'people'}`
            : 'Send'}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Send to {count} {count === 1 ? 'person' : 'people'}?
            </DialogTitle>
            <DialogDescription>
              {preview.status === 'ready' ? preview.data.label : ''}. Emails
              can’t be recalled once sent.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
            <p className="font-medium">{subject}</p>
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-[var(--muted)]">
              {body}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={send} disabled={sending}>
              {sending ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              Send now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <p
      className={cn(
        'text-right text-xs tabular-nums',
        value > max ? 'text-red-600' : hintClassName,
      )}
    >
      {value} / {max}
    </p>
  )
}

function AudienceSummary({
  preview,
  showSample,
  onToggleSample,
}: {
  preview: Preview
  showSample: boolean
  onToggleSample: () => void
}) {
  if (preview.status === 'idle') {
    return (
      <p className={`text-sm ${hintClassName}`}>
        Choose who should get this email.
      </p>
    )
  }
  if (preview.status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Counting recipients…
      </p>
    )
  }
  if (preview.status === 'error') {
    return <p className="text-sm text-red-600">{preview.message}</p>
  }
  const { count, label, sample } = preview.data
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold tabular-nums">{count}</span>{' '}
          {count === 1 ? 'recipient' : 'recipients'}
          <span className="text-[var(--muted)]"> · {label}</span>
        </p>
        {count > 0 ? (
          <button
            type="button"
            aria-expanded={showSample}
            onClick={onToggleSample}
            className="text-xs text-[var(--muted)] underline-offset-4 hover:underline"
          >
            {showSample ? 'Hide' : 'Show'} who
          </button>
        ) : null}
      </div>
      {count === 0 ? (
        <p className={`mt-1 text-xs ${hintClassName}`}>
          No one matches. Try other filters.
        </p>
      ) : null}
      {showSample && count > 0 ? (
        <ul className="mt-2 space-y-0.5 font-mono text-xs text-[var(--muted)]">
          {sample.map((user) => (
            <li key={user.id}>{user.email}</li>
          ))}
          {count > sample.length ? (
            <li>…and {count - sample.length} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
