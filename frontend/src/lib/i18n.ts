import type { Locale } from '#/paraglide/runtime'

/** Each language's name, written in that language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

/** Short code shown in the switcher button. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  id: 'ID',
}

/** Open Graph locale for each language. */
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  id: 'id_ID',
}
