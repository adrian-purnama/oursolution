import { Types } from "mongoose";

export interface AppConfigInterface {
  appName: string;
  openLogin: boolean;
  openRegister: boolean;
  appLogo?: Types.ObjectId;
  /** Set once the first-register admin slot has been claimed. */
  adminRegistered: boolean;
}
