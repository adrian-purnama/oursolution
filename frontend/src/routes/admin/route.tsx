import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import {
  LifeBuoy,
  Mail,
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
  { to: '/admin/emails' as const, label: 'Emails', icon: Mail },
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
  if (pathname.startsWith('/admin/emails')) return ['Admin', 'Emails']
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-0 px-0 text-[var(--ink)] md:flex-row md:gap-6 md:px-6">
      {/* Phones: a scrolling strip under the header. Wider: a sidebar. */}
      <aside className="sticky top-[57px] z-10 shrink-0 border-b border-[var(--line)] bg-white md:h-[calc(100dvh-57px)] md:w-52 md:border-r md:border-b-0 md:py-4">
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:flex-col md:overflow-visible md:px-2 md:py-0"
          aria-label="Admin sections"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.to || pathname.startsWith(`${item.to}/`)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm whitespace-nowrap no-underline transition md:gap-3 md:px-2 md:py-2',
                  active
                    ? 'bg-[var(--surface)] font-semibold text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
                )}
              >
                <Icon className="size-4 shrink-0 md:size-5" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-8">
        <nav
          className="mb-4 hidden text-sm text-[var(--muted)] md:block"
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
