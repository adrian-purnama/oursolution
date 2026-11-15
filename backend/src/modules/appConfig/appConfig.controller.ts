import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { ContactDetails } from "../../models/appconfig/appconfig.interface";
import { appConfigService } from "./appConfig.service";

export class AppConfigController {
  getBranding = (_req: Request, res: Response) => {
    const { appName, appLogo } = appConfigService.getAppConfig();

    return res.status(200).json({
      success: true,
      message: "Branding retrieved",
      data: { appName, appLogo },
    } satisfies ApiResponseDto<{ appName: string; appLogo: string | null }>);
  };

  getContact = (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: "Contact details retrieved",
      data: appConfigService.getContact(),
    } satisfies ApiResponseDto<ContactDetails>);
  };
}
