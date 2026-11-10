import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { AppConfigService } from "./appConfig.service";
import { UserModel } from "../../models/user/user.model";
import { AppConfigModel } from "../../models/appconfig/appconfig.model";

describe("AppConfigService.init firstRegister", () => {
  it("sets firstRegister false when an admin exists", async () => {
    mock.method(UserModel, "findOne", async () => ({
      role: "admin",
    }));
    mock.method(AppConfigModel, "findOne", async () => ({
      appName: "Test",
      openLogin: true,
      openRegister: true,
      appLogo: null,
      adminRegistered: true,
    }));

    const service = new AppConfigService();
    await service.init();
    assert.equal(service.firstRegister, false);
  });
});
