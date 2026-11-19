import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import {
  LifeBuoy,
  Package,
  ReceiptText,
  Server,
  Settings,
  Ticket,
  Users,
} from 'lucide-react'
import { bootstrapAuth, isAdminUser } from '#/context/authContext'
import { cn } from '#/lib/utils'
import { privatePage } from '#/lib/seo'

// This guard covers every page under /admin.
export const Route = createFileRoute('/admin')({
  head: () => privatePage('Admin'),
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await bootstrapAuth()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!isAdminUser(user)) {
      throw redirect({ to: '/dashboard' })
    }
    return { user }
  },
  component: AdminLayout,
})

const NAV_ITEMS = [
  { to: '/admin/app-config' as const, label: 'Config', icon: Settings },
  { to: '/admin/users' as const, label: 'Users', icon: Users },
  { to: '/admin/products' as const, label: 'Products', icon: Package },
  { to: '/admin/payments' as const, label: 'Payments', icon: ReceiptText },
  { to: '/admin/redeem-codes' as const, label: 'Redeem codes', icon: Ticket },
  { to: '/admin/deployments' as const, label: 'Deployments', icon: Server },
  { to: '/admin/tickets' as const, label: 'Tickets', icon: LifeBuoy },
]

function breadcrumbFor(pathname: string): string[] {
  if (pathname.startsWith('/admin/app-config')) return ['Admin', 'Config']
  if (pathname.startsWith('/admin/products/new')) {
    return ['Admin', 'Products', 'New']
  }
  if (pathname.startsWith('/admin/products/')) {
    return ['Admin', 'Products', 'Edit']
  }
  if (pathname.startsWith('/admin/products')) return ['Admin', 'Products']
  if (pathname.startsWith('/admin/payments')) return ['Admin', 'Payments']
  if (pathname.startsWith('/admin/redeem-codes')) {
    return ['Admin', 'Redeem codes']
  }
  if (pathname.startsWith('/admin/deployments')) {
    return ['Admin', 'Deployments']
  }
  if (pathname.startsWith('/admin/tickets/')) {
    return ['Admin', 'Tickets', 'Ticket']
  }
  if (pathname.startsWith('/admin/tickets')) return ['Admin', 'Tickets']
  if (pathname.startsWith('/admin/users/')) return ['Admin', 'Users', 'Edit']
  if (pathname.startsWith('/admin/users')) return ['Admin', 'Users']
  return ['Admin']
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const crumbs = breadcrumbFor(pathname)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0 px-0 text-[var(--ink)] md:gap-6 md:px-6">
      <aside className="sticky top-[57px] flex h-[calc(100dvh-57px)] w-14 shrink-0 flex-col border-r border-[var(--line)] bg-white py-4 md:w-52">
        <nav className="flex flex-col gap-1 px-2" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2 text-sm no-underline transition',
                  active
                    ? 'bg-[var(--surface)] font-semibold text-[var(--ink)] underline underline-offset-4'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <nav
          className="mb-4 text-sm text-[var(--muted)]"
          aria-label="Breadcrumb"
        >
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>
              {index > 0 ? <span className="mx-1.5">/</span> : null}
              <span
                className={
                  index === crumbs.length - 1
                    ? 'font-medium text-[var(--ink)]'
                    : undefined
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  )
}
