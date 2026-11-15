import type { ContactDetails } from "../models/appconfig/appconfig.interface";
import { cleanBody } from "./ticket";

const MAX_LINE = 200;
const MAX_BLOCK = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()-]{5,30}$/;
const WHATSAPP = /^[0-9]{8,15}$/;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("contact must be an object");
  }
  return value as Record<string, unknown>;
}

function line(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length > MAX_LINE) {
    throw new Error(`${label} must be at most ${MAX_LINE} characters`);
  }
  return text;
}

/** Multi-line text, cleaned like a ticket message; empty is allowed. */
function block(value: unknown, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  if (!value.trim()) return "";
  const text = cleanBody(value, label);
  if (text.length > MAX_BLOCK) {
    throw new Error(`${label} must be at most ${MAX_BLOCK} characters`);
  }
  return text;
}

/** The whole set of contact details; a missing field becomes empty. */
export function parseContactDetails(value: unknown): ContactDetails {
  const raw = asRecord(value);
  const email = line(raw.email, "Email");
  const phone = line(raw.phone, "Phone");
  const whatsapp = line(raw.whatsapp, "WhatsApp").replace(/[\s()+-]/g, "");
  const mapUrl = line(raw.mapUrl, "Map link");

  if (email && !EMAIL.test(email)) throw new Error("Email is not valid");
  if (phone && !PHONE.test(phone)) {
    throw new Error("Phone may hold digits, spaces, +, - and brackets only");
  }
  if (whatsapp && !WHATSAPP.test(whatsapp)) {
    throw new Error(
      "WhatsApp must be the number with its country code, e.g. 6281234567890",
    );
  }
  if (mapUrl) {
    let url: URL;
    try {
      url = new URL(mapUrl);
    } catch {
      throw new Error("Map link must be a full https:// link");
    }
    if (url.protocol !== "https:") {
      throw new Error("Map link must be a full https:// link");
    }
  }

  return {
    email: email.toLowerCase(),
    phone,
    whatsapp,
    address: block(raw.address, "Address"),
    hours: block(raw.hours, "Opening hours"),
    mapUrl,
  };
}
