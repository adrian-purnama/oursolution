import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '#/lib/password'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** The password rules, each ticked off as the password meets it. */
export default function PasswordChecklist({
  password,
  id,
  className,
}: {
  password: string
  id?: string
  className?: string
}) {
  return (
    <ul
      id={id}
      aria-label={m.pw_requirements()}
      className={cn('mt-2 grid gap-1 text-xs sm:grid-cols-2', className)}
    >
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-1.5 transition-colors',
              met ? 'text-emerald-700' : 'text-[var(--muted)]',
            )}
          >
            {met ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden />
            )}
            <span>
              {rule.label}
              <span className="sr-only">
                {met ? m.pw_done() : m.pw_missing()}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
