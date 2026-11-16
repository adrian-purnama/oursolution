import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import * as bcrypt from "bcrypt";
import { UserModel } from "../../models/user/user.model";
import { googleOAuth } from "../../utils/googleOAuth";
import { verifyAccessToken } from "../../utils/jwt";
import { appConfigService } from "../appConfig/appConfig.service";
import { mailer } from "../mail/mail.service";
import { OtpService } from "../otp/otp.service";
import { AuthService } from "./auth.service";

const PASSWORD = "correct-horse-battery";
const HASH = bcrypt.hashSync(PASSWORD, 4);

function otpStub(valid = true): OtpService {
  return {
    issue: async () => "123456",
    validateAndConsume: async () => valid,
  } as unknown as OtpService;
}

function resetConfig() {
  appConfigService.openLogin = true;
  appConfigService.openRegister = true;
  appConfigService.firstRegister = false;
}

describe("AuthService.login", () => {
  afterEach(() => {
    mock.restoreAll();
    resetConfig();
  });

  it("gives the same error for an unknown email and a wrong password", async () => {
    const service = new AuthService(otpStub());
    mock.method(UserModel, "findOne", async () => null);
    await assert.rejects(
      () => service.login({ email: "x@b.com", password: PASSWORD }),
      /Invalid email or password/,
    );
    mock.method(UserModel, "findOne", async () => ({
      id: "u1",
      email: "a@b.com",
      hashedPassword: HASH,
    }));
    await assert.rejects(
      () => service.login({ email: "a@b.com", password: "wrong-password" }),
      /Invalid email or password/,
    );
  });

  it("refuses blocked users", async () => {
    mock.method(UserModel, "findOne", async () => ({
      id: "u1",
      email: "a@b.com",
      hashedPassword: HASH,
      isBlocked: true,
    }));
    await assert.rejects(
      () =>
        new AuthService(otpStub()).login({
          email: "a@b.com",
          password: PASSWORD,
        }),
      /blocked/,
    );
  });

  it("keeps ordinary users out while login is closed", async () => {
    appConfigService.openLogin = false;
    mock.method(UserModel, "findOne", async () => ({
      id: "u2",
      email: "a@b.com",
      hashedPassword: HASH,
      role: "user",
    }));
    await assert.rejects(
      () =>
        new AuthService(otpStub()).login({
          email: "a@b.com",
          password: PASSWORD,
        }),
      /Login is closed/,
    );
  });

  it("still lets an admin in while login is closed", async () => {
    appConfigService.openLogin = false;
    mock.method(UserModel, "findOne", async () => ({
      id: "u3",
      email: "root@b.com",
      hashedPassword: HASH,
      role: "admin",
      tokenVersion: 4,
    }));
    const out = await new AuthService(otpStub()).login({
      email: "root@b.com",
      password: PASSWORD,
    });
    assert.equal(verifyAccessToken(out.jwt).tokenVersion, 4);
  });
});

describe("AuthService.register", () => {
  afterEach(() => {
    mock.restoreAll();
    resetConfig();
  });

  it("rejects short passwords before touching the OTP", async () => {
    const otp = otpStub();
    const consume = mock.method(otp, "validateAndConsume", async () => true);
    await assert.rejects(
      () =>
        new AuthService(otp).register({
          email: "a@b.com",
          otp: "123456",
          password: "short",
        }),
      /at least 8/,
    );
    assert.equal(consume.mock.callCount(), 0);
  });

  it("makes only the claim winner an admin", async () => {
    const created: Array<{ role: string }> = [];
    mock.method(UserModel, "create", async (doc: { role: string }) => {
      created.push(doc);
      return { id: "u1", email: "a@b.com", tokenVersion: 0 };
    });
    let claims = 0;
    mock.method(appConfigService, "claimFirstAdmin", async () => {
      appConfigService.firstRegister = false;
      return claims++ === 0;
    });

    const service = new AuthService(otpStub());
    const input = { email: "a@b.com", otp: "123456", password: PASSWORD };

    appConfigService.firstRegister = true;
    await service.register(input);
    // A second instance that has not noticed yet still believes it is first.
    appConfigService.firstRegister = true;
    await service.register(input);

    assert.equal(created[0]?.role, "admin");
    assert.equal(created[1]?.role, "user");
  });

  it("releases the admin slot when creating the user fails", async () => {
    appConfigService.firstRegister = true;
    mock.method(appConfigService, "claimFirstAdmin", async () => true);
    const release = mock.method(
      appConfigService,
      "releaseFirstAdmin",
      async () => {},
    );
    mock.method(UserModel, "create", async () => {
      throw Object.assign(new Error("dup"), { code: 11000 });
    });

    await assert.rejects(
      () =>
        new AuthService(otpStub()).register({
          email: "a@b.com",
          otp: "123456",
          password: PASSWORD,
        }),
      /Email already registered/,
    );
    assert.equal(release.mock.callCount(), 1);
  });
});

describe("AuthService.sendOtp", () => {
  afterEach(() => {
    mock.restoreAll();
    resetConfig();
  });

  it("reports success without mailing when the reset email is unknown", async () => {
    mock.method(UserModel, "findOne", async () => null);
    const sendReset = mock.method(
      mailer,
      "sendResetPasswordLink",
      async () => true,
    );
    const ok = await new AuthService(otpStub()).sendOtp({
      email: "nobody@b.com",
      isResetPassword: true,
    });
    assert.equal(ok, true);
    assert.equal(sendReset.mock.callCount(), 0);
  });

  it("reports success without mailing when a register email is taken", async () => {
    mock.method(UserModel, "findOne", async () => ({ id: "u1" }));
    const sendOtp = mock.method(mailer, "sendOtp", async () => true);
    const ok = await new AuthService(otpStub()).sendOtp({
      email: "taken@b.com",
      isResetPassword: false,
    });
    assert.equal(ok, true);
    assert.equal(sendOtp.mock.callCount(), 0);
  });
});

describe("AuthService.resetPassword", () => {
  afterEach(() => mock.restoreAll());

  it("bumps tokenVersion so old sessions stop working", async () => {
    let update: Record<string, unknown> = {};
    mock.method(
      UserModel,
      "updateOne",
      async (_filter: unknown, change: Record<string, unknown>) => {
        update = change;
        return { matchedCount: 1 };
      },
    );
    await new AuthService(otpStub()).resetPassword({
      email: "a@b.com",
      otp: "123456",
      password: PASSWORD,
    });
    assert.deepEqual(update.$inc, { tokenVersion: 1 });
  });

  it("rejects a wrong OTP", async () => {
    await assert.rejects(
      () =>
        new AuthService(otpStub(false)).resetPassword({
          email: "a@b.com",
          otp: "000000",
          password: PASSWORD,
        }),
      /Invalid or expired OTP/,
    );
  });
});

describe("AuthService.googleSignIn", () => {
  afterEach(() => {
    mock.restoreAll();
    resetConfig();
  });

  const profile = { googleId: "g-1", email: "a@b.com" };

  it("signs in the account the Google account is linked to", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => ({
      id: "u1",
      email: "other@b.com",
      googleId: "g-1",
      tokenVersion: 2,
    }));
    const out = await new AuthService(otpStub()).googleSignIn({ code: "c" });
    assert.equal(out.email, "other@b.com");
    assert.equal(verifyAccessToken(out.jwt).userId, "u1");
  });

  it("refuses an email that already has an unlinked account", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async (filter: { email?: string }) =>
      filter.email ? { id: "u1", email: "a@b.com" } : null,
    );
    const create = mock.method(UserModel, "create", async () => ({}));
    await assert.rejects(
      () => new AuthService(otpStub()).googleSignIn({ code: "c" }),
      /link Google from your profile/,
    );
    assert.equal(create.mock.callCount(), 0);
  });

  it("registers a new email already linked to Google", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => null);
    let created: Record<string, unknown> = {};
    mock.method(UserModel, "create", async (doc: Record<string, unknown>) => {
      created = doc;
      return { id: "u9", email: "a@b.com", tokenVersion: 0 };
    });
    const out = await new AuthService(otpStub()).googleSignIn({ code: "c" });
    assert.deepEqual(created, {
      email: "a@b.com",
      googleId: "g-1",
      role: "user",
    });
    assert.equal(verifyAccessToken(out.jwt).userId, "u9");
  });

  it("does not register while registration is closed", async () => {
    appConfigService.openRegister = false;
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => null);
    await assert.rejects(
      () => new AuthService(otpStub()).googleSignIn({ code: "c" }),
      /Registration is closed/,
    );
  });

  it("refuses blocked users", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => ({
      id: "u1",
      email: "a@b.com",
      googleId: "g-1",
      isBlocked: true,
    }));
    await assert.rejects(
      () => new AuthService(otpStub()).googleSignIn({ code: "c" }),
      /blocked/,
    );
  });
});

describe("AuthService.linkGoogle", () => {
  afterEach(() => mock.restoreAll());

  const profile = { googleId: "g-1", email: "a@b.com" };

  it("refuses a Google account that belongs to someone else", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => ({ id: "other" }));
    const update = mock.method(UserModel, "updateOne", async () => ({}));
    await assert.rejects(
      () => new AuthService(otpStub()).linkGoogle("u1", "c"),
      /linked to another account/,
    );
    assert.equal(update.mock.callCount(), 0);
  });

  it("stores the Google id on the signed-in user", async () => {
    mock.method(googleOAuth, "exchangeCode", async () => profile);
    mock.method(UserModel, "findOne", async () => null);
    let change: unknown;
    mock.method(
      UserModel,
      "updateOne",
      async (_filter: unknown, update: unknown) => {
        change = update;
        return { matchedCount: 1 };
      },
    );
    await new AuthService(otpStub()).linkGoogle("u1", "c");
    assert.deepEqual(change, { $set: { googleId: "g-1" } });
  });
});
