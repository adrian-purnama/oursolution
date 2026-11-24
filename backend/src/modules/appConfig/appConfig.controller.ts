import type { Request, Response } from "express";
import type { ContactDetails } from "../../models/appconfig/appconfig.interface";
import { appConfigService } from "./appConfig.service";
import { ok } from "../../utils/respond";

export class AppConfigController {
  getBranding = (_req: Request, res: Response) => {
    const { appName, appLogo } = appConfigService.getAppConfig();

    return ok<{ appName: string; appLogo: string | null }>(
      res,
      "Branding retrieved",
      { appName, appLogo },
    );
  };

  getContact = (_req: Request, res: Response) => {
    return ok<ContactDetails>(
      res,
      "Contact details retrieved",
      appConfigService.getContact(),
    );
  };
}
