/** The company's public contact details; empty fields are not shown. */
export type ContactDetails = {
  email: string
  phone: string
  /** Digits with the country code, e.g. 6281234567890. */
  whatsapp: string
  address: string
  hours: string
  mapUrl: string
}

export const EMPTY_CONTACT: ContactDetails = {
  email: '',
  phone: '',
  whatsapp: '',
  address: '',
  hours: '',
  mapUrl: '',
}
