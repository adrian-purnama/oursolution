import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { AppConfigService } from "./appConfig.service";
import { UserModel } from "../../models/user/user.model";
import { AppConfigModel } from "../../models/appconfig/appconfig.model";

afterEach(() => mock.restoreAll());

/** A real (unsaved) document, as findOne returns one. */
function storedConfig(fields: Record<string, unknown> = {}) {
  return new AppConfigModel({
    appName: "Test",
    openLogin: true,
    openRegister: true,
    adminRegistered: true,
    ...fields,
  });
}

describe("AppConfigService.init", () => {
  it("sets firstRegister false when an admin exists", async () => {
    mock.method(UserModel, "findOne", async () => ({ role: "admin" }));
    mock.method(AppConfigModel, "findOne", async () => storedConfig());

    const service = new AppConfigService();
    await service.init();
    assert.equal(service.firstRegister, false);
  });

  it("loads the saved contact details", async () => {
    mock.method(UserModel, "findOne", async () => ({ role: "admin" }));
    mock.method(AppConfigModel, "findOne", async () =>
      storedConfig({
        contact: { email: "hello@example.com", whatsapp: "6281234567890" },
      }),
    );

    const service = new AppConfigService();
    await service.init();
    assert.deepEqual(service.getContact(), {
      email: "hello@example.com",
      phone: "",
      whatsapp: "6281234567890",
      address: "",
      hours: "",
      mapUrl: "",
    });
  });
});
