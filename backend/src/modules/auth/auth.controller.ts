import { Request, Response } from "express";
import type { ProductSummaryDto } from "../../dto/product.dto";
import type {
  GoogleConfigOutDto,
  GoogleSignInOutDto,
} from "../../dto/google.dto";
import { LoginInDto, LoginOutDto } from "../../dto/login.dto";
import { RegisterOutDto, RegisterInDto } from "../../dto/register.dto";
import { ResetPasswordOutDto } from "../../dto/resetPassword.dto";
import type { UserRole } from "../../models/user/user.interface";
import { normalizeEmail } from "../../utils/email";
import { userProductService } from "../userProduct/userProduct.service";
import { AuthService } from "./auth.service";
import { fail, ok, refuse } from "../../utils/respond";

/** The one-time code from Google, or null when missing or implausible. */
function googleCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code && code.length <= 2048 ? code : null;
}

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  sendOtp = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);

      if (!email) {
        return refuse(res, 400, "Invalid email");
      }

      const isResetPassword = Boolean(req.body?.isResetPassword);

      const sent = await this.authService.sendOtp({ email, isResetPassword });

      if (!sent) {
        return refuse(res, 500, "Failed to send OTP");
      }

      return ok<{ email: string }>(res, "OTP sent", { email });
    } catch (error) {
      return fail(res, error, "Failed to send OTP");
    }
  };

  register = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!email) {
        return refuse(res, 400, "Invalid email");
      }

      if (!otp || !password) {
        return refuse(res, 400, "OTP and password are required");
      }

      const input: RegisterInDto = { email, otp, password };
      const data = await this.authService.register(input);

      return ok<RegisterOutDto>(res, "Registered successfully", data, 201);
    } catch (error) {
      return fail(res, error, "Register failed");
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const rememberMe = Boolean(req.body?.rememberMe);

      if (!email) {
        return refuse(res, 400, "Invalid email");
      }

      if (!password) {
        return refuse(res, 400, "Password is required");
      }

      const input: LoginInDto = { email, password, rememberMe };
      const data = await this.authService.login(input);

      return ok<LoginOutDto>(res, "Logged in successfully", data);
    } catch (error) {
      return fail(res, error, "Login failed", 401);
    }
  };

  validateUser = async (req: Request, res: Response) => {
    const products = await userProductService.getActiveProducts(req.user!.id);
    return ok<{
      email: string;
      role: UserRole;
      /** Products active right now; empty when none is. */
      products: ProductSummaryDto[];
      /** True when a Google account can sign this user in. */
      googleLinked: boolean;
    }>(res, "Token is valid", {
      email: req.user!.email,
      role: req.user!.role,
      products,
      googleLinked: Boolean(req.user!.googleId),
    });
  };

  googleConfig = (_req: Request, res: Response) => {
    return ok<GoogleConfigOutDto>(
      res,
      "Google sign-in settings",
      this.authService.googleConfig(),
    );
  };

  googleSignIn = async (req: Request, res: Response) => {
    try {
      const code = googleCode(req.body?.code);
      if (!code) {
        return refuse(res, 400, "Google sign-in failed, please try again");
      }

      const data = await this.authService.googleSignIn({
        code,
        rememberMe: Boolean(req.body?.rememberMe),
      });

      return ok<GoogleSignInOutDto>(res, "Logged in successfully", data);
    } catch (error) {
      return fail(res, error, "Login failed", 401);
    }
  };

  linkGoogle = async (req: Request, res: Response) => {
    try {
      const code = googleCode(req.body?.code);
      if (!code) {
        return refuse(res, 400, "Linking Google failed, please try again");
      }

      await this.authService.linkGoogle(req.user!.id, code);

      return ok(res, "Google account linked", null);
    } catch (error) {
      return fail(res, error, "Linking Google failed");
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!email) {
        return refuse(res, 400, "Invalid email");
      }

      if (!otp || !password) {
        return refuse(res, 400, "OTP and password are required");
      }

      const data = await this.authService.resetPassword({
        email,
        otp,
        password,
      });

      return ok<ResetPasswordOutDto>(res, "Password reset successfully", data);
    } catch (error) {
      return fail(res, error, "Password reset failed");
    }
  };
}
