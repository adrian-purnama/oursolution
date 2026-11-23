import { createFileRoute } from '@tanstack/react-router'
import GoogleCallback from '#/components/forms/auth/GoogleCallback'
import { privatePage } from '#/lib/seo'
import { m } from '#/paraglide/messages'

type GoogleCallbackSearch = { code?: string; state?: string; error?: string }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

export const Route = createFileRoute('/auth/google/callback')({
  head: () => privatePage(m.seo_signing_in()),
  validateSearch: (search: Record<string, unknown>): GoogleCallbackSearch => ({
    code: text(search.code),
    state: text(search.state),
    error: text(search.error),
  }),
  component: GoogleCallbackPage,
})

function GoogleCallbackPage() {
  const { code, state, error } = Route.useSearch()
  return (
    <main className="mx-auto mt-8 mb-12 w-full max-w-md px-6 pt-12 pb-10 text-[var(--ink)] sm:mt-12 sm:pt-16">
      <GoogleCallback code={code} state={state} error={error} />
    </main>
  )
}
