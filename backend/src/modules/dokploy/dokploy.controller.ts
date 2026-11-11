import type { Request, Response } from "express";
import { ApiResponseDto } from "../../dto/apiResponse.dto";
import type { DokployProjectOutDto } from "../../dto/dokploy.dto";
import { dokployService } from "./dokploy.service";

export class DokployController {
  /** The projects on the Dokploy server, for choosing where a product deploys. */
  listProjects = async (_req: Request, res: Response) => {
    try {
      const data = await dokployService.listProjects();
      return res.status(200).json({
        success: true,
        message: "Dokploy projects retrieved",
        data,
      } satisfies ApiResponseDto<DokployProjectOutDto[]>);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to list Dokploy projects",
        data: null,
      } satisfies ApiResponseDto);
    }
  };
}
