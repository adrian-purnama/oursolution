import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "yaml";
import { commandComposeFile } from "./deploymentCommand";

interface CommandService {
  image: string;
  network_mode: string;
  read_only: boolean;
  entrypoint: string[];
  command: string[];
  environment: Record<string, string>;
  volumes: { source: string; target: string }[];
}

function serviceOf(composeFile: string): CommandService {
  const doc = parse(composeFile) as { services: { command: CommandService } };
  return doc.services.command;
}

describe("commandComposeFile", () => {
  it("passes the target and command through the environment", () => {
    const service = serviceOf(
      commandComposeFile({
        appName: "n8n-jo-abc123",
        serviceName: "n8n",
        command: "n8n user-management:reset",
      }),
    );
    assert.deepEqual(service.environment, {
      TARGET_PROJECT: "n8n-jo-abc123",
      TARGET_SERVICE: "n8n",
      TARGET_COMMAND: "n8n user-management:reset",
    });
    assert.deepEqual(service.entrypoint, ["sh", "-c"]);
    assert.equal(service.network_mode, "none");
    assert.equal(service.read_only, true);
    assert.deepEqual(
      service.volumes.map(({ source, target }) => [source, target]),
      [["/var/run/docker.sock", "/var/run/docker.sock"]],
    );
  });

  it("escapes $ so compose keeps it for the shell", () => {
    const service = serviceOf(
      commandComposeFile({
        appName: "app",
        serviceName: "db",
        command: "echo $HOME ${USER}",
      }),
    );
    assert.equal(service.environment.TARGET_COMMAND, "echo $$HOME $${USER}");
    assert.match(service.command[0], /\$\$TARGET_COMMAND/);
    assert.doesNotMatch(service.command[0], /[^$]\$TARGET_/);
  });

  it("never puts the command into the script itself", () => {
    const service = serviceOf(
      commandComposeFile({
        appName: "app",
        serviceName: "db",
        command: "rm -rf / ; echo pwned",
      }),
    );
    assert.doesNotMatch(service.command[0], /pwned/);
  });
});
