import { Link, createFileRoute } from '@tanstack/react-router'
import PlanBadge from '#/components/PlanBadge'
import { useAuth } from '#/context/authContext'
import { cardClassName, hintClassName } from '#/lib/ui-classes'

export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-3xl px-6 py-10 text-[var(--ink)] sm:mt-12">
      <h1 className="mb-8 text-2xl font-medium">Dashboard</h1>

      {user ? (
        <section
          className={`${cardClassName} flex flex-wrap items-center justify-between gap-3 px-4 py-4`}
        >
          <div>
            <p className={`mb-1.5 text-xs ${hintClassName}`}>Your plan</p>
            <PlanBadge plan={user.plan} />
          </div>
          <Link to="/pricing" className="text-sm text-[var(--ink)] underline">
            See all plans
          </Link>
        </section>
      ) : null}
    </main>
  )
}
