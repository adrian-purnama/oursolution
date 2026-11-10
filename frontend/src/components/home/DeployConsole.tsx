import { useBranding } from '#/context/brandingContext'

const STEPS = [
  'Provisioning container',
  'Attaching persistent volume',
  'Issuing TLS certificate',
  'Health check passed',
]

/** Illustration for the hero: an app going live, one step at a time. */
export default function DeployConsole() {
  const { appName } = useBranding()
  const domain = `${appName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'app'}.app`
  const delay = (index: number) => ({
    animationDelay: `${300 + index * 450}ms`,
  })

  return (
    <div
      role="img"
      aria-label="Example: an n8n instance deploying and going live"
      className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_1px_2px_rgba(12,12,11,0.04),0_12px_32px_-12px_rgba(12,12,11,0.18)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#e5e2dc]" />
        <span className="size-2.5 rounded-full bg-[#e5e2dc]" />
        <span className="size-2.5 rounded-full bg-[#e5e2dc]" />
        <span className="ml-2 font-mono text-xs text-[var(--muted)]">
          n8n · production
        </span>
      </div>

      <div className="space-y-2.5 p-5 font-mono text-[13px] leading-relaxed">
        <p className="console-line text-[var(--muted)]" style={delay(0)}>
          $ deploy n8n --plan monthly
        </p>
        {STEPS.map((step, index) => (
          <p
            key={step}
            className="console-line flex items-center gap-2 text-[var(--ink)]"
            style={delay(index + 1)}
          >
            <span className="text-[var(--accent)]">✓</span>
            {step}
          </p>
        ))}
        <div
          className="console-line mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
          style={delay(STEPS.length + 1)}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-sans text-xs font-medium text-[var(--ink)]">
            Live
          </span>
          <span className="truncate text-[var(--muted)]">
            https://n8n-acme.{domain}
          </span>
        </div>
      </div>
    </div>
  )
}
