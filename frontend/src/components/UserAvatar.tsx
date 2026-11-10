import { cn } from '#/lib/utils'

/**
 * Two letters from the part before "@": the first letter of the first two
 * words when it is split by dots, dashes, underscores or plus signs
 * (john.doe → JD), otherwise its first two characters (adrian → AD).
 */
export function emailInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  const words = local.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const letters =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`
      : (words[0] ?? '').slice(0, 2)
  return letters.toUpperCase() || '?'
}

/** A circle with the user's initials, used for the signed-in account. */
export default function UserAvatar({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-semibold tracking-wide text-white select-none',
        className,
      )}
    >
      {emailInitials(email)}
    </span>
  )
}
