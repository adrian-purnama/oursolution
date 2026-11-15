import { Types } from "mongoose";

/**
 * The company's public contact details, shown on /contact. Every field is
 * optional; an empty one is not shown.
 */
export interface ContactDetails {
  email: string;
  phone: string;
  /** Digits with the country code, e.g. "6281234567890" (a wa.me link). */
  whatsapp: string;
  /** May span lines. */
  address: string;
  /** May span lines, e.g. "Mon-Fri 09:00-17:00". */
  hours: string;
  /** An https link, e.g. to Google Maps. */
  mapUrl: string;
}

export const EMPTY_CONTACT: ContactDetails = {
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  hours: "",
  mapUrl: "",
};

export interface AppConfigInterface {
  appName: string;
  openLogin: boolean;
  openRegister: boolean;
  appLogo?: Types.ObjectId;
  contact?: Partial<ContactDetails>;
  /** Set once the first-register admin slot has been claimed. */
  adminRegistered: boolean;
}
