import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOverrides,
  checkDeployment,
  composeFileOf,
  diffOverrides,
  fingerprintOf,
  updateStatusOf,
  overridesProblem,
  missingValues,
  renderTemplate,
  resolveDeployment,
  scanTemplate,
  toEnvFile,
  usernameFromEmail,
  type DeploymentDraft,
} from "./deployment";

const COMPOSE = `services:
  n8n:
    image: n8nio/n8n:1.70.0
    environment:
      - N8N_HOST=\${N8N_HOST}
      - TZ=\${TIMEZONE}
      - OWNER=\${OWNER}
    volumes:
      - /mnt/nas-sda/n8n/\${USERNAME}:/home/node/.n8n
`;

const GOOD: DeploymentDraft = {
  name: "n8n-${USERNAME}",
  composeFile: COMPOSE,
  variables: [
    {
      key: "N8N_HOST",
      value: "n8n-${USERNAME}.${DOMAIN}",
      visibility: "hidden",
    },
    { key: "TIMEZONE", value: "Asia/Jakarta", visibility: "editable" },
    { key: "OWNER", value: "${EMAIL}", visibility: "readOnly" },
  ],
  domains: [{ serviceName: "n8n", subdomain: "n8n-${USERNAME}", port: 5678 }],
};

const messages = (draft: DeploymentDraft) =>
  checkDeployment(draft)
    .issues.map((issue) => issue.message)
    .join("\n");

describe("usernameFromEmail", () => {
  it("keeps lowercase letters and digits from before the @", () => {
    assert.equal(
      usernameFromEmail("Buhari.Muslim_526+x@gmail.com"),
      "buharimuslim526x",
    );
    assert.equal(usernameFromEmail("..@example.com"), "user");
    // Room is left for a suffix that tells two customers apart.
    assert.equal(usernameFromEmail(`${"a".repeat(40)}@x.com`).length, 28);
  });
});

describe("templates", () => {
  it("renders ${NAME} and $$, and rejects a stray $", () => {
    assert.equal(
      renderTemplate("a-${USERNAME}-$$", { USERNAME: "jo" }),
      "a-jo-$",
    );
    assert.deepEqual(scanTemplate("${A}x${B}").references, ["A", "B"]);
    assert.ok(scanTemplate("n8n-$USERNAME").error);
    assert.ok(scanTemplate("n8n-${USERNAME").error);
  });
});

describe("checkDeployment", () => {
  it("accepts a sound deployment and previews it for a sample customer", () => {
    const result = checkDeployment(GOOD, "amfphub.com");
    assert.deepEqual(result.issues, []);
    assert.equal(result.valid, true);
    assert.deepEqual(result.preview, {
      username: "janedoe42",
      domain: "amfphub.com",
      name: "n8n-janedoe42",
      hosts: ["n8n-janedoe42.amfphub.com"],
    });
  });

  it("rejects a volume the customer could point anywhere", () => {
    const draft: DeploymentDraft = {
      ...GOOD,
      composeFile: COMPOSE.replace(
        "/mnt/nas-sda/n8n/\${USERNAME}",
        "\${TIMEZONE}",
      ),
    };
    assert.match(messages(draft), /could mount any folder of the server/);
    assert.equal(checkDeployment(draft).valid, false);
  });

  it("rejects a volume or a name a set-once variable decides", () => {
    const variables: DeploymentDraft["variables"] = [
      ...GOOD.variables,
      { key: "SPACE", value: "", visibility: "setOnce" },
    ];
    const mounted: DeploymentDraft = {
      ...GOOD,
      variables,
      composeFile: COMPOSE.replace("${USERNAME}:", "${SPACE}:"),
    };
    assert.match(messages(mounted), /could mount any folder of the server/);
    const named: DeploymentDraft = {
      ...GOOD,
      variables,
      composeFile: COMPOSE.replace("TZ=", "SPACE=${SPACE}\n      - TZ="),
      name: "n8n-${SPACE}-${USERNAME}",
    };
    assert.match(
      messages(named),
      /The name uses \$\{SPACE\}, which the customer sets/,
    );
  });

  it("lets the name use a variable the customer cannot edit", () => {
    const result = checkDeployment({
      ...GOOD,
      name: "${APP}",
      composeFile: `${COMPOSE}    labels:\n      - app=\${APP}\n`,
      variables: [
        ...GOOD.variables,
        { key: "APP", value: "n8n-${USERNAME}", visibility: "hidden" },
      ],
    });
    assert.equal(result.preview.name, "n8n-janedoe42");
  });

  it("requires a per-customer name and subdomain", () => {
    const text = messages({
      ...GOOD,
      name: "n8n",
      domains: [{ ...GOOD.domains[0], subdomain: "n8n" }],
    });
    assert.match(text, /The name is the same for every customer/);
    assert.match(text, /Domain 1 subdomain is the same for every customer/);
  });

  it("refuses a name built from a variable the customer can edit", () => {
    assert.match(
      messages({ ...GOOD, name: "n8n-${TIMEZONE}-${USERNAME}" }),
      /TIMEZONE\}, which the customer sets/,
    );
  });

  it("checks what the name and subdomain become", () => {
    assert.match(
      messages({ ...GOOD, name: "N8N-${USERNAME}" }),
      /lowercase letters/,
    );
    assert.match(
      messages({ ...GOOD, name: `${"n".repeat(40)}-\${USERNAME}` }),
      /Keep it to 63/,
    );
    assert.match(
      messages({
        ...GOOD,
        domains: [{ ...GOOD.domains[0], subdomain: "n8n.${USERNAME}" }],
      }),
      /one part without dots/,
    );
  });

  it("finds undefined, misnamed, built-in and unused variables", () => {
    const text = messages({
      ...GOOD,
      variables: [
        { key: "USERNAME", value: "x", visibility: "hidden" },
        { key: "1BAD", value: "", visibility: "hidden" },
        { key: "UNUSED", value: "${N8N_HOST}", visibility: "hidden" },
        { key: "TIMEZONE", value: "UTC", visibility: "editable" },
        { key: "TIMEZONE", value: "UTC", visibility: "editable" },
      ],
    });
    assert.match(text, /\$\{N8N_HOST\}, which is not defined/);
    assert.match(text, /\$\{OWNER\}, which is not defined/);
    assert.match(text, /"USERNAME" is built in/);
    assert.match(text, /cannot start with a digit/);
    assert.match(text, /"UNUSED": a value can only use the built-in variables/);
    assert.match(text, /"UNUSED" is not used in the compose file/);
    assert.match(text, /"TIMEZONE" is defined twice/);
  });

  it("checks each domain's service and port", () => {
    const text = messages({
      ...GOOD,
      domains: [
        { serviceName: "web", subdomain: "a-${USERNAME}", port: 0 },
        { serviceName: "", subdomain: "", port: Number.NaN },
      ],
    });
    assert.match(text, /service "web", which is not in the compose file/);
    assert.match(text, /Domain 1: the container port/);
    assert.match(text, /Domain 2: choose the service/);
    assert.match(text, /Domain 2 has no subdomain/);
  });

  it("points each settings issue at its field", () => {
    const { issues } = checkDeployment({
      ...GOOD,
      name: "",
      variables: [
        ...GOOD.variables,
        { key: "CONTAINERNAME", value: "USER_ID", visibility: "hidden" },
      ],
      domains: [{ ...GOOD.domains[0], port: 0 }],
    });
    const fieldOf = (pattern: RegExp) =>
      issues.find((issue) => pattern.test(issue.message))?.field;
    assert.equal(fieldOf(/Give the deployment a name/), "name");
    assert.equal(fieldOf(/plain text "USER_ID"/), "variables.3");
    assert.equal(fieldOf(/container port/), "domains.0");
  });
});

describe("resolveDeployment", () => {
  const builtIns = {
    USERNAME: "buharimuslim526",
    EMAIL: "buhari@example.com",
    USER_ID: "u1",
    DOMAIN: "amfphub.com",
  };

  it("fills names, hosts and env, taking customer values literally", () => {
    const resolved = resolveDeployment(GOOD, builtIns, {
      TIMEZONE: "UTC $HOME",
      N8N_HOST: "ignored: not editable",
    });
    assert.equal(resolved.name, "n8n-buharimuslim526");
    assert.deepEqual(resolved.domains, [
      {
        serviceName: "n8n",
        host: "n8n-buharimuslim526.amfphub.com",
        port: 5678,
      },
    ]);
    assert.equal(resolved.env.N8N_HOST, "n8n-buharimuslim526.amfphub.com");
    assert.equal(resolved.env.TIMEZONE, "UTC $HOME");
    assert.equal(resolved.env.OWNER, "buhari@example.com");
    assert.equal(resolved.env.USERNAME, "buharimuslim526");
  });

  it("falls back to the product default for an editable variable", () => {
    assert.equal(
      resolveDeployment(GOOD, builtIns, {}).env.TIMEZONE,
      "Asia/Jakarta",
    );
  });

  it("leaves a set-once variable empty until the customer fills it", () => {
    const draft: DeploymentDraft = {
      ...GOOD,
      variables: [
        ...GOOD.variables,
        {
          key: "ADMIN_PASSWORD",
          value: "example",
          visibility: "setOnceHidden",
        },
        { key: "ADMIN_NAME", value: "", visibility: "setOnce" },
      ],
    };
    assert.equal(resolveDeployment(draft, builtIns, {}).env.ADMIN_PASSWORD, "");
    assert.deepEqual(missingValues(draft.variables, {}), [
      "ADMIN_PASSWORD",
      "ADMIN_NAME",
    ]);
    const values = { ADMIN_PASSWORD: "s3cret", ADMIN_NAME: "  " };
    assert.equal(
      resolveDeployment(draft, builtIns, values).env.ADMIN_PASSWORD,
      "s3cret",
    );
    assert.deepEqual(missingValues(draft.variables, values), ["ADMIN_NAME"]);
  });
});

describe("toEnvFile", () => {
  it("quotes values so Compose reads them back unchanged", () => {
    assert.equal(
      toEnvFile({ A: "plain-1.2", B: "has $dollar and space", C: `it's $5` }),
      `A=plain-1.2\nB='has $dollar and space'\nC="it's $$5"\n`,
    );
  });
});

describe("overrides", () => {
  const builtIns = {
    USERNAME: "jane",
    EMAIL: "jane@example.com",
    USER_ID: "u1",
    DOMAIN: "example.com",
  };
  const resolved = {
    name: "n8n-jane",
    env: { ...builtIns, DB_NAME: "jane", TZ: "UTC" },
    domains: [{ serviceName: "n8n", host: "jane.example.com", port: 5678 }],
  };

  it("puts env overrides on top, filling built-ins, and keeps the rest", () => {
    const out = applyOverrides(
      resolved,
      { env: [{ key: "DB_NAME", value: "${USERNAME}_old" }], composeFile: null },
      builtIns,
    );
    assert.equal(out.env.DB_NAME, "jane_old");
    assert.equal(out.env.TZ, "UTC");
    assert.deepEqual(out.domains, resolved.domains);
    assert.equal(out.name, resolved.name);
    assert.equal(applyOverrides(resolved, null, builtIns), resolved);
  });

  it("uses the replacement compose file only when there is one", () => {
    assert.equal(composeFileOf(null, "base"), "base");
    assert.equal(composeFileOf({ env: [], composeFile: null }, "base"), "base");
    assert.equal(composeFileOf({ env: [], composeFile: "mine" }, "base"), "mine");
  });

  it("lists each set, changed and reset override", () => {
    const changes = diffOverrides(
      {
        env: [
          { key: "A", value: "1" },
          { key: "B", value: "2" },
        ],
        composeFile: null,
      },
      {
        env: [
          { key: "B", value: "3" },
          { key: "C", value: "4" },
        ],
        composeFile: "services: {}",
      },
    );
    assert.deepEqual(changes, [
      { target: "env", key: "A", before: "1", after: null },
      { target: "env", key: "B", before: "2", after: "3" },
      { target: "env", key: "C", before: null, after: "4" },
      { target: "compose", key: null, before: null, after: "services: {}" },
    ]);
    assert.deepEqual(
      diffOverrides(
        { env: [{ key: "A", value: "1" }], composeFile: "x" },
        { env: [{ key: "A", value: "1" }], composeFile: "x" },
      ),
      [],
    );
  });

  it("refuses bad keys, built-ins, duplicates and stray dollars", () => {
    const one = (key: string, value = "v") =>
      overridesProblem({ env: [{ key, value }], composeFile: null });
    assert.equal(one("DB_NAME"), null);
    assert.match(one("1BAD") ?? "", /not a variable name/);
    assert.match(one("USERNAME") ?? "", /set by the app/);
    assert.match(one("A", "pa$s") ?? "", /dollar/);
    assert.match(
      overridesProblem({
        env: [
          { key: "A", value: "1" },
          { key: "A", value: "2" },
        ],
        composeFile: null,
      }) ?? "",
      /twice/,
    );
    assert.match(
      overridesProblem({ env: [], composeFile: "  " }) ?? "",
      /empty/,
    );
  });
});

describe("updateStatusOf", () => {
  const v21 = fingerprintOf("services: v21", "A=1");

  it("is current when the same compose and env would be sent", () => {
    assert.deepEqual(
      updateStatusOf(v21, fingerprintOf("services: v21", "A=1")),
      { status: "current" },
    );
  });

  it("says which part changed", () => {
    assert.deepEqual(
      updateStatusOf(v21, fingerprintOf("services: v22", "A=1")),
      { status: "available", compose: true, env: false },
    );
    assert.deepEqual(
      updateStatusOf(v21, fingerprintOf("services: v21", "A=2")),
      { status: "available", compose: false, env: true },
    );
  });

  it("is unknown when nothing was recorded", () => {
    assert.deepEqual(updateStatusOf(null, v21), { status: "unknown" });
  });
});
