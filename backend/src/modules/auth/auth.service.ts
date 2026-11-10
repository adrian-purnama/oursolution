import * as bcrypt from "bcrypt";
import { RegisterInDto, RegisterOutDto } from "../../dto/register.dto";
import { LoginInDto, LoginOutDto } from "../../dto/login.dto";
import {
  ResetPasswordInDto,
  ResetPasswordOutDto,
} from "../../dto/resetPassword.dto";
import { SendOtpInDto } from "../../dto/sendOtp.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type { OtpPurpose } from "../../models/otp/otp.interface";
import { UserModel } from "../../models/user/user.model";
import { signAccessToken } from "../../utils/jwt";
import { encodeResetToken } from "../../utils/resetToken";
import { passwordProblem } from "../../validation/password";
import { appConfigService } from "../appConfig/appConfig.service";
import { mailer } from "../mail/mail.service";
import { OtpService } from "../otp/otp.service";

const BCRYPT_ROUNDS = 10;
const REGISTRATION_CLOSED = "Registration is closed, please contact admin";
const LOGIN_CLOSED = "Login is closed, please contact admin";
const INVALID_CREDENTIALS = "Invalid email or password";
const INVALID_OTP = "Invalid or expired OTP";

// Compared against when the email is unknown, so both paths cost one bcrypt run.
const DUMMY_HASH = bcrypt.hashSync(
  "unused-placeholder-password",
  BCRYPT_ROUNDS,
);

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

export class AuthService {
  private readonly source = "auth/auth.service.ts";

  constructor(private readonly otpService = new OtpService()) {}

  /**
   * Always reports success for a well-formed request, whether or not the email
   * has an account, so the endpoint cannot be used to discover accounts. The
   * mail is only sent when it makes sense.
   */
  async sendOtp(input: SendOtpInDto): Promise<boolean> {
    const email = input.email;
    const purpose: OtpPurpose = input.isResetPassword ? "reset" : "register";
    const method = "sendOtp";

    if (
      purpose === "register" &&
      !appConfigService.openRegister &&
      !appConfigService.firstRegister
    ) {
      throw new Error(REGISTRATION_CLOSED);
    }

    // Issued even when no mail goes out, so cooldown behaves the same either way.
    const otp = await this.otpService.issue(email, purpose);

    const userExists = Boolean(await UserModel.findOne({ email }));
    const shouldSend = purpose === "reset" ? userExists : !userExists;
    if (!shouldSend) {
      logger.debug(
        `Skipped ${purpose} mail for ${email} (account ${userExists ? "exists" : "missing"})`,
        this.source,
        method,
      );
      return true;
    }

    const sent =
      purpose === "reset"
        ? await mailer.sendResetPasswordLink(
            email,
            `${env.frontendUrl}/reset-password?token=${encodeResetToken(email, otp)}`,
          )
        : await mailer.sendOtp(email, otp);

    if (!sent) {
      logger.error(
        `Failed to send ${purpose} mail to ${email}`,
        this.source,
        method,
      );
      return false;
    }

    logger.debug(`Sent ${purpose} mail to ${email}`, this.source, method);
    return true;
  }

  async register(input: RegisterInDto): Promise<RegisterOutDto> {
    const { email, otp, password } = input;
    const method = "register";

    if (!appConfigService.openRegister && !appConfigService.firstRegister) {
      throw new Error(REGISTRATION_CLOSED);
    }

    const problem = passwordProblem(password);
    if (problem) {
      throw new Error(problem);
    }

    const ok = await this.otpService.validateAndConsume(email, otp, "register");
    if (!ok) {
      throw new Error(INVALID_OTP);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Only one registration can ever win the first-admin slot.
    const isFirstAdmin =
      appConfigService.firstRegister &&
      (await appConfigService.claimFirstAdmin());

    if (!isFirstAdmin && !appConfigService.openRegister) {
      throw new Error(REGISTRATION_CLOSED);
    }

    try {
      const user = await UserModel.create({
        email,
        hashedPassword,
        role: isFirstAdmin ? "admin" : "user",
      });

      const token = signAccessToken({
        userId: user.id,
        email: user.email,
        rememberMe: false,
        tokenVersion: user.tokenVersion ?? 0,
      });

      logger.debug(`User registered: ${email}`, this.source, method);

      return {
        email,
        jwt: token,
      };
    } catch (error) {
      if (isFirstAdmin) {
        await appConfigService.releaseFirstAdmin();
      }
      if (isDuplicateKeyError(error)) {
        throw new Error("Email already registered");
      }
      logger.error(
        error instanceof Error ? error.message : String(error),
        this.source,
        method,
      );
      throw error;
    }
  }

  async login(input: LoginInDto): Promise<LoginOutDto> {
    const email = input.email;
    const password = input.password;
    const rememberMe = input.rememberMe ?? false;
    const method = "login";

    const user = await UserModel.findOne({ email });
    const match = await bcrypt.compare(
      password,
      user?.hashedPassword ?? DUMMY_HASH,
    );
    if (!user || !match) {
      throw new Error(INVALID_CREDENTIALS);
    }

    if (user.isBlocked) {
      throw new Error("This account is blocked, please contact admin");
    }

    // Admins can always sign in, otherwise nobody could reopen login.
    if (!appConfigService.openLogin && user.role !== "admin") {
      throw new Error(LOGIN_CLOSED);
    }

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      rememberMe,
      tokenVersion: user.tokenVersion ?? 0,
    });

    logger.debug(`User logged in: ${email}`, this.source, method);

    return {
      email: user.email,
      jwt: token,
    };
  }

  async resetPassword(input: ResetPasswordInDto): Promise<ResetPasswordOutDto> {
    const { email, otp, password } = input;
    const method = "resetPassword";

    const problem = passwordProblem(password);
    if (problem) {
      throw new Error(problem);
    }

    const ok = await this.otpService.validateAndConsume(email, otp, "reset");
    if (!ok) {
      throw new Error(INVALID_OTP);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Bumping tokenVersion signs the account out everywhere.
    const result = await UserModel.updateOne(
      { email },
      { $set: { hashedPassword }, $inc: { tokenVersion: 1 } },
    );
    if (result.matchedCount === 0) {
      throw new Error(INVALID_OTP);
    }

    logger.debug(`Password reset for ${email}`, this.source, method);

    return { email };
  }
}
