import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import ServiceDetail from '#/components/services/ServiceDetail'
import { Button } from '#/components/ui/button'
import { getService } from '#/lib/services'
import { absoluteUrl, jsonLd, seo } from '#/lib/seo'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/services/$slug')({
  beforeLoad: ({ params }) => {
    if (!getService(params.slug)) throw notFound()
  },
  head: ({ params }) => {
    const service = getService(params.slug)
    if (!service)
      return seo({ title: m.service_not_found_seo(), noindex: true })
    const path = `/services/${service.slug}`
    const description = `${service.tagline} ${service.summary}`
    return {
      ...seo({ title: service.name, description, path }),
      scripts: [
        jsonLd({
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.name,
          description,
          url: absoluteUrl(path),
          provider: { '@type': 'Organization', name: 'Our Solution' },
        }),
      ],
    }
  },
  component: ServicePage,
  notFoundComponent: ServiceNotFound,
})

function ServicePage() {
  const { slug } = Route.useParams()
  const service = getService(slug)
  return service ? <ServiceDetail service={service} /> : <ServiceNotFound />
}

function ServiceNotFound() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-24 text-center text-[var(--ink)]">
      <h1 className="font-display mb-3 text-3xl">
        {m.service_not_found_title()}
      </h1>
      <p className="mb-8 text-[var(--muted)]">{m.service_not_found_body()}</p>
      <Button asChild size="lg" className="rounded-full px-6">
        <Link to="/services" className="no-underline">
          {m.service_not_found_cta()}
        </Link>
      </Button>
    </main>
  )
}
