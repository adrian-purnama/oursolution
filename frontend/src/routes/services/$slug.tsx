import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import ServiceDetail from '#/components/services/ServiceDetail'
import { Button } from '#/components/ui/button'
import { getService } from '#/lib/services'

export const Route = createFileRoute('/services/$slug')({
  beforeLoad: ({ params }) => {
    if (!getService(params.slug)) throw notFound()
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
        We could not find that service.
      </h1>
      <p className="mb-8 text-[var(--muted)]">
        It may have been renamed. All our services are listed on one page.
      </p>
      <Button asChild size="lg" className="rounded-full px-6">
        <Link to="/services" className="no-underline">
          See all services
        </Link>
      </Button>
    </main>
  )
}
