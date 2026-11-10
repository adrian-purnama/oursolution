// Placeholder copy: replace with your own onboarding steps.
const STEPS = [
  {
    title: 'Create your account',
    body: 'Enter your email, confirm the code we send, and choose a password.',
  },
  {
    title: 'Pick your products',
    body: 'Check out the products you need. Each one runs for its own period.',
  },
  {
    title: 'Start from the dashboard',
    body: 'Every product you have active is waiting there, ready to use.',
  },
]

export default function HowItWorks() {
  return (
    <section className="text-[var(--paper)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <h2 className="font-display mb-14 text-4xl tracking-tight sm:text-5xl">
          Three steps, then you are in.
        </h2>

        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-white/15 pt-6">
              <p className="font-display mb-6 text-5xl text-white/30">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/60">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
