import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { AdminService } from "./admin.service";
import { UserModel } from "../../models/user/user.model";

const ID = "507f1f77bcf86cd799439011";

type FakeUser = {
  id: string;
  email: string;
  isBlocked: boolean;
  role: string;
  hashedPassword: string;
  tokenVersion?: number;
  save: () => Promise<void>;
};

function fakeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: "u1",
    email: "a@b.com",
    isBlocked: false,
    role: "admin",
    hashedPassword: "x",
    save: async () => {},
    ...overrides,
  };
}

function mockUser(user: FakeUser, activeAdmins: number) {
  mock.method(UserModel, "findById", async () => user);
  mock.method(UserModel, "countDocuments", () => ({
    exec: async () => activeAdmins,
  }));
}

describe("AdminService.updateUser", () => {
  afterEach(() => mock.restoreAll());

  it("refuses to block the last active admin", async () => {
    mockUser(fakeUser(), 1);
    await assert.rejects(
      () => new AdminService().updateUser(ID, { isBlocked: true }),
      /last admin/,
    );
  });

  it("refuses to demote the last active admin", async () => {
    mockUser(fakeUser(), 1);
    await assert.rejects(
      () => new AdminService().updateUser(ID, { role: "user" }),
      /last admin/,
    );
  });

  it("demotes an admin when another active admin remains", async () => {
    const user = fakeUser();
    mockUser(user, 2);
    const out = await new AdminService().updateUser(ID, { role: "user" });
    assert.equal(out.role, "user");
    assert.equal(user.role, "user");
  });

  it("promotes a user without counting admins", async () => {
    const user = fakeUser({ role: "user" });
    mockUser(user, 0);
    const out = await new AdminService().updateUser(ID, { role: "admin" });
    assert.equal(out.role, "admin");
  });

  it("signs the user out when blocking or changing the password", async () => {
    const blocked = fakeUser({ role: "user", tokenVersion: 2 });
    mockUser(blocked, 1);
    await new AdminService().updateUser(ID, { isBlocked: true });
    assert.equal(blocked.tokenVersion, 3);

    const changed = fakeUser({ role: "user" });
    mockUser(changed, 1);
    await new AdminService().updateUser(ID, { password: "a-new-password" });
    assert.equal(changed.tokenVersion, 1);
  });
});

describe("AdminService.createUser", () => {
  afterEach(() => mock.restoreAll());

  it("stores a hashed password and the chosen role", async () => {
    const created: Record<string, unknown>[] = [];
    mock.method(UserModel, "create", async (doc: Record<string, unknown>) => {
      created.push(doc);
      return { id: "u2", isBlocked: false, ...doc };
    });
    const out = await new AdminService().createUser({
      email: "new@b.com",
      password: "password123",
      role: "user",
    });
    assert.deepEqual(out, {
      id: "u2",
      email: "new@b.com",
      isBlocked: false,
      role: "user",
    });
    assert.notEqual(created[0]?.hashedPassword, "password123");
  });

  it("reports an email that is already taken", async () => {
    mock.method(UserModel, "create", async () => {
      throw Object.assign(new Error("dup"), { code: 11000 });
    });
    await assert.rejects(
      new AdminService().createUser({
        email: "a@b.com",
        password: "password123",
        role: "user",
      }),
      /Email already registered/,
    );
  });
});
