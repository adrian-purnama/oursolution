import ServiceIcon from '#/components/services/ServiceIcon'
import type { Service } from '#/lib/services'
import { cn } from '#/lib/utils'

/**
 * A service's full logo (mark and wordmark), set by height. Services without
 * a full logo file get their mark beside their wordmark in text.
 */
export default function ServiceLogo({
  service,
  className,
}: {
  service: Service
  /** Sets the height, e.g. "h-10". */
  className?: string
}) {
  if (service.fullLogo) {
    return (
      <img
        src={service.fullLogo}
        alt={`${service.name} logo`}
        className={cn('w-auto max-w-full object-contain', className)}
      />
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <ServiceIcon service={service} className="h-full w-auto" />
      <span className="font-display text-[1.6em] leading-none text-[var(--navy)]">
        {service.wordmark ?? service.name}
      </span>
    </span>
  )
}
