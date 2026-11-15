import { model, Schema, Types } from "mongoose";
import { AppConfigInterface, ContactDetails } from "./appconfig.interface";

const contactSchema = new Schema<ContactDetails>(
  {
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    address: { type: String, default: "" },
    hours: { type: String, default: "" },
    mapUrl: { type: String, default: "" },
  },
  { _id: false },
);

const appConfigSchema = new Schema<AppConfigInterface>({
  appName: {
    type: String,
    required: true,
  },

  openLogin: {
    type: Boolean,
    required: true,
  },

  openRegister: {
    type: Boolean,
    required: true,
  },

  appLogo: {
    type: Types.ObjectId,
    required: false,
  },

  contact: {
    type: contactSchema,
    required: false,
  },

  adminRegistered: {
    type: Boolean,
    required: true,
    default: false,
  },
});

export const AppConfigModel = model<AppConfigInterface>(
  "AppConfig",
  appConfigSchema,
);
