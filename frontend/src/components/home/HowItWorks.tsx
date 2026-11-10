// Placeholder copy: replace with your own onboarding steps.
const STEPS = [
  {
    title: 'Create your account',
    body: 'Sign up with your email and confirm the code we send.',
  },
  {
    title: 'Pick a product',
    body: 'Check out hosting by the period, or buy a workflow once.',
  },
  {
    title: 'Run it',
    body: 'Your products appear on your dashboard, with their dates.',
  },
]

export default function HowItWorks() {
  return (
    <section className="border-b border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-mono text-xs tracking-wider text-[var(--muted)] uppercase">
            How it works
          </p>
          <h2 className="font-display text-3xl text-[var(--ink)] sm:text-4xl">
            From sign-up to running in minutes.
          </h2>
        </div>

        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative pt-8">
              <span
                aria-hidden
                className="absolute top-0 left-0 h-px w-full bg-[var(--line)]"
              />
              <span
                aria-hidden
                className="absolute top-0 left-0 h-px w-12 bg-[var(--ink)]"
              />
              <p className="mb-4 font-mono text-xs text-[var(--muted)]">
                Step {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mb-1.5 text-lg font-semibold text-[var(--ink)]">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
