import { Link } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { Service } from '#/lib/services'

/** A service's call-to-action button: a route, a mail link or an outside site. */
export default function ServiceAction({
  action,
  variant = 'default',
}: {
  action: Service['primary']
  variant?: 'default' | 'outline'
}) {
  const className =
    variant === 'outline' ? 'rounded-full bg-white px-6' : 'rounded-full px-6'

  if ('to' in action) {
    return (
      <Button asChild size="lg" variant={variant} className={className}>
        <Link to={action.to} className="no-underline">
          {action.label}
          {variant === 'default' ? <ArrowRight aria-hidden /> : null}
        </Link>
      </Button>
    )
  }

  return (
    <Button asChild size="lg" variant={variant} className={className}>
      <a
        href={action.href}
        className="no-underline"
        {...(action.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {action.label}
        {action.external ? (
          <ArrowUpRight aria-hidden />
        ) : variant === 'default' ? (
          <ArrowRight aria-hidden />
        ) : null}
      </a>
    </Button>
  )
}
