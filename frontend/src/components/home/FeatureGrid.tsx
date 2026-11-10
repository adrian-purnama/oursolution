import {
  KeyRound,
  Layers,
  LifeBuoy,
  Paintbrush,
  Shield,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Feature = {
  icon: LucideIcon
  title: string
  body: string
}

// Placeholder copy: replace with what your product actually offers.
const FEATURES: Feature[] = [
  {
    icon: KeyRound,
    title: 'Verified accounts',
    body: 'Every sign-up confirms its email with a one-time code before the account exists.',
  },
  {
    icon: Layers,
    title: 'Pick only what you need',
    body: 'Check out each product on its own and run as many as you like at once.',
  },
  {
    icon: LifeBuoy,
    title: 'Self-service recovery',
    body: 'Forgot a password? A reset link arrives by email and signs out old sessions.',
  },
  {
    icon: Shield,
    title: 'Admin area',
    body: 'Admins manage users, block accounts and reset passwords from one place.',
  },
  {
    icon: Users,
    title: 'Open or invite-only',
    body: 'Switch registration and login on or off without touching the code.',
  },
  {
    icon: Paintbrush,
    title: 'Your brand',
    body: 'Set the name and logo once and they appear across the app and its emails.',
  },
]

export default function FeatureGrid() {
  return (
    <section className="border-y border-dashed border-white/10 text-[var(--paper)]">
      <div className="trust-grid-dots h-10 sm:h-14" />

      <div className="mx-auto max-w-6xl border-t border-dashed border-white/10 px-6 py-16 sm:py-20">
        <h2 className="font-display max-w-2xl text-4xl leading-tight tracking-tight sm:text-5xl">
          The groundwork is already done.
        </h2>
      </div>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 [&>*]:-mt-px [&>*]:-ml-px">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="border border-dashed border-white/15 px-6 py-10 transition-colors duration-300 hover:bg-white/[0.03] sm:px-8 sm:py-12"
          >
            <Icon className="mb-6 size-5 text-white/60" aria-hidden />
            <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-white/60">{body}</p>
          </li>
        ))}
      </ul>

      <div className="trust-grid-dots h-10 border-t border-dashed border-white/10 sm:h-14" />
    </section>
  )
}
