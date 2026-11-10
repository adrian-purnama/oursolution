import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import UserAvatar from '#/components/UserAvatar'
import { useAuth } from '#/context/authContext'
import { useBranding } from '#/context/brandingContext'
import { cn } from '#/lib/utils'

type NavLink = {
  to: '/' | '/pricing' | '/dashboard' | '/admin'
  label: string
}

const HOME_LINK: NavLink = { to: '/', label: 'Home' }
const PRICING_LINK: NavLink = { to: '/pricing', label: 'Pricing' }
const DASHBOARD_LINK: NavLink = { to: '/dashboard', label: 'Dashboard' }
const ADMIN_LINK: NavLink = { to: '/admin', label: 'Admin' }

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

  useEffect(() => {
    setMounted(true)
  }, [])

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
    'text-sm font-medium text-[var(--muted)] no-underline transition hover:text-[var(--ink)]'

  const activeNavClass = cn(navLinkClass, 'text-[var(--ink)]')

  const drawerLinkClass =
    'block px-6 py-3 text-base font-medium text-[var(--ink)] no-underline transition hover:bg-[var(--surface)]'
  const drawerActiveClass = cn(
    drawerLinkClass,
    'bg-[var(--surface)] font-semibold',
  )

  const ctaOutlineClass =
    'rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm font-medium text-[var(--ink)] no-underline transition hover:bg-[var(--surface)]'

  const ctaPrimaryClass =
    'rounded-[var(--radius-sm)] bg-[var(--ink)] px-3.5 py-1.5 text-sm font-medium text-white no-underline transition hover:opacity-90'

  // Everyone sees Pricing; signed-in users get Dashboard, admins also Admin.
  const visibleLinks: NavLink[] = !isAuthenticated
    ? [HOME_LINK, PRICING_LINK]
    : isAdmin
      ? [DASHBOARD_LINK, PRICING_LINK, ADMIN_LINK]
      : [DASHBOARD_LINK, PRICING_LINK]

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-[var(--line)] bg-white/80 text-[var(--ink)] backdrop-blur-md',
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          className="font-display inline-flex items-center gap-2 justify-self-start text-lg no-underline"
        >
          {appLogo ? (
            <img
              src={appLogo}
              alt={appName}
              className="size-7 object-contain"
            />
          ) : (
            appName
          )}
        </Link>

        <div className="hidden items-center justify-center gap-6 sm:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={navLinkClass}
              activeProps={{ className: activeNavClass }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center justify-self-end gap-3 sm:flex">
          {isLoading ? null : isAuthenticated ? (
            <>
              {user ? (
                <Link
                  to="/profile"
                  title={user.email}
                  aria-label={`Profile (${user.email})`}
                  className="rounded-full no-underline transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <UserAvatar email={user.email} />
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className={cn(
                  'inline-flex cursor-pointer items-center justify-center bg-transparent px-2 text-[var(--ink)] transition hover:opacity-70',
                )}
                aria-label="Log out"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
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
                Login
              </Link>
              <Link
                to="/register"
                className={ctaPrimaryClass}
                activeProps={{
                  className: cn(ctaPrimaryClass, 'opacity-90'),
                }}
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className={cn(
            'inline-flex size-10 items-center justify-center text-[var(--ink)] sm:hidden',
          )}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={openMenu}
        >
          <Menu className="size-6" aria-hidden />
          <span className="sr-only">Open menu</span>
        </button>
      </nav>

      {mounted &&
        menuVisible &&
        createPortal(
          <div
            className={cn(
              'fixed inset-0 z-[100] sm:hidden',
              menuAnimated ? 'pointer-events-auto' : 'pointer-events-none',
            )}
          >
            <button
              type="button"
              className={cn(
                'absolute inset-0 border-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out',
                menuAnimated ? 'opacity-100' : 'opacity-0',
              )}
              aria-label="Close menu"
              onClick={closeMenu}
            />

            <aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              aria-hidden={!menuAnimated}
              className={cn(
                'absolute inset-y-0 right-0 z-10 flex w-[min(20rem,88vw)] flex-col rounded-l-[var(--radius-md)] border-l border-[var(--line)] bg-white text-[var(--ink)] shadow-2xl transition-transform duration-300 ease-out',
                menuAnimated ? 'translate-x-0' : 'translate-x-full',
              )}
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3">
                <span className="inline-flex items-center gap-2 text-xl tracking-tight">
                  {appLogo ? (
                    <img
                      src={appLogo}
                      alt={appName}
                      className="size-7 object-contain"
                    />
                  ) : (
                    appName
                  )}
                </span>
                <button
                  type="button"
                  className="inline-flex size-10 items-center justify-center text-[var(--ink)]"
                  onClick={closeMenu}
                >
                  <X className="size-6" aria-hidden />
                  <span className="sr-only">Close menu</span>
                </button>
              </div>

              <div className="flex flex-1 flex-col bg-white py-2">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={drawerLinkClass}
                    activeProps={{ className: drawerActiveClass }}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="mt-auto border-t border-[var(--line)] bg-white p-4">
                {isLoading ? null : isAuthenticated ? (
                  <>
                    {user ? (
                      <Link
                        to="/profile"
                        onClick={closeMenu}
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
                      Log out
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/login"
                      className="block rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--ink)] no-underline transition hover:border-[var(--ink)]"
                      onClick={closeMenu}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="block rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-3 text-center text-sm font-semibold text-white no-underline transition hover:opacity-90"
                      onClick={closeMenu}
                    >
                      Register
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
