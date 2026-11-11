import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDockerCompose, checkEnvFile } from "./dockerCompose";

const errorsOf = (compose: string) =>
  checkDockerCompose(compose)
    .issues.filter((issue) => issue.severity === "error")
    .map((issue) => issue.message);

const GOOD = `services:
  n8n:
    image: n8nio/n8n:1.70.0
    container_name: n8n-\${USERNAME}
    restart: unless-stopped
    environment:
      - N8N_HOST=\${DOMAIN}
    expose:
      - "5678"
    volumes:
      - data:/home/node/.n8n
volumes:
  data:
`;

describe("checkDockerCompose", () => {
  it("accepts a sound file and lists the variables a deployment must supply", () => {
    const result = checkDockerCompose(GOOD);
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.variables, ["USERNAME", "DOMAIN"]);
  });

  it("leaves out a variable that has a default", () => {
    const result = checkDockerCompose(
      "services:\n  app:\n    image: nginx:${TAG:-latest}\n",
    );
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.variables, []);
  });

  it("reports YAML syntax errors with their line", () => {
    const result = checkDockerCompose(
      "services:\n  app:\n   image: a\n    restart: always\n",
    );
    assert.equal(result.valid, false);
    assert.equal(typeof result.issues[0].line, "number");
  });

  it("uniforms indentation and spacing, keeping comments", () => {
    const messy =
      "services:\n      # the app\n      app:\n            image:    nginx\n      db:\n            image: postgres:17\nvolumes: {}\n";
    const result = checkDockerCompose(messy);
    assert.equal(
      result.composeFile,
      "services:\n  # the app\n  app:\n    image: nginx\n\n  db:\n    image: postgres:17\n\nvolumes: {}\n",
    );
    // Formatting a formatted file changes nothing.
    assert.equal(
      checkDockerCompose(result.composeFile).composeFile,
      result.composeFile,
    );
  });

  it("catches a misspelled setting and suggests the right one", () => {
    const [message] = errorsOf(
      "services:\n  app:\n    imagee: nginx\n    image: nginx\n",
    );
    assert.match(message, /Did you mean "image"/);
    assert.match(
      errorsOf("service:\n  app:\n    image: nginx\n").join("\n"),
      /Did you mean "services"/,
    );
  });

  it("requires services, each with an image", () => {
    assert.match(errorsOf("volumes:\n  data:\n")[0], /no `services:`/);
    assert.match(
      errorsOf("services:\n  app:\n    restart: always\n")[0],
      /no `image`/,
    );
  });

  it("catches references to things that do not exist", () => {
    const errors = errorsOf(
      "services:\n  app:\n    image: nginx\n    depends_on: [db]\n    networks: [web]\n    volumes:\n      - data:/data\n",
    );
    assert.equal(errors.length, 3);
    assert.match(errors.join("\n"), /"db", which is not a service/);
    assert.match(errors.join("\n"), /network "web"/);
    assert.match(errors.join("\n"), /volume "data"/);
  });

  it("catches bad ports, restart values and clashing host ports", () => {
    assert.match(
      errorsOf(
        "services:\n  app:\n    image: nginx\n    ports:\n      - 80:eighty\n",
      )[0],
      /port "80:eighty" is not valid/,
    );
    assert.match(
      errorsOf(
        "services:\n  app:\n    image: nginx\n    restart: sometimes\n",
      )[0],
      /restart "sometimes"/,
    );
    assert.match(
      errorsOf(
        "services:\n  a:\n    image: nginx\n    ports: ['80:80']\n  b:\n    image: nginx\n    ports: ['80:8080']\n",
      )[0],
      /already published by service "a"/,
    );
  });

  it("catches broken variable syntax and suggests ${X} for {X}", () => {
    assert.match(
      errorsOf("services:\n  app:\n    image: nginx:${TAG\n")[0],
      /never closes/,
    );
    assert.match(
      errorsOf(
        "services:\n  app:\n    image: nginx\n    command: echo $ 5\n",
      )[0],
      /lone \$/,
    );
    const result = checkDockerCompose(
      "services:\n  app:\n    image: nginx\n    container_name: app-{USERNAME}\n",
    );
    assert.ok(
      result.issues.some((issue) =>
        /Did you mean \$\{USERNAME\}/.test(issue.message),
      ),
    );
  });

  it("warns about a container name shared by every deployment", () => {
    const result = checkDockerCompose(
      "services:\n  app:\n    image: nginx\n    container_name: app\n",
    );
    assert.equal(result.valid, true);
    assert.match(result.issues[0].message, /two customers would clash/);
  });
});

describe("host folders in volumes", () => {
  const withVolume = (volume: string) =>
    checkDockerCompose(
      `services:\n  db:\n    image: postgres:17\n    volumes:\n      - ${volume}\n`,
    );

  it("warns about a writable host folder with no variable", () => {
    const result = withVolume(
      "/mnt/nas-sda/postgres/n8n:/var/lib/postgresql/data",
    );
    assert.equal(result.valid, true);
    assert.match(result.issues[0].message, /customers would share data/);
    assert.equal(result.issues[0].line, 4);
  });

  it("accepts one with a variable, a read-only one and the Docker socket", () => {
    const perCustomer = withVolume(
      "/mnt/nas-sda/postgres/${USERNAME}:/var/lib/postgresql/data",
    );
    assert.deepEqual(perCustomer.issues, []);
    assert.deepEqual(perCustomer.variables, ["USERNAME"]);
    assert.deepEqual(withVolume("/etc/localtime:/etc/localtime:ro").issues, []);
    assert.deepEqual(
      withVolume("/var/run/docker.sock:/var/run/docker.sock").issues,
      [],
    );
  });
});

describe("checkEnvFile", () => {
  it("uniforms spacing and keeps comments", () => {
    const result = checkEnvFile(
      "\n\n# who\r\nexport  USERNAME = demo\n\n\n\nDOMAIN=example.com   \n\n",
    );
    assert.deepEqual(result.issues, []);
    assert.equal(
      result.formatted,
      "# who\nUSERNAME=demo\n\nDOMAIN=example.com\n",
    );
    assert.deepEqual([...result.variables.keys()], ["USERNAME", "DOMAIN"]);
  });

  it("reports bad lines, bad names, open quotes and duplicates", () => {
    const { issues } = checkEnvFile('JUSTTEXT\nMY-VAR=1\nA="open\nB=1\nB=2\n');
    assert.deepEqual(
      issues.map((issue) => issue.line),
      [1, 2, 3, 5],
    );
  });
});
