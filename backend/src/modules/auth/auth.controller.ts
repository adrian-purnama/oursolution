import { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { PlanSummaryDto } from "../../dto/plan.dto";
import { LoginInDto, LoginOutDto } from "../../dto/login.dto";
import { RegisterOutDto, RegisterInDto } from "../../dto/register.dto";
import { ResetPasswordOutDto } from "../../dto/resetPassword.dto";
import type { UserRole } from "../../models/user/user.interface";
import { normalizeEmail } from "../../utils/email";
import { userPlanService } from "../userPlan/userPlan.service";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  sendOtp = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Invalid email",
          data: null,
        } satisfies ApiResponseDto);
      }

      const isResetPassword = Boolean(req.body?.isResetPassword);

      const ok = await this.authService.sendOtp({ email, isResetPassword });

      if (!ok) {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP",
          data: null,
        } satisfies ApiResponseDto);
      }

      return res.status(200).json({
        success: true,
        message: "OTP sent",
        data: { email },
      } satisfies ApiResponseDto<{ email: string }>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send OTP",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  register = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Invalid email",
          data: null,
        } satisfies ApiResponseDto);
      }

      if (!otp || !password) {
        return res.status(400).json({
          success: false,
          message: "OTP and password are required",
          data: null,
        } satisfies ApiResponseDto);
      }

      const input: RegisterInDto = { email, otp, password };
      const data = await this.authService.register(input);

      return res.status(201).json({
        success: true,
        message: "Registered successfully",
        data,
      } satisfies ApiResponseDto<RegisterOutDto>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Register failed",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const rememberMe = Boolean(req.body?.rememberMe);

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Invalid email",
          data: null,
        } satisfies ApiResponseDto);
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
          data: null,
        } satisfies ApiResponseDto);
      }

      const input: LoginInDto = { email, password, rememberMe };
      const data = await this.authService.login(input);

      return res.status(200).json({
        success: true,
        message: "Logged in successfully",
        data,
      } satisfies ApiResponseDto<LoginOutDto>);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
        data: null,
      } satisfies ApiResponseDto);
    }
  };

  validateUser = async (req: Request, res: Response) => {
    const plan = await userPlanService.getCurrentPlanSummary(req.user!.id);
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      data: {
        email: req.user!.email,
        role: req.user!.role,
        plan,
      },
    } satisfies ApiResponseDto<{
      email: string;
      role: UserRole;
      plan: PlanSummaryDto;
    }>);
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Invalid email",
          data: null,
        } satisfies ApiResponseDto);
      }

      if (!otp || !password) {
        return res.status(400).json({
          success: false,
          message: "OTP and password are required",
          data: null,
        } satisfies ApiResponseDto);
      }

      const data = await this.authService.resetPassword({
        email,
        otp,
        password,
      });

      return res.status(200).json({
        success: true,
        message: "Password reset successfully",
        data,
      } satisfies ApiResponseDto<ResetPasswordOutDto>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Password reset failed",
        data: null,
      } satisfies ApiResponseDto);
    }
  };
}
