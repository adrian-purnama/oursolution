import type { Request, Response } from "express";
import type { DokployProjectOutDto } from "../../dto/dokploy.dto";
import { dokployService } from "./dokploy.service";
import { fail, ok } from "../../utils/respond";

export class DokployController {
  /** The projects on the Dokploy server, for choosing where a product deploys. */
  listProjects = async (_req: Request, res: Response) => {
    try {
      const data = await dokployService.listProjects();
      return ok<DokployProjectOutDto[]>(
        res,
        "Dokploy projects retrieved",
        data,
      );
    } catch (error) {
      return fail(res, error, "Failed to list Dokploy projects");
    }
  };
}
