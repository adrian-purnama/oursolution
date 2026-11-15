import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Clock,
  LifeBuoy,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useAuth } from '#/context/authContext'
import { apiFetch } from '#/lib/api'
import { EMPTY_CONTACT } from '#/lib/contact'
import type { ContactDetails } from '#/lib/contact'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

type Row = {
  icon: LucideIcon
  label: string
  value: string
  href?: string
  external?: boolean
}

function rowsOf(contact: ContactDetails): Row[] {
  const rows: Row[] = []
  if (contact.email) {
    rows.push({
      icon: Mail,
      label: 'Email',
      value: contact.email,
      href: `mailto:${contact.email}`,
    })
  }
  if (contact.phone) {
    rows.push({
      icon: Phone,
      label: 'Phone',
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^\d+]/g, '')}`,
    })
  }
  if (contact.whatsapp) {
    rows.push({
      icon: MessageCircle,
      label: 'WhatsApp',
      value: `+${contact.whatsapp}`,
      href: `https://wa.me/${contact.whatsapp}`,
      external: true,
    })
  }
  if (contact.address) {
    rows.push({
      icon: MapPin,
      label: 'Address',
      value: contact.address,
      href: contact.mapUrl || undefined,
      external: true,
    })
  }
  if (contact.hours) {
    rows.push({ icon: Clock, label: 'Opening hours', value: contact.hours })
  }
  return rows
}

/** The company's contact details, and the way to support for customers. */
export default function ContactDetailsView() {
  const { isAuthenticated } = useAuth()
  const [contact, setContact] = useState<ContactDetails | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const run = { cancelled: false }
    void (async () => {
      try {
        const response = await apiFetch<ContactDetails>('/app-config/contact')
        if (run.cancelled) return
        if (response.success && response.data) {
          setContact({ ...EMPTY_CONTACT, ...response.data })
        } else {
          setFailed(true)
        }
      } catch {
        if (!run.cancelled) setFailed(true)
      }
    })()
    return () => {
      run.cancelled = true
    }
  }, [])

  const rows = contact ? rowsOf(contact) : []

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className={`${cardClassName} p-6`} aria-label="Contact details">
        {!contact && !failed ? (
          <div className={`flex items-center gap-2 ${hintClassName}`}>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className={hintClassName}>
            Contact details are not available right now.
          </p>
        ) : (
          <dl className="space-y-5">
            {rows.map(({ icon: Icon, label, value, href, external }) => (
              <div key={label} className="flex gap-4">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-[var(--muted)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <dt className={`text-xs ${hintClassName}`}>{label}</dt>
                  <dd className="text-[var(--ink)] break-words whitespace-pre-line">
                    {href ? (
                      <a
                        href={href}
                        {...(external
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        className="text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--ink)]"
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section
        className={`${cardClassName} flex flex-col items-start gap-3 p-6`}
        aria-label="Support"
      >
        <LifeBuoy className="size-6 text-[var(--muted)]" aria-hidden />
        <h2 className="text-lg font-medium">Need help with your service?</h2>
        <p className={hintClassName}>
          Customers can open a support ticket. We reply in the ticket, and you
          can follow it from your account.
        </p>
        <Button asChild className="mt-2">
          <Link to="/support" className="no-underline">
            {isAuthenticated ? 'Open a support ticket' : 'Log in for support'}
          </Link>
        </Button>
      </section>
    </div>
  )
}
