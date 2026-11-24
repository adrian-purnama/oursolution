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
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ANSWR_URL, BRAND_NAME, CONTACT_URL } from '#/lib/config'
import { m } from '#/paraglide/messages'

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

/**
 * The three things we offer. The whole public site reads from this. Text
 * fields are getters so they follow the current language each time they are read.
 */
export const SERVICES: Service[] = [
  {
    slug: 'software',
    get name() {
      return m.svc_software_name()
    },
    get tagline() {
      return m.svc_software_tagline()
    },
    get summary() {
      return m.svc_software_summary()
    },
    icon: Code2,
    logo: '/oursolution-mark.png',
    fullLogo: '/oursolution-logo.png',
    get points() {
      return [
        m.svc_software_point_1(),
        m.svc_software_point_2(),
        m.svc_software_point_3(),
      ]
    },
    get intro() {
      return m.svc_software_intro()
    },
    get features() {
      return [
        {
          icon: Code2,
          title: m.svc_software_f1_title(),
          body: m.svc_software_f1_body(),
        },
        {
          icon: Workflow,
          title: m.svc_software_f2_title(),
          body: m.svc_software_f2_body(),
        },
        {
          icon: Plug,
          title: m.svc_software_f3_title(),
          body: m.svc_software_f3_body(),
        },
        {
          icon: Cloud,
          title: m.svc_software_f4_title(),
          body: m.svc_software_f4_body(),
        },
        {
          icon: LifeBuoy,
          title: m.svc_software_f5_title(),
          body: m.svc_software_f5_body(),
        },
      ]
    },
    get steps() {
      return [
        { title: m.svc_software_s1_title(), body: m.svc_software_s1_body() },
        { title: m.svc_software_s2_title(), body: m.svc_software_s2_body() },
        { title: m.svc_software_s3_title(), body: m.svc_software_s3_body() },
        { title: m.svc_software_s4_title(), body: m.svc_software_s4_body() },
        { title: m.svc_software_s5_title(), body: m.svc_software_s5_body() },
        { title: m.svc_software_s6_title(), body: m.svc_software_s6_body() },
      ]
    },
    get primary() {
      return { label: m.svc_software_primary(), href: CONTACT_URL }
    },
  },
  {
    slug: 'hosting',
    get name() {
      return m.svc_hosting_name()
    },
    get tagline() {
      return m.svc_hosting_tagline()
    },
    get summary() {
      return m.svc_hosting_summary()
    },
    icon: Server,
    logo: '/oursolution-hosting-mark.png',
    fullLogo: '/oursolution-hosting-logo.png',
    get points() {
      return [
        m.svc_hosting_point_1(),
        m.svc_hosting_point_2(),
        m.svc_hosting_point_3(),
      ]
    },
    get intro() {
      return m.svc_hosting_intro()
    },
    get features() {
      return [
        {
          icon: Server,
          title: m.svc_hosting_f1_title(),
          body: m.svc_hosting_f1_body(),
        },
        {
          icon: DatabaseBackup,
          title: m.svc_hosting_f2_title(),
          body: m.svc_hosting_f2_body(),
        },
        {
          icon: Activity,
          title: m.svc_hosting_f3_title(),
          body: m.svc_hosting_f3_body(),
        },
        {
          icon: RefreshCw,
          title: m.svc_hosting_f4_title(),
          body: m.svc_hosting_f4_body(),
        },
        {
          icon: LayoutDashboard,
          title: m.svc_hosting_f5_title(),
          body: m.svc_hosting_f5_body(),
        },
        {
          icon: ShieldCheck,
          title: m.svc_hosting_f6_title(),
          body: m.svc_hosting_f6_body(),
        },
      ]
    },
    get steps() {
      return [
        { title: m.svc_hosting_s1_title(), body: m.svc_hosting_s1_body() },
        { title: m.svc_hosting_s2_title(), body: m.svc_hosting_s2_body() },
        { title: m.svc_hosting_s3_title(), body: m.svc_hosting_s3_body() },
        { title: m.svc_hosting_s4_title(), body: m.svc_hosting_s4_body() },
      ]
    },
    get primary() {
      return { label: m.svc_hosting_primary(), to: '/pricing' as const }
    },
    get secondary() {
      return { label: m.svc_hosting_secondary(), href: CONTACT_URL }
    },
  },
  {
    slug: 'answr',
    get name() {
      return m.svc_answr_name()
    },
    get tagline() {
      return m.svc_answr_tagline()
    },
    get summary() {
      return m.svc_answr_summary()
    },
    icon: MessageCircle,
    logo: '/answr-full.png',
    wordmark: '',
    get points() {
      return [
        m.svc_answr_point_1(),
        m.svc_answr_point_2(),
        m.svc_answr_point_3({ brand: BRAND_NAME }),
      ]
    },
    get intro() {
      return m.svc_answr_intro()
    },
    get features() {
      return [
        {
          icon: ScrollText,
          title: m.svc_answr_f1_title(),
          body: m.svc_answr_f1_body(),
        },
        {
          icon: Code2,
          title: m.svc_answr_f2_title(),
          body: m.svc_answr_f2_body(),
        },
        {
          icon: MessageCircle,
          title: m.svc_answr_f3_title(),
          body: m.svc_answr_f3_body(),
        },
        {
          icon: Server,
          title: m.svc_answr_f4_title({ brand: BRAND_NAME }),
          body: m.svc_answr_f4_body(),
        },
      ]
    },
    get steps() {
      return [
        { title: m.svc_answr_s1_title(), body: m.svc_answr_s1_body() },
        { title: m.svc_answr_s2_title(), body: m.svc_answr_s2_body() },
        { title: m.svc_answr_s3_title(), body: m.svc_answr_s3_body() },
      ]
    },
    get primary() {
      return { label: m.svc_answr_primary(), href: ANSWR_URL, external: true }
    },
    get secondary() {
      return { label: m.svc_answr_secondary(), href: CONTACT_URL }
    },
  },
]

export function getService(slug: string): Service | undefined {
  return SERVICES.find((service) => service.slug === slug)
}
