import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { LOCALE_NAMES, LOCALE_SHORT } from '#/lib/i18n'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { getLocale, locales, setLocale } from '#/paraglide/runtime'
import type { Locale } from '#/paraglide/runtime'

/** Small round flag per language (drawn here: Windows has no flag emoji). */
function LocaleFlag({
  locale,
  className,
}: {
  locale: Locale
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(
        'size-4 shrink-0 rounded-[5px] ring-1 ring-black/10',
        className,
      )}
    >
      <defs>
        <clipPath id={`flag-${locale}`}>
          <rect width="24" height="24" rx="6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#flag-${locale})`}>
        {locale === 'id' ? (
          <>
            <rect width="24" height="12" fill="#e70011" />
            <rect y="12" width="24" height="12" fill="#fff" />
          </>
        ) : (
          <>
            <rect width="24" height="24" fill="#012169" />
            <path d="M0 0L24 24M24 0L0 24" stroke="#fff" strokeWidth="4.5" />
            <path d="M0 0L24 24M24 0L0 24" stroke="#c8102e" strokeWidth="2" />
            <path d="M12 0V24M0 12H24" stroke="#fff" strokeWidth="8" />
            <path d="M12 0V24M0 12H24" stroke="#c8102e" strokeWidth="4.5" />
          </>
        )}
      </g>
    </svg>
  )
}

/**
 * Saves the choice in the `locale` cookie and reloads: public pages move to
 * that language's URL (/pricing ⇄ /id/pricing), app pages stay put.
 */
function switchTo(locale: Locale) {
  if (locale === getLocale()) return
  void setLocale(locale)
}

/** Top-bar language menu: the current code, opening the full names. */
export function LanguageMenu({ className }: { className?: string }) {
  const current = getLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${m.language_label()}: ${LOCALE_NAMES[current]}`}
        className={cn(
          'group inline-flex cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] outline-none transition hover:bg-[var(--surface)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
          className,
        )}
      >
        <LocaleFlag locale={current} />
        {LOCALE_SHORT[current]}
        <ChevronDown
          className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-52 rounded-2xl border-[var(--line)] p-2 shadow-[0_24px_48px_-20px_rgba(12,12,11,0.25)]"
      >
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            lang={locale}
            onSelect={() => switchTo(locale)}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--ink)]"
          >
            <span className="flex items-center gap-2.5">
              <LocaleFlag locale={locale} />
              {LOCALE_NAMES[locale]}
            </span>
            {locale === current ? (
              <Check className="size-4 text-[var(--accent)]" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Mobile drawer: one button per language, the current one pressed. */
export function LanguageButtons({ className }: { className?: string }) {
  const current = getLocale()

  return (
    <div
      role="group"
      aria-label={m.language_label()}
      className={cn('flex items-center gap-2', className)}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => switchTo(locale)}
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition',
            locale === current
              ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
              : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]',
          )}
        >
          <LocaleFlag locale={locale} className="size-3.5" />
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  )
}
