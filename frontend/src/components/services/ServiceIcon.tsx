import type { Service } from '#/lib/services'

/** A service's own logo mark when it has one, otherwise its line icon. */
export default function ServiceIcon({
  service,
  className,
}: {
  service: Service
  className?: string
}) {
  if (service.logo) {
    return (
      <img
        src={service.logo}
        alt=""
        aria-hidden
        className={`object-contain ${className ?? ''}`}
      />
    )
  }

  const Icon = service.icon
  return <Icon className={className} aria-hidden />
}
