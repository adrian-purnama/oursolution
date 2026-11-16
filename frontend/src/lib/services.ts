import {
  Activity,
  Cloud,
  Code2,
  DatabaseBackup,
  LayoutDashboard,
  LifeBuoy,
  MessageCircle,
  Plug,
  RefreshCw,
  ScrollText,
  Server,
  ShieldCheck,
  Smartphone,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ANSWR_URL, BRAND_NAME, CONTACT_URL } from '#/lib/config'

export type ServiceSlug = 'software' | 'hosting' | 'answr'

type Action =
  | { label: string; to: '/pricing' }
  | { label: string; href: string; external?: boolean }

export type Service = {
  slug: ServiceSlug
  name: string
  /** One line: what it is. */
  tagline: string
  /** Two sentences for cards and lists. */
  summary: string
  icon: LucideIcon
  /** The service's own logo mark (a file in /public), shown instead of the icon. */
  logo?: string
  /** The full logo with its wordmark (a file in /public), for cards and pages. */
  fullLogo?: string
  /** Wordmark text beside the mark when there is no full logo file. */
  wordmark?: string
  /** Three highlights for cards. */
  points: string[]
  /** Opening paragraph of the service's own page. */
  intro: string
  /** "What you get" on the service's own page. */
  features: { icon: LucideIcon; title: string; body: string }[]
  /** "How it works" on the service's own page, in order. */
  steps: { title: string; body: string }[]
  primary: Action
  secondary?: Action
}

/** The three things we offer. The whole public site reads from this. */
export const SERVICES: Service[] = [
  {
    slug: 'software',
    name: 'Software solutions',
    tagline: 'Custom software, built around how you work.',
    summary:
      'You have a process to fix. We plan, design and build the web or mobile app for it, then stay on after launch.',
    icon: Code2,
    logo: '/oursolution-mark.png',
    fullLogo: '/oursolution-logo.png',
    points: [
      'A plan and an estimate before any code',
      'Working releases you can try each week',
      'We stay on after launch',
    ],
    intro:
      'Dashboards, portals, mobile apps and integrations, built by one team that also hosts and maintains them. Nothing falls between an agency, a freelancer and a server nobody owns.',
    features: [
      {
        icon: Code2,
        title: 'Custom web apps',
        body: 'Dashboards, portals and internal tools built around how you work.',
      },
      // {
      //   icon: Smartphone,
      //   title: 'Mobile apps',
      //   body: 'Apps for your customers or your field team, on iOS and Android.',
      // },
      {
        icon: Workflow,
        title: 'Process digitalization',
        body: 'Replace paper, spreadsheets and chat threads with clear workflows.',
      },
      {
        icon: Plug,
        title: 'Integrations and APIs',
        body: 'Connect payments, messaging and the systems you already use.',
      },
      {
        icon: Cloud,
        title: 'Cloud and DevOps',
        body: 'Hosting, CI/CD, backups and monitoring, set up properly.',
      },
      {
        icon: LifeBuoy,
        title: 'Maintenance and support',
        body: 'Updates, fixes and new features after launch.',
      },
    ],
    steps: [
      {
        title: 'Discovery',
        body: 'We learn your goals, your users and the process you want to fix.',
      },
      {
        title: 'Design',
        body: 'Flows, screens and architecture you approve before we build.',
      },
      {
        title: 'Build',
        body: 'Short iterations with working releases you can try each week.',
      },
      {
        title: 'Test',
        body: 'Functional, security and performance checks before go-live.',
      },
      {
        title: 'Launch',
        body: 'Deployment, data migration and training for your team.',
      },
      {
        title: 'Support',
        body: 'Hosting, monitoring, maintenance and the next round of improvements.',
      },
    ],
    primary: { label: 'Start a project', href: CONTACT_URL },
  },
  {
    slug: 'hosting',
    name: 'Hosting solutions',
    tagline: 'Ready-made tools, hosted and looked after for you.',
    summary:
      'You need a tool, not a project. Pick a ready-made app like n8n and we host, monitor and update it for you.',
    icon: Server,
    logo: '/oursolution-hosting-mark.png',
    fullLogo: '/oursolution-hosting-logo.png',
    points: [
      'Ready-made apps like n8n, hosted for you',
      'We run the servers, backups and updates',
      'Extend or stop a subscription anytime',
    ],
    intro:
      'The same infrastructure we run client projects on, sold as simple plans in our shop. You use the tool, we keep it up.',
    features: [
      {
        icon: Server,
        title: 'Ready-made apps',
        body: 'Tools like n8n, set up for you, plus workflows to start from.',
      },
      {
        icon: DatabaseBackup,
        title: 'Backups',
        body: 'Your data is backed up for you, without anything to configure.',
      },
      {
        icon: Activity,
        title: 'Monitoring',
        body: 'We watch your instance so problems are caught on our side.',
      },
      {
        icon: RefreshCw,
        title: 'Managed updates',
        body: 'We apply updates, so you are not left on an old version.',
      },
      {
        icon: LayoutDashboard,
        title: 'One dashboard',
        body: 'Everything you run with us, and its status, in one place.',
      },
      {
        icon: ShieldCheck,
        title: 'No lock-in',
        body: 'Subscriptions run by the period. Extend or stop anytime.',
      },
    ],
    steps: [
      {
        title: 'Pick a plan',
        body: 'Choose the app and the period you want in the shop.',
      },
      {
        title: 'Check out',
        body: 'Create an account and pay. No call or contract needed.',
      },
      {
        title: 'We set it up',
        body: 'Your instance is deployed on our servers, ready to use.',
      },
      {
        title: 'You use it, we run it',
        body: 'Follow it from your dashboard and extend whenever you like.',
      },
    ],
    primary: { label: 'Browse hosting plans', to: '/pricing' },
    secondary: { label: 'Ask us a question', href: CONTACT_URL },
  },
  {
    slug: 'answr',
    name: 'answr.id',
    tagline: 'An AI chatbot for your website.',
    summary:
      'An AI assistant you embed on your site with one script tag. It answers visitors from your own knowledge.',
    icon: MessageCircle,
    logo: '/answr-full.png',
    wordmark: '',
    points: [
      'Answers from your own knowledge',
      'Added to your site with one script tag',
      `Built and run by ${BRAND_NAME}`,
    ],
    intro:
      'answr is our own product: a chatbot that answers your visitors using the knowledge you give it, so common questions get an answer at any hour.',
    features: [
      {
        icon: ScrollText,
        title: 'Your own knowledge',
        body: 'It answers from the information you provide, not from guesswork.',
      },
      {
        icon: Code2,
        title: 'One script tag',
        body: 'Paste one line into your site and the assistant appears.',
      },
      {
        icon: MessageCircle,
        title: 'Always available',
        body: 'Visitors get an answer straight away, day or night.',
      },
      {
        icon: Server,
        title: `Run by ${BRAND_NAME}`,
        body: 'Built and hosted by the same team behind everything else here.',
      },
    ],
    steps: [
      {
        title: 'Add your knowledge',
        body: 'Give answr the information your visitors usually ask about.',
      },
      {
        title: 'Embed it',
        body: 'Paste the script tag into your website.',
      },
      {
        title: 'Visitors get answers',
        body: 'The assistant replies on your site using your knowledge.',
      },
    ],
    primary: { label: 'Visit answr.id', href: ANSWR_URL, external: true },
    secondary: { label: 'Talk to us about it', href: CONTACT_URL },
  },
]

export function getService(slug: string): Service | undefined {
  return SERVICES.find((service) => service.slug === slug)
}
