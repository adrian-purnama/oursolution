import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronDown,
  FileText,
  House,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  LogOut,
  Menu,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import NotificationMenu from '#/components/forms/notifications/NotificationMenu'
import {
  UnreadDot,
  useUnreadTickets,
} from '#/components/forms/ticket/SupportButton'
import ServiceIcon from '#/components/services/ServiceIcon'
import UserAvatar from '#/components/UserAvatar'
import { useAuth } from '#/context/authContext'
import { useBranding } from '#/context/brandingContext'
import { refreshBasket, useBasketCount } from '#/lib/billing'
import { startNotificationStream } from '#/lib/notification'
import { SERVICES } from '#/lib/services'
import { SHOW_HOME_STATE } from '#/lib/home'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { LanguageButtons, LanguageMenu } from '#/components/LanguageSwitcher'

const DRAWER_TRANSITION_MS = 300

export default function Header() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth()
  const { appName, appLogo } = useBranding()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [menuAnimated, setMenuAnimated] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const basketCount = useBasketCount()
  const unreadTickets = useUnreadTickets(isAuthenticated)

  useEffect(() => {
    setMounted(true)
  }, [])

  // The basket badge follows whoever is signed in.
  useEffect(() => {
    void refreshBasket()
  }, [user?.email])

  // One live notification stream per signed-in user, closed on sign-out.
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return
    return startNotificationStream(user.email)
  }, [isAuthenticated, user?.email])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (menuOpen) {
      setMenuVisible(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setMenuAnimated(true))
      })
      return () => cancelAnimationFrame(frame)
    }

    setMenuAnimated(false)
    const timer = window.setTimeout(
      () => setMenuVisible(false),
      DRAWER_TRANSITION_MS,
    )
    return () => window.clearTimeout(timer)
  }, [menuOpen])

  useEffect(() => {
    if (!menuVisible) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [menuVisible])

  function closeMenu() {
    setMenuOpen(false)
  }

  function openMenu() {
    setMenuOpen(true)
  }

  function handleLogout() {
    logout()
    setMenuOpen(false)
    void navigate({ to: '/login' })
  }

  const navLinkClass =
    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--surface)] hover:text-[var(--ink)]'

  const activeNavClass = cn(
    navLinkClass,
    'bg-[var(--surface)] text-[var(--ink)]',
  )

  const drawerLinkClass =
    'block px-6 py-3 text-base font-medium text-[var(--ink)] no-underline transition hover:bg-[var(--surface)]'
  const drawerSubLinkClass =
    'flex items-center gap-3 py-2.5 pr-6 pl-10 text-sm font-medium text-[var(--muted)] no-underline transition hover:bg-[var(--surface)] hover:text-[var(--ink)]'
  const drawerActiveClass = cn(
    drawerLinkClass,
    'bg-[var(--surface)] font-semibold',
  )

  const ctaOutlineClass =
    'rounded-full px-3.5 py-2 text-sm font-medium text-[var(--ink)] no-underline transition hover:bg-[var(--surface)]'

  const ctaPrimaryClass =
    'inline-flex items-center gap-1.5 rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white no-underline shadow-[0_1px_2px_rgba(0,32,96,0.25)] transition hover:bg-[var(--accent)]'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-[var(--line)]/80 bg-white/80 text-[var(--ink)] backdrop-blur-xl',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="font-display inline-flex items-center gap-2.5 justify-self-start text-[17px] no-underline"
        >
          {appLogo ? (
            <img src={appLogo} alt="" className="size-8 object-contain" />
          ) : null}
          {appName}
        </Link>

        <div className="hidden items-center justify-center gap-1 md:flex">
          <DashboardMenu
            signedIn={isAuthenticated}
            pathname={pathname}
            activeClassName={activeNavClass}
            className={navLinkClass}
            unreadTickets={unreadTickets}
          />
          <ServicesMenu
            className={
              pathname.startsWith('/services') ? activeNavClass : navLinkClass
            }
          />
          <Link
            to="/pricing"
            className={navLinkClass}
            activeProps={{ className: activeNavClass }}
          >
            <ShoppingBag className="size-4" aria-hidden />
            {m.nav_shop()}
          </Link>
        </div>

        <div className="hidden items-center justify-self-end gap-2 md:flex">
          <LanguageMenu />
          {isLoading ? null : isAuthenticated ? (
            <>
              <NotificationMenu />
              <BasketLink count={basketCount} />
              {user ? (
                <AccountMenu
                  email={user.email}
                  isAdmin={isAdmin}
                  onLogout={handleLogout}
                />
              ) : null}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={ctaOutlineClass}
                activeProps={{
                  className: cn(ctaOutlineClass, 'bg-[var(--surface)]'),
                }}
              >
                {m.nav_log_in()}
              </Link>
              <Link
                to="/register"
                className={ctaPrimaryClass}
                activeProps={{
                  className: cn(ctaPrimaryClass, 'opacity-90'),
                }}
              >
                {m.nav_sign_up()}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {isAuthenticated ? (
            <>
              <NotificationMenu />
              <BasketLink count={basketCount} />
            </>
          ) : null}
          <button
            type="button"
            className={cn(
              'inline-flex size-10 items-center justify-center text-[var(--ink)] md:hidden',
            )}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            data-tour="profile-mobile"
            onClick={openMenu}
          >
            <Menu className="size-6" aria-hidden />
            <span className="sr-only">{m.nav_open_menu()}</span>
          </button>
        </div>
      </nav>

      {mounted &&
        menuVisible &&
        createPortal(
          <div
            className={cn(
              'fixed inset-0 z-[100] md:hidden',
              menuAnimated ? 'pointer-events-auto' : 'pointer-events-none',
            )}
          >
            <button
              type="button"
              className={cn(
                'absolute inset-0 border-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out',
                menuAnimated ? 'opacity-100' : 'opacity-0',
              )}
              aria-label={m.nav_close_menu()}
              onClick={closeMenu}
            />

            <aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label={m.nav_menu()}
              aria-hidden={!menuAnimated}
              className={cn(
                'absolute inset-y-0 right-0 z-10 flex w-[min(20rem,88vw)] flex-col rounded-l-[var(--radius-md)] border-l border-[var(--line)] bg-white text-[var(--ink)] shadow-2xl transition-transform duration-300 ease-out',
                menuAnimated ? 'translate-x-0' : 'translate-x-full',
              )}
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3">
                <span className="font-display inline-flex items-center gap-2.5 text-[17px]">
                  {appLogo ? (
                    <img
                      src={appLogo}
                      alt=""
                      className="size-8 object-contain"
                    />
                  ) : null}
                  {appName}
                </span>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center text-[var(--ink)]"
                  onClick={closeMenu}
                >
                  <X className="size-6" aria-hidden />
                  <span className="sr-only">{m.nav_close_menu()}</span>
                </button>
              </div>

              <div className="flex flex-1 flex-col bg-white py-2">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/'}
                  className={drawerLinkClass}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: drawerActiveClass }}
                  onClick={closeMenu}
                >
                  {isAuthenticated ? m.nav_dashboard() : m.nav_home()}
                </Link>
                <>
                  {isAuthenticated ? (
                    <Link
                      to="/"
                      state={SHOW_HOME_STATE}
                      className={drawerSubLinkClass}
                      activeOptions={{ exact: true }}
                      activeProps={{
                        className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                      }}
                      onClick={closeMenu}
                    >
                      <House className="size-5" aria-hidden />
                      {m.nav_home_page()}
                    </Link>
                  ) : null}
                  <Link
                    to="/contact"
                    className={drawerSubLinkClass}
                    activeProps={{
                      className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                    }}
                    onClick={closeMenu}
                  >
                    <Mail className="size-5" aria-hidden />
                    {m.nav_contact()}
                  </Link>
                  {isAuthenticated ? (
                    <Link
                      to="/support"
                      className={drawerSubLinkClass}
                      activeProps={{
                        className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                      }}
                      onClick={closeMenu}
                    >
                      <span className="relative">
                        <LifeBuoy className="size-5" aria-hidden />
                        {unreadTickets > 0 ? (
                          <UnreadDot className="-top-0.5 -right-0.5" />
                        ) : null}
                      </span>
                      {m.nav_tickets()}
                      {unreadTickets > 0 ? (
                        <span className="text-xs font-medium text-red-600">
                          {m.nav_tickets_new_reply()}
                        </span>
                      ) : null}
                    </Link>
                  ) : null}
                  <Link
                    to="/privacy"
                    className={drawerSubLinkClass}
                    activeProps={{
                      className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                    }}
                    onClick={closeMenu}
                  >
                    <ShieldCheck className="size-5" aria-hidden />
                    {m.nav_privacy()}
                  </Link>
                  <Link
                    to="/terms"
                    className={drawerSubLinkClass}
                    activeProps={{
                      className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                    }}
                    onClick={closeMenu}
                  >
                    <FileText className="size-5" aria-hidden />
                    {m.nav_terms()}
                  </Link>
                </>
                <Link
                  to="/services"
                  className={drawerLinkClass}
                  activeOptions={{ exact: true }}
                  activeProps={{ className: drawerActiveClass }}
                  onClick={closeMenu}
                >
                  {m.nav_services()}
                </Link>
                {SERVICES.map((service) => (
                  <Link
                    key={service.slug}
                    to="/services/$slug"
                    params={{ slug: service.slug }}
                    className={drawerSubLinkClass}
                    activeProps={{
                      className: cn(drawerSubLinkClass, 'text-[var(--ink)]'),
                    }}
                    onClick={closeMenu}
                  >
                    <ServiceIcon service={service} className="size-5" />
                    {service.name}
                  </Link>
                ))}
                <Link
                  to="/pricing"
                  className={cn(drawerLinkClass, 'flex items-center gap-2.5')}
                  activeProps={{
                    className: cn(
                      drawerActiveClass,
                      'flex items-center gap-2.5',
                    ),
                  }}
                  onClick={closeMenu}
                >
                  <ShoppingBag className="size-5" aria-hidden />
                  {m.nav_shop()}
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className={drawerLinkClass}
                    activeProps={{ className: drawerActiveClass }}
                    onClick={closeMenu}
                  >
                    {m.nav_admin()}
                  </Link>
                ) : null}
              </div>

              <div className="mt-auto border-t border-[var(--line)] bg-white p-4">
                <LanguageButtons className="mb-4 flex-wrap" />
                {isLoading ? null : isAuthenticated ? (
                  <>
                    {user ? (
                      <Link
                        to="/profile"
                        onClick={closeMenu}
                        data-tour="profile-drawer"
                        className="mb-3 flex items-center gap-3 rounded-[var(--radius-sm)] px-1 py-1 text-sm text-[var(--muted)] no-underline transition hover:bg-[var(--surface)]"
                      >
                        <UserAvatar email={user.email} />
                        <span className="min-w-0 truncate">{user.email}</span>
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <LogOut className="size-4" aria-hidden />
                      {m.nav_log_out()}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/login"
                      className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--ink)] no-underline transition hover:border-[var(--ink)]"
                      onClick={closeMenu}
                    >
                      {m.nav_log_in()}
                    </Link>
                    <Link
                      to="/register"
                      className="block rounded-[var(--radius-sm)] bg-[var(--navy)] px-4 py-3 text-center text-sm font-semibold text-white no-underline transition hover:opacity-90"
                      onClick={closeMenu}
                    >
                      {m.nav_sign_up()}
                    </Link>
                  </div>
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </header>
  )
}

/**
 * The first item of the top bar: the dashboard (signed in only), the
 * public home page, contact, tickets (signed in only) and the legal pages.
 * It is named after the dashboard or home page when the user is on one,
 * and reads "Dashboard" (or "Home" when signed out) anywhere else.
 */
function DashboardMenu({
  signedIn,
  pathname,
  className,
  activeClassName,
  unreadTickets,
}: {
  signedIn: boolean
  pathname: string
  className: string
  activeClassName: string
  unreadTickets: number
}) {
  const items = [
    ...(signedIn
      ? [
          {
            to: '/dashboard' as const,
            label: m.nav_dashboard(),
            hint: m.nav_dashboard_hint(),
            icon: LayoutDashboard,
          },
        ]
      : []),
    {
      to: '/' as const,
      label: signedIn ? m.nav_home_page() : m.nav_home(),
      hint: m.nav_home_hint(),
      icon: House,
    },
  ]
  const allShortcuts = [
    {
      to: '/contact' as const,
      label: m.nav_contact(),
      hint: m.nav_contact_hint(),
      icon: Mail,
      unread: 0,
    },
    {
      to: '/support' as const,
      label: m.nav_tickets(),
      hint:
        unreadTickets > 0
          ? m.nav_tickets_unread({ count: unreadTickets })
          : m.nav_tickets_hint(),
      icon: LifeBuoy,
      unread: unreadTickets,
    },
  ]
  const shortcuts = signedIn
    ? allShortcuts
    : allShortcuts.filter(({ to }) => to !== '/support')
  const legal = [
    { to: '/privacy' as const, label: m.nav_privacy(), icon: ShieldCheck },
    { to: '/terms' as const, label: m.nav_terms(), icon: FileText },
  ]
  const current = items.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          current ? activeClassName : className,
          'group cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
        )}
      >
        {current?.label ?? (signedIn ? m.nav_dashboard() : m.nav_home())}
        <ChevronDown
          className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={10}
        className="w-72 rounded-2xl border-[var(--line)] p-2 shadow-[0_24px_48px_-20px_rgba(12,12,11,0.25)]"
      >
        {items.map(({ to, label, hint, icon: Icon }) => (
          <DropdownMenuItem
            key={to}
            asChild
            className="cursor-pointer rounded-xl p-0"
          >
            <Link
              to={to}
              // A signed-in user asked for the home page on purpose.
              state={to === '/' ? SHOW_HOME_STATE : undefined}
              className="flex items-start gap-3 p-3 no-underline"
            >
              <Icon
                className="mt-0.5 size-5 shrink-0 text-[var(--accent)]"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {label}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {hint}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-2" />
        {shortcuts.map(({ to, label, hint, icon: Icon, unread }) => (
          <DropdownMenuItem
            key={to}
            asChild
            className="cursor-pointer rounded-xl p-0"
          >
            <Link to={to} className="flex items-start gap-3 p-3 no-underline">
              <span className="relative mt-0.5 shrink-0">
                <Icon className="size-5 text-[var(--accent)]" aria-hidden />
                {unread > 0 ? (
                  <UnreadDot className="-top-0.5 -right-0.5" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {label}
                </span>
                <span
                  className={cn(
                    'block text-xs',
                    unread > 0 ? 'text-red-600' : 'text-[var(--muted)]',
                  )}
                >
                  {hint}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-2" />
        {legal.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem
            key={to}
            asChild
            className="cursor-pointer rounded-xl p-0"
          >
            <Link
              to={to}
              className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Services" in the top bar: opens the three services and the overview. */
function ServicesMenu({ className }: { className: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          className,
          'group cursor-pointer border-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
        )}
      >
        {m.nav_services()}
        <ChevronDown
          className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={10}
        className="w-80 rounded-2xl border-[var(--line)] p-2 shadow-[0_24px_48px_-20px_rgba(12,12,11,0.25)]"
      >
        {SERVICES.map((service) => (
          <DropdownMenuItem
            key={service.slug}
            asChild
            className="cursor-pointer rounded-xl p-0"
          >
            <Link
              to="/services/$slug"
              params={{ slug: service.slug }}
              className="flex items-start gap-3 p-3 no-underline"
            >
              <ServiceIcon
                service={service}
                className="size-9 shrink-0 text-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {service.name}
                </span>
                <span className="block text-xs leading-relaxed text-[var(--muted)]">
                  {service.tagline}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-0">
          <Link
            to="/services"
            className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-[var(--ink)] no-underline"
          >
            {m.nav_all_services()}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The signed-in user's avatar: opens profile, admin and log out. */
function AccountMenu({
  email,
  isAdmin,
  onLogout,
}: {
  email: string
  isAdmin: boolean
  onLogout: () => void
}) {
  const itemClass =
    'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--ink)] no-underline'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={m.nav_account_menu({ email })}
        data-tour="profile"
        className="group inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent p-1 outline-none transition hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--navy)]"
      >
        <UserAvatar email={email} />
        <ChevronDown
          className="size-4 text-[var(--muted)] transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-60 rounded-2xl border-[var(--line)] p-2 shadow-[0_24px_48px_-20px_rgba(12,12,11,0.25)]"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <span className="block text-xs font-normal text-[var(--muted)]">
            {m.nav_signed_in_as()}
          </span>
          <span className="block truncate text-sm font-medium text-[var(--ink)]">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem asChild className="p-0">
          <Link to="/profile" className={itemClass}>
            <UserRound className="size-4" aria-hidden />
            {m.nav_profile()}
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild className="p-0">
            <Link to="/admin" className={itemClass}>
              <ShieldCheck className="size-4" aria-hidden />
              {m.nav_admin()}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          onSelect={onLogout}
          className={cn(itemClass, 'text-red-600 focus:text-red-600')}
        >
          <LogOut className="size-4 text-red-600" aria-hidden />
          {m.nav_log_out()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The basket icon with how many products are in it. */
function BasketLink({ count }: { count: number }) {
  return (
    <Link
      to="/checkout"
      aria-label={count > 0 ? m.nav_basket_count({ count }) : m.nav_basket()}
      title={m.nav_basket()}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-[var(--ink)] no-underline transition hover:bg-[var(--surface)]"
    >
      <ShoppingCart className="size-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute top-1 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--ink)] px-1 text-[10px] leading-4 font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  )
}
