import { HydratedDocument } from "mongoose";
import { UserInterface } from "../models/user/user.interface";

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<UserInterface>;
    }
  }
}
