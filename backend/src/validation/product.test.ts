import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCreateProductDto, parseUpdateProductDto } from "./product";

const base = { name: "n8n", color: "#1a5c4a", priceIdr: 1000 };

describe("parseCreateProductDto", () => {
  it("defaults to a subscription with a 30-day duration and no link", () => {
    const dto = parseCreateProductDto({
      ...base,
      accessUrl: "https://example.com/x",
    });
    assert.equal(dto.kind, "subscription");
    assert.equal(dto.durationDays, 30);
    assert.equal(dto.accessUrl, null);
  });

  it("gives a one-time product a link and no duration", () => {
    const dto = parseCreateProductDto({
      ...base,
      kind: "oneTime",
      durationDays: 30,
      accessUrl: "https://example.com/workflow",
    });
    assert.equal(dto.durationDays, null);
    assert.equal(dto.accessUrl, "https://example.com/workflow");
  });

  it("rejects an unknown kind and a link that is not http(s)", () => {
    assert.throws(() => parseCreateProductDto({ ...base, kind: "link" }));
    assert.throws(() =>
      parseCreateProductDto({
        ...base,
        kind: "oneTime",
        accessUrl: "javascript:alert(1)",
      }),
    );
  });
});

describe("product description", () => {
  it("defaults to empty and keeps line breaks, trimming the ends", () => {
    assert.equal(parseCreateProductDto(base).description, "");
    const dto = parseCreateProductDto({
      ...base,
      description: "  Line one\n\nLine two  ",
    });
    assert.equal(dto.description, "Line one\n\nLine two");
  });

  it("rejects non-text and text over 4000 characters", () => {
    assert.throws(() => parseCreateProductDto({ ...base, description: 5 }));
    assert.throws(
      () => parseCreateProductDto({ ...base, description: "x".repeat(4001) }),
      /4000/,
    );
    assert.equal(
      parseCreateProductDto({ ...base, description: "x".repeat(4000) })
        .description.length,
      4000,
    );
  });

  it("can be updated on its own", () => {
    const patch = parseUpdateProductDto({ description: "New text" }, "oneTime");
    assert.deepEqual(patch, { description: "New text" });
  });
});

describe("parseUpdateProductDto", () => {
  it("refuses to change the kind", () => {
    assert.throws(
      () => parseUpdateProductDto({ kind: "oneTime" }, "subscription"),
      /cannot be changed/,
    );
  });

  it("ignores fields that do not apply to the kind", () => {
    const patch = parseUpdateProductDto(
      { name: "x", durationDays: 7, accessUrl: "https://example.com" },
      "oneTime",
    );
    assert.equal(patch.durationDays, undefined);
    assert.equal(patch.accessUrl, "https://example.com/");
  });
});

describe("product deployment", () => {
  const deployment = {
    type: "dockerCompose",
    composeFile: "services:\n      app:\n          image: nginx\n",
    projectId: "prj_123",
    name: "app-${USERNAME}",
  };

  it("stores a subscription's project and re-indented compose file", () => {
    const dto = parseCreateProductDto({ ...base, deployment });
    assert.deepEqual(dto.deployment, {
      type: "dockerCompose",
      projectId: "prj_123",
      name: "app-${USERNAME}",
      composeFile: "services:\n  app:\n    image: nginx\n",
      variables: [],
      domains: [],
      commands: [],
    });
  });

  it("keeps commands, giving new ones an id", () => {
    const dto = parseCreateProductDto({
      ...base,
      deployment: {
        ...deployment,
        commands: [
          {
            id: "keep-me",
            label: " Reset owner ",
            serviceName: "app",
            command: " n8n user-management:reset ",
          },
          { label: "Version", serviceName: "app", command: "n8n --version" },
        ],
      },
    });
    const [kept, added] = dto.deployment?.commands ?? [];
    assert.deepEqual(kept, {
      id: "keep-me",
      label: "Reset owner",
      serviceName: "app",
      command: "n8n user-management:reset",
    });
    assert.match(added.id, /^[0-9a-f]{12}$/);
  });

  it("rejects a command in a service the compose file lacks", () => {
    assert.throws(
      () =>
        parseCreateProductDto({
          ...base,
          deployment: {
            ...deployment,
            commands: [{ label: "X", serviceName: "db", command: "ls" }],
          },
        }),
      /not in the compose file/,
    );
  });

  it("rejects a command on more than one line", () => {
    assert.throws(
      () =>
        parseCreateProductDto({
          ...base,
          deployment: {
            ...deployment,
            commands: [{ label: "X", serviceName: "app", command: "ls\nrm" }],
          },
        }),
      /one line/,
    );
  });

  it("defaults to no deployment and never gives one to a one-time product", () => {
    assert.equal(parseCreateProductDto(base).deployment, null);
    assert.equal(
      parseCreateProductDto({ ...base, kind: "oneTime", deployment })
        .deployment,
      null,
    );
  });

  it("rejects a broken compose file, saying where", () => {
    assert.throws(
      () =>
        parseUpdateProductDto(
          {
            deployment: {
              ...deployment,
              composeFile: "services:\n  app:\n    restart: always\n",
            },
          },
          "subscription",
        ),
      /Compose file line 2: .*no `image`/,
    );
  });

  it("requires a Dokploy project", () => {
    assert.throws(
      () =>
        parseCreateProductDto({
          ...base,
          deployment: { ...deployment, projectId: "" },
        }),
      /Choose the Dokploy project/,
    );
  });

  it("keeps variables and domains, and rejects a name shared by everyone", () => {
    const dto = parseCreateProductDto({
      ...base,
      deployment: {
        ...deployment,
        composeFile: "services:\n  app:\n    image: nginx:${TAG}\n",
        variables: [{ key: "TAG", value: "1.27", visibility: "editable" }],
        domains: [
          {
            serviceName: "app",
            subdomain: "app-${USERNAME}",
            port: "80",
          },
        ],
      },
    });
    assert.deepEqual(dto.deployment?.domains, [
      { serviceName: "app", subdomain: "app-${USERNAME}", port: 80 },
    ]);
    assert.equal(dto.deployment?.variables[0].visibility, "editable");
    assert.throws(
      () =>
        parseCreateProductDto({
          ...base,
          deployment: { ...deployment, name: "app" },
        }),
      /same for every customer/,
    );
  });

  it("clears the deployment with null", () => {
    const patch = parseUpdateProductDto({ deployment: null }, "subscription");
    assert.equal(patch.deployment, null);
  });
});

describe("product notices", () => {
  it("defaults to none and keeps order, trimming text", () => {
    assert.deepEqual(parseCreateProductDto(base).notices, []);
    const dto = parseCreateProductDto({
      ...base,
      notices: [
        { tone: "warning", text: "  A lost password cannot be recovered " },
        { tone: "info", text: "[Contact us](https://example.com/contact)" },
      ],
    });
    assert.deepEqual(dto.notices, [
      { tone: "warning", text: "A lost password cannot be recovered" },
      { tone: "info", text: "[Contact us](https://example.com/contact)" },
    ]);
  });

  it("rejects an unknown tone, empty text and a non-list", () => {
    assert.throws(() =>
      parseCreateProductDto({ ...base, notices: [{ tone: "x", text: "a" }] }),
    );
    assert.throws(() =>
      parseCreateProductDto({
        ...base,
        notices: [{ tone: "info", text: " " }],
      }),
    );
    assert.throws(() => parseCreateProductDto({ ...base, notices: "a" }));
  });

  it("can be cleared on update", () => {
    assert.deepEqual(
      parseUpdateProductDto({ notices: [] }, "subscription").notices,
      [],
    );
  });
});

describe("variants", () => {
  const big = { name: "4 cores", priceIdr: 100_000, durationDays: 30 };

  it("gives a new variant an id and keeps one it already has", () => {
    const dto = parseCreateProductDto({
      ...base,
      variantName: " 2 cores ",
      variants: [big, { ...big, id: "keep-me", name: "8 cores" }],
    });
    assert.equal(dto.variantName, "2 cores");
    assert.match(dto.variants[0].id, /^[0-9a-f]{12}$/);
    assert.equal(dto.variants[0].composeFile, null);
    assert.equal(dto.variants[1].id, "keep-me");
  });

  it("drops variants from a one-time product", () => {
    const dto = parseCreateProductDto({
      ...base,
      kind: "oneTime",
      variants: [big],
    });
    assert.deepEqual(dto.variants, []);
  });

  it("rejects a variant without a name, price or duration", () => {
    for (const bad of [
      { ...big, name: "" },
      { ...big, priceIdr: -1 },
      { ...big, durationDays: 0 },
      { ...big, id: "has space" },
    ]) {
      assert.throws(() => parseCreateProductDto({ ...base, variants: [bad] }));
    }
  });

  it("updates variants of a subscription only", () => {
    assert.equal(
      parseUpdateProductDto({ variants: [big] }, "subscription").variants
        ?.length,
      1,
    );
    assert.throws(
      () => parseUpdateProductDto({ variants: [big] }, "oneTime"),
      /No valid fields/,
    );
  });
});
