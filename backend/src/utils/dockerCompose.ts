import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  visit,
  type Node,
  type YAMLMap,
} from "yaml";

/** An error blocks saving; a warning is advice the admin may ignore. */
export type ComposeIssueSeverity = "error" | "warning";

export interface ComposeIssue {
  severity: ComposeIssueSeverity;
  /** Where the issue is: a file, or the other deployment settings. */
  file: "compose" | "env" | "settings";
  /** 1-based; null when the issue is about the file as a whole. */
  line: number | null;
  message: string;
  /**
   * Settings only: the field at fault, as "name", "variables.<index>" or
   * "domains.<index>".
   */
  field?: string;
}

export interface ComposeCheckResult {
  /** True when there is no error (warnings are allowed). */
  valid: boolean;
  issues: ComposeIssue[];
  /** Re-indented when it parses; otherwise as given. */
  composeFile: string;
  /**
   * Variables the file uses without a default, in order of appearance. Each
   * deployment has to supply them.
   */
  variables: string[];
  /** Every variable the file mentions, with or without a default. */
  referencedVariables: string[];
  /** Service names; empty when the file does not parse that far. */
  services: string[];
}

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const MAX_PORT = 65_535;

const TOP_LEVEL_KEYS = [
  "version",
  "name",
  "include",
  "services",
  "networks",
  "volumes",
  "configs",
  "secrets",
  "models",
];

const SERVICE_KEYS = [
  "annotations",
  "attach",
  "blkio_config",
  "build",
  "cap_add",
  "cap_drop",
  "cgroup",
  "cgroup_parent",
  "command",
  "configs",
  "container_name",
  "cpu_count",
  "cpu_percent",
  "cpu_period",
  "cpu_quota",
  "cpu_rt_period",
  "cpu_rt_runtime",
  "cpu_shares",
  "cpus",
  "cpuset",
  "credential_spec",
  "depends_on",
  "deploy",
  "develop",
  "device_cgroup_rules",
  "devices",
  "dns",
  "dns_opt",
  "dns_search",
  "domainname",
  "driver_opts",
  "entrypoint",
  "env_file",
  "environment",
  "expose",
  "extends",
  "external_links",
  "extra_hosts",
  "gpus",
  "group_add",
  "healthcheck",
  "hostname",
  "image",
  "init",
  "ipc",
  "isolation",
  "label_file",
  "labels",
  "links",
  "logging",
  "mac_address",
  "mem_limit",
  "mem_reservation",
  "mem_swappiness",
  "memswap_limit",
  "models",
  "network_mode",
  "networks",
  "oom_kill_disable",
  "oom_score_adj",
  "pid",
  "pids_limit",
  "platform",
  "ports",
  "post_start",
  "pre_stop",
  "privileged",
  "profiles",
  "provider",
  "pull_policy",
  "read_only",
  "restart",
  "runtime",
  "scale",
  "secrets",
  "security_opt",
  "shm_size",
  "stdin_open",
  "stop_grace_period",
  "stop_signal",
  "storage_opt",
  "sysctls",
  "tmpfs",
  "tty",
  "ulimits",
  "use_api_socket",
  "user",
  "userns_mode",
  "uts",
  "volumes",
  "volumes_from",
  "working_dir",
];

const RESTART = /^(no|always|unless-stopped|on-failure(:\d+)?)$/;

const PORT =
  /^(?:(?<ip>\[[0-9a-fA-F:]+\]|\d{1,3}(?:\.\d{1,3}){3}):)?(?:(?<host>\d+(?:-\d+)?)?:)?(?<container>\d+(?:-\d+)?)(?:\/(?<protocol>tcp|udp|sctp))?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** The known key a typo most likely meant, if any is close enough. */
function closest(key: string, known: string[]): string | null {
  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of known) {
    const distance = editDistance(key.toLowerCase(), candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

interface VariableUse {
  name: string;
  /** `${X:-fallback}` and friends: fine to leave unset. */
  optional: boolean;
}

function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** Walks Compose interpolation: `$X`, `${X}`, `${X:-default}`, `$$`. */
export function scanVariables(
  text: string,
  onUse: (use: VariableUse) => void,
  onError: (message: string) => void,
): void {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "$") {
      i++;
      continue;
    }
    const next = text[i + 1];
    if (next === "$") {
      i += 2;
      continue;
    }
    if (next === "{") {
      const end = closingBrace(text, i + 1);
      if (end === -1) {
        onError(
          `"${text.slice(i, i + 24)}" opens a variable but never closes it with }`,
        );
        return;
      }
      const inner = text.slice(i + 2, end);
      const name = VARIABLE_NAME.exec(inner)?.[0];
      const rest = name ? inner.slice(name.length) : "";
      const operator = /^(:-|-|:\?|\?|:\+|\+)/.exec(rest)?.[0];
      if (!name || (rest && !operator)) {
        onError(
          `"\${${inner}}" is not a valid variable. Names use letters, digits and _ and cannot start with a digit`,
        );
      } else {
        onUse({
          name,
          optional: operator !== undefined && !operator.endsWith("?"),
        });
        if (operator) {
          scanVariables(rest.slice(operator.length), onUse, onError);
        }
      }
      i = end + 1;
      continue;
    }
    const bare = VARIABLE_NAME.exec(text.slice(i + 1))?.[0];
    if (bare) {
      onUse({ name: bare, optional: false });
      i += 1 + bare.length;
      continue;
    }
    onError("A lone $ is not allowed. Write $$ for a literal dollar sign");
    i++;
  }
}

interface EnvCheck {
  /** Variable name to the line that sets it. */
  variables: Map<string, number>;
  issues: ComposeIssue[];
  formatted: string;
}

/** Checks `KEY=value` lines and rewrites them with uniform spacing. */
export function checkEnvFile(text: string): EnvCheck {
  const variables = new Map<string, number>();
  const issues: ComposeIssue[] = [];
  const out: string[] = [];

  const error = (line: number, message: string) =>
    issues.push({ severity: "error", file: "env", line, message });

  normalizeNewlines(text)
    .split("\n")
    .forEach((rawLine, index) => {
      const line = index + 1;
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (out.length > 0 && out[out.length - 1] !== "") out.push("");
        return;
      }
      if (trimmed.startsWith("#")) {
        out.push(trimmed);
        return;
      }

      const body = trimmed.replace(/^export\s+/, "");
      const equals = body.indexOf("=");
      if (equals === -1) {
        error(line, `"${trimmed}" is not KEY=value`);
        out.push(trimmed);
        return;
      }
      const key = body.slice(0, equals).trim();
      const value = body.slice(equals + 1).trim();
      out.push(`${key}=${value}`);

      if (VARIABLE_NAME.exec(key)?.[0] !== key) {
        error(
          line,
          `"${key}" is not a valid name. Use letters, digits and _ and do not start with a digit`,
        );
        return;
      }
      const quote = value[0];
      if (
        (quote === '"' || quote === "'") &&
        (value.length === 1 || !value.endsWith(quote))
      ) {
        error(line, `${key} opens a ${quote} quote but never closes it`);
      }
      const earlier = variables.get(key);
      if (earlier !== undefined) {
        error(line, `${key} is already set on line ${earlier}`);
        return;
      }
      variables.set(key, line);
    });

  while (out[out.length - 1] === "") out.pop();
  return {
    variables,
    issues,
    formatted: out.length > 0 ? `${out.join("\n")}\n` : "",
  };
}

interface Entry {
  key: string;
  line: number | null;
  value: Node | null;
}

/**
 * Checks a Compose file the way an admin would want before saving: syntax,
 * structure, references between services, networks and volumes, and
 * variables. Returns it with uniform spacing, and the variables it needs.
 * Their values are not part of the file: each deployment brings its own.
 */
export function checkDockerCompose(composeFile: string): ComposeCheckResult {
  const issues: ComposeIssue[] = [];
  const variables = new Set<string>();
  const referenced = new Set<string>();
  let serviceList: string[] = [];
  const source = normalizeNewlines(composeFile);

  const finish = (formatted: string): ComposeCheckResult => ({
    valid: !issues.some((issue) => issue.severity === "error"),
    issues: issues.sort(
      (a, b) =>
        Number(b.severity === "error") - Number(a.severity === "error") ||
        a.file.localeCompare(b.file) ||
        (a.line ?? 0) - (b.line ?? 0),
    ),
    composeFile: formatted,
    variables: [...variables],
    referencedVariables: [...referenced],
    services: serviceList,
  });

  const report =
    (severity: ComposeIssueSeverity) =>
    (line: number | null, message: string) =>
      issues.push({ severity, file: "compose", line, message });
  const error = report("error");
  const warn = report("warning");

  if (!source.trim()) {
    error(null, "The compose file is empty");
    return finish(source);
  }

  const lineCounter = new LineCounter();
  const doc = parseDocument(source, {
    lineCounter,
    merge: true,
    prettyErrors: false,
  });
  const lineAt = (offset: number) => lineCounter.linePos(offset).line;
  const lineOf = (node: unknown): number | null => {
    const range = (node as { range?: [number, number, number] | null } | null)
      ?.range;
    return range ? lineAt(range[0]) : null;
  };

  for (const problem of doc.errors)
    error(lineAt(problem.pos[0]), problem.message);
  for (const problem of doc.warnings)
    warn(lineAt(problem.pos[0]), problem.message);
  if (doc.errors.length > 0) return finish(source);

  const root = doc.contents;
  if (!isMap(root)) {
    error(
      1,
      "The file must be a list of settings such as `services:`, not a single value or a list",
    );
    return finish(source);
  }

  const entriesOf = (map: YAMLMap): Entry[] =>
    map.items.flatMap((pair) => {
      if (!isScalar(pair.key)) {
        error(lineOf(pair.key), "Keys must be plain text");
        return [];
      }
      return [
        {
          key: String(pair.key.value),
          line: lineOf(pair.key),
          value: pair.value as Node | null,
        },
      ];
    });
  const toJs = (node: Node | null): unknown => node?.toJS(doc) ?? null;

  // Variables, wherever they appear.
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value !== "string") return;
      const line = lineOf(node);
      scanVariables(
        node.value,
        ({ name, optional }) => {
          referenced.add(name);
          if (!optional) variables.add(name);
        },
        (message) => error(line, message),
      );
      const braced = /(?<![${])\{([A-Z_][A-Z0-9_]*)\}(?!\})/.exec(node.value);
      if (braced) {
        warn(
          line,
          `"{${braced[1]}}" is plain text, not a variable. Did you mean \${${braced[1]}}?`,
        );
      }
    },
  });

  const top = entriesOf(root);
  for (const entry of top) {
    if (entry.key.startsWith("x-") || TOP_LEVEL_KEYS.includes(entry.key)) {
      continue;
    }
    const guess = closest(entry.key, TOP_LEVEL_KEYS);
    error(
      entry.line,
      `"${entry.key}" is not a top-level Compose setting${guess ? `. Did you mean "${guess}"?` : ""}`,
    );
  }

  if (top.some((entry) => entry.key === "version")) {
    warn(
      top.find((entry) => entry.key === "version")?.line ?? null,
      "`version` is obsolete and ignored by Docker Compose. It can be removed",
    );
  }

  /** Names declared under a top-level section such as `volumes:`. */
  const declared = (section: string): Set<string> => {
    const entry = top.find((candidate) => candidate.key === section);
    if (!entry || entry.value === null) return new Set();
    if (!isMap(entry.value)) {
      if (toJs(entry.value) !== null) {
        error(entry.line, `\`${section}\` must be a list of named entries`);
      }
      return new Set();
    }
    return new Set(entriesOf(entry.value).map((item) => item.key));
  };
  const networks = declared("networks");
  const volumes = declared("volumes");

  const servicesEntry = top.find((entry) => entry.key === "services");
  if (!servicesEntry) {
    error(null, "There is no `services:` section, so nothing would run");
    return finish(source);
  }
  if (!isMap(servicesEntry.value) || servicesEntry.value.items.length === 0) {
    error(servicesEntry.line, "`services` must name at least one service");
    return finish(source);
  }

  const services = entriesOf(servicesEntry.value);
  const serviceNames = new Set(services.map((service) => service.key));
  serviceList = [...serviceNames];
  const containerNames = new Map<string, string>();
  const hostPorts = new Map<string, string>();

  for (const service of services) {
    const label = `Service "${service.key}"`;
    if (!NAME.test(service.key)) {
      error(
        service.line,
        `${label}: the name may only use letters, digits, ".", "_" and "-"`,
      );
    }
    if (!isMap(service.value)) {
      error(service.line, `${label} has no settings`);
      continue;
    }

    const settings = entriesOf(service.value);
    const lineFor = (key: string) =>
      settings.find((entry) => entry.key === key)?.line ?? service.line;
    // The merged view, so settings pulled in with `<<: *anchor` count.
    const merged = toJs(service.value);
    const values: Record<string, unknown> = isRecord(merged) ? merged : {};

    for (const entry of settings) {
      if (
        entry.key === "<<" ||
        entry.key.startsWith("x-") ||
        SERVICE_KEYS.includes(entry.key)
      ) {
        continue;
      }
      const guess = closest(entry.key, SERVICE_KEYS);
      if (guess) {
        error(
          entry.line,
          `${label}: "${entry.key}" is not a service setting. Did you mean "${guess}"?`,
        );
      } else {
        warn(
          entry.line,
          `${label}: "${entry.key}" is not a known service setting`,
        );
      }
    }

    // Image
    const image = values.image;
    if (
      image === undefined &&
      values.build === undefined &&
      values.extends === undefined
    ) {
      error(service.line, `${label} has no \`image\``);
    } else if (
      image !== undefined &&
      (typeof image !== "string" || !image.trim())
    ) {
      error(
        lineFor("image"),
        `${label}: \`image\` must be an image name such as nginx:1.27`,
      );
    } else if (typeof image === "string" && /\s/.test(image.trim())) {
      error(
        lineFor("image"),
        `${label}: the image name "${image}" contains a space`,
      );
    }
    if (values.build !== undefined) {
      warn(
        lineFor("build"),
        `${label}: \`build\` needs source files, which a pasted compose file does not have. Use a prebuilt \`image\``,
      );
    }

    // Container name
    const containerName = values.container_name;
    if (containerName !== undefined) {
      const line = lineFor("container_name");
      if (typeof containerName !== "string" || !containerName.trim()) {
        error(line, `${label}: \`container_name\` must be text`);
      } else {
        const literal = containerName.replace(
          /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g,
          "x",
        );
        if (!NAME.test(literal)) {
          error(
            line,
            `${label}: container name "${containerName}" may only use letters, digits, ".", "_" and "-", and must start with a letter or digit`,
          );
        }
        const owner = containerNames.get(containerName);
        if (owner) {
          error(
            line,
            `${label} uses the same container name as service "${owner}"`,
          );
        }
        containerNames.set(containerName, service.key);
        if (!containerName.includes("$")) {
          warn(
            line,
            `${label}: container name "${containerName}" is the same for every deployment, so two customers would clash. Add a variable, such as ${containerName}-\${USERNAME}`,
          );
        }
      }
    }

    // Restart policy
    const restart = values.restart;
    if (restart !== undefined) {
      const text = restart === false ? "no" : String(restart);
      if (!text.includes("$") && !RESTART.test(text)) {
        error(
          lineFor("restart"),
          `${label}: restart "${text}" is not valid. Use no, always, unless-stopped or on-failure`,
        );
      }
    }

    // Ports
    const ports = values.ports;
    if (ports !== undefined && !Array.isArray(ports)) {
      error(
        lineFor("ports"),
        `${label}: \`ports\` must be a list, one port per "- " line`,
      );
    } else if (Array.isArray(ports)) {
      const portsNode = settings.find((entry) => entry.key === "ports")?.value;
      ports.forEach((port: unknown, index) => {
        const line =
          (isSeq(portsNode) ? lineOf(portsNode.items[index]) : null) ??
          lineFor("ports");
        let host: string | null = null;
        let key = "";

        if (isRecord(port)) {
          if (port.target === undefined) {
            error(line, `${label}: a port entry has no \`target\``);
          }
          if (port.published !== undefined) {
            host = String(port.published);
            key = `${String(port.host_ip ?? "")}:${host}/${String(port.protocol ?? "tcp")}`;
          }
        } else if (typeof port === "string" || typeof port === "number") {
          const text = String(port).trim();
          if (text.includes("$")) return;
          const match = PORT.exec(text);
          if (!match?.groups) {
            error(
              line,
              `${label}: port "${text}" is not valid. Use "8080:80", "80" or "127.0.0.1:8080:80/tcp"`,
            );
            return;
          }
          const numbers = [match.groups.host, match.groups.container]
            .filter((part): part is string => Boolean(part))
            .flatMap((part) => part.split("-").map(Number));
          if (numbers.some((number) => number < 1 || number > MAX_PORT)) {
            error(line, `${label}: port "${text}" is outside 1-${MAX_PORT}`);
            return;
          }
          if (match.groups.host) {
            host = match.groups.host;
            key = `${match.groups.ip ?? ""}:${host}/${match.groups.protocol ?? "tcp"}`;
          }
        } else {
          error(line, `${label}: a port must be text such as "8080:80"`);
          return;
        }

        if (host === null || host.includes("$")) return;
        const owner = hostPorts.get(key);
        if (owner) {
          error(
            line,
            `${label}: host port ${host} is already published by service "${owner}"`,
          );
        } else {
          hostPorts.set(key, service.key);
          warn(
            line,
            `${label}: host port ${host} is fixed, so only one deployment per server could use it. Prefer \`expose\` with a domain, or a variable`,
          );
        }
      });
    }

    // Environment
    const environment = values.environment;
    if (Array.isArray(environment)) {
      if (environment.some((item) => typeof item !== "string")) {
        error(
          lineFor("environment"),
          `${label}: each \`environment\` line must be KEY=value. A space after "- KEY:" turns it into something else`,
        );
      }
    } else if (isRecord(environment)) {
      for (const [key, value] of Object.entries(environment)) {
        if (typeof value === "object" && value !== null) {
          error(
            lineFor("environment"),
            `${label}: environment "${key}" must be a single value, not a list or group`,
          );
        }
      }
    } else if (environment !== undefined && environment !== null) {
      error(
        lineFor("environment"),
        `${label}: \`environment\` must be a list of KEY=value or KEY: value lines`,
      );
    }

    // depends_on
    const dependsOn = values.depends_on;
    const dependencies = Array.isArray(dependsOn)
      ? dependsOn.map(String)
      : isRecord(dependsOn)
        ? Object.keys(dependsOn)
        : null;
    if (dependsOn !== undefined && dependencies === null) {
      error(
        lineFor("depends_on"),
        `${label}: \`depends_on\` must be a list of service names`,
      );
    }
    for (const dependency of dependencies ?? []) {
      if (dependency === service.key) {
        error(lineFor("depends_on"), `${label} depends on itself`);
      } else if (!serviceNames.has(dependency)) {
        error(
          lineFor("depends_on"),
          `${label} depends on "${dependency}", which is not a service in this file`,
        );
      }
    }

    // Networks
    const serviceNetworks = values.networks;
    const usedNetworks = Array.isArray(serviceNetworks)
      ? serviceNetworks.map(String)
      : isRecord(serviceNetworks)
        ? Object.keys(serviceNetworks)
        : null;
    if (serviceNetworks !== undefined && usedNetworks === null) {
      error(
        lineFor("networks"),
        `${label}: \`networks\` must be a list of network names`,
      );
    }
    for (const network of usedNetworks ?? []) {
      if (
        network !== "default" &&
        !network.includes("$") &&
        !networks.has(network)
      ) {
        error(
          lineFor("networks"),
          `${label} uses network "${network}", which is not declared under the top-level \`networks:\``,
        );
      }
    }
    if (values.network_mode !== undefined && serviceNetworks !== undefined) {
      error(
        lineFor("network_mode"),
        `${label} sets both \`network_mode\` and \`networks\`. Only one is allowed`,
      );
    }

    // Volumes
    const serviceVolumes = values.volumes;
    if (serviceVolumes !== undefined && !Array.isArray(serviceVolumes)) {
      error(
        lineFor("volumes"),
        `${label}: \`volumes\` must be a list, one mount per "- " line`,
      );
    } else if (Array.isArray(serviceVolumes)) {
      for (const volume of serviceVolumes as unknown[]) {
        let named: string | null = null;
        if (typeof volume === "string") {
          const parts = volume.split(":");
          if (/^[A-Za-z]:[\\/]/.test(volume) || volume.includes("$")) continue;
          if (parts.length >= 2 && NAME.test(parts[0])) named = parts[0];
          // A writable host folder with no variable is shared by everyone.
          if (
            parts.length >= 2 &&
            parts[0].startsWith("/") &&
            !parts[0].endsWith(".sock") &&
            !(parts[2] ?? "").split(",").includes("ro")
          ) {
            warn(
              lineFor("volumes"),
              `${label}: host folder "${parts[0]}" is the same for every deployment, so customers would share data. Add a variable, such as ${parts[0].replace(/\/$/, "")}-\${USERNAME}`,
            );
          }
        } else if (isRecord(volume)) {
          if (volume.type === "volume" && typeof volume.source === "string") {
            named = volume.source.includes("$") ? null : volume.source;
          }
          if (volume.target === undefined) {
            error(
              lineFor("volumes"),
              `${label}: a volume entry has no \`target\``,
            );
          }
        } else {
          error(
            lineFor("volumes"),
            `${label}: a volume must be text such as "data:/var/lib/data"`,
          );
        }
        if (named !== null && !volumes.has(named)) {
          error(
            lineFor("volumes"),
            `${label} mounts volume "${named}", which is not declared under the top-level \`volumes:\``,
          );
        }
      }
    }
  }

  // Uniform layout: two-space indent, one blank line between top-level
  // sections and between services. Comments are kept.
  const separate = (map: YAMLMap) =>
    map.items.forEach((pair, index) => {
      if (isScalar(pair.key)) pair.key.spaceBefore = index > 0;
    });
  separate(root);
  separate(servicesEntry.value);

  return finish(doc.toString({ indent: 2, lineWidth: 0 }));
}
