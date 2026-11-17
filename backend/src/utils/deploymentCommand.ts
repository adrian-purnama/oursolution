import { stringify } from "yaml";

/** Compose reads "$" as a variable; "$$" is a plain one. */
function literal(value: string): string {
  return value.replace(/\$/g, "$$$$");
}

/**
 * Finds the compose service's running container by Docker Compose's own
 * labels and runs the command in it. Everything variable comes in through
 * the environment, so nothing the admin typed is ever read as part of this
 * script; only the inner `sh -c` in the target container runs it.
 */
const SCRIPT = [
  'c=$(docker ps -q --filter "label=com.docker.compose.project=$TARGET_PROJECT" --filter "label=com.docker.compose.service=$TARGET_SERVICE" | head -n 1)',
  'if [ -z "$c" ]; then echo "No running container for service $TARGET_SERVICE of $TARGET_PROJECT" >&2; exit 1; fi',
  'exec docker exec "$c" sh -c "$TARGET_COMMAND"',
].join("\n");

/**
 * A compose file whose only container runs `command` inside the running
 * container of `serviceName` in the customer's compose (`appName`, the
 * project name Dokploy deploys it under), then exits with its exit code.
 * It needs the Docker socket to reach the other container, and nothing
 * else: no network, no other host path, a read-only root.
 */
export function commandComposeFile(input: {
  appName: string;
  serviceName: string;
  command: string;
}): string {
  return stringify({
    services: {
      command: {
        image: "docker:27-cli",
        restart: "no",
        network_mode: "none",
        read_only: true,
        security_opt: ["no-new-privileges:true"],
        entrypoint: ["sh", "-c"],
        command: [literal(SCRIPT)],
        environment: {
          TARGET_PROJECT: literal(input.appName),
          TARGET_SERVICE: literal(input.serviceName),
          TARGET_COMMAND: literal(input.command),
        },
        volumes: [
          {
            type: "bind",
            source: "/var/run/docker.sock",
            target: "/var/run/docker.sock",
          },
        ],
      },
    },
  });
}
