import {
  isCustomerSet,
  isSetOnce,
  type DeploymentDomain,
  type DeploymentVariable,
} from "../models/product/product.interface";
import {
  checkDockerCompose,
  type ComposeCheckResult,
  type ComposeIssue,
  type ComposeIssueSeverity,
} from "./dockerCompose";
import { mountVariables } from "./deploymentFolders";

/**
 * Set for every deployment, and usable in the compose file, the name,
 * subdomains and variable values. DOMAIN is the same for everyone (from
 * DEPLOY_DOMAIN); the rest come from the customer's account.
 */
export const BUILT_IN_VARIABLES = [
  "USERNAME",
  "EMAIL",
  "USER_ID",
  "DOMAIN",
] as const;
export type BuiltInVariable = (typeof BUILT_IN_VARIABLES)[number];

/** Longest USERNAME, including a suffix added to tell two customers apart. */
export const MAX_USERNAME_LENGTH = 32;
/** Room left for that suffix ("2" to "9999"). */
const MAX_USERNAME_BASE_LENGTH = MAX_USERNAME_LENGTH - 4;
const MAX_NAME_LENGTH = 63;
const MAX_HOST_LENGTH = 253;
const MAX_PORT = 65_535;
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Docker Compose project names, which Dokploy builds from the app name. */
const PROJECT_NAME = /^[a-z0-9][a-z0-9_-]*$/;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * The part of the email before "@", lowercased, letters and digits only:
 * "Jane.Doe42@example.com" gives "janedoe42". Safe in names and hosts. Two
 * emails can give the same one; `usernameService` adds a suffix then.
 */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const safe = local
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, MAX_USERNAME_BASE_LENGTH);
  return safe || "user";
}

export function isBuiltIn(name: string): name is BuiltInVariable {
  return (BUILT_IN_VARIABLES as readonly string[]).includes(name);
}

const TEMPLATE_TOKEN = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * The `${NAME}` references in a template, or why it is malformed. `$$` is a
 * literal dollar sign; any other `$` is a mistake.
 */
export function scanTemplate(text: string): {
  references: string[];
  error: string | null;
} {
  const references: string[] = [];
  const leftover = text.replace(TEMPLATE_TOKEN, (_match, name?: string) => {
    if (name) references.push(name);
    return "";
  });
  const stray = leftover.indexOf("$");
  return {
    references,
    error:
      stray === -1
        ? null
        : "Write variables as ${NAME}, and a literal dollar sign as $$",
  };
}

/** Fills `${NAME}` from `values` (unknown ones become empty); `$$` gives `$`. */
export function renderTemplate(
  text: string,
  values: Readonly<Record<string, string>>,
): string {
  return text.replace(TEMPLATE_TOKEN, (_match, name?: string) =>
    name ? (values[name] ?? "") : "$",
  );
}

/** What an admin types for a product's deployment, before it is checked. */
export interface DeploymentDraft {
  name: string;
  composeFile: string;
  variables: DeploymentVariable[];
  domains: DeploymentDomain[];
}

export interface DeploymentCheckResult extends ComposeCheckResult {
  /** The name and each domain's full host for a sample customer, when valid. */
  preview: {
    username: string;
    domain: string;
    name: string | null;
    hosts: (string | null)[];
  };
}

/** Where a product's deployment is going for one customer. */
export interface ResolvedDeployment {
  /** The compose's name in Dokploy. */
  name: string;
  /** Every variable the compose file can use, built-ins included. */
  env: Record<string, string>;
  domains: { serviceName: string; host: string; port: number }[];
}

/**
 * Fills a product's templates for one customer. `customerValues` are what
 * the customer typed for the variables they set, taken literally; missing
 * editable ones fall back to the product's default, missing set-once ones
 * are empty (`missingValues` tells).
 */
export function resolveDeployment(
  deployment: Pick<DeploymentDraft, "name" | "variables" | "domains">,
  builtIns: Record<BuiltInVariable, string>,
  customerValues: Readonly<Record<string, string>>,
): ResolvedDeployment {
  const env: Record<string, string> = { ...builtIns };
  // What names and hosts may use: nothing the customer can change.
  const fixed: Record<string, string> = { ...builtIns };
  for (const variable of deployment.variables) {
    const byAdmin = renderTemplate(variable.value, builtIns);
    if (variable.visibility === "editable") {
      env[variable.key] = customerValues[variable.key] ?? byAdmin;
    } else if (isSetOnce(variable.visibility)) {
      env[variable.key] = customerValues[variable.key] ?? "";
    } else {
      env[variable.key] = byAdmin;
      fixed[variable.key] = byAdmin;
    }
  }
  return {
    name: renderTemplate(deployment.name.trim(), fixed),
    env,
    domains: deployment.domains.map((domain) => ({
      serviceName: domain.serviceName,
      host: `${renderTemplate((domain.subdomain ?? "").trim(), fixed)}.${builtIns.DOMAIN}`,
      port: domain.port,
    })),
  };
}

/**
 * The set-once variables the customer has not filled yet. The service
 * cannot be deployed until this is empty.
 */
export function missingValues(
  variables: readonly DeploymentVariable[],
  customerValues: Readonly<Record<string, string>>,
): string[] {
  return variables
    .filter(
      (variable) =>
        isSetOnce(variable.visibility) && !customerValues[variable.key]?.trim(),
    )
    .map((variable) => variable.key);
}

/**
 * A `.env` file Docker Compose reads back exactly: plain when safe, else
 * quoted so `$`, `#` and spaces stay as they are.
 */
export function toEnvFile(env: Readonly<Record<string, string>>): string {
  return Object.entries(env)
    .map(([key, value]) => {
      if (/^[A-Za-z0-9_./:@,+-]*$/.test(value)) return `${key}=${value}`;
      if (!value.includes("'")) return `${key}='${value}'`;
      const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\$/g, "$$$$");
      return `${key}="${escaped}"`;
    })
    .join("\n")
    .concat("\n");
}

/**
 * One line on what blocks saving: the first error and how many more there
 * are. Null when there are only warnings.
 */
export function checkErrorMessage(
  issues: readonly ComposeIssue[],
): string | null {
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length === 0) return null;
  const [first] = errors;
  const where =
    first.file === "settings"
      ? ""
      : `Compose file${first.line ? ` line ${first.line}` : ""}: `;
  const more = errors.length > 1 ? ` (and ${errors.length - 1} more)` : "";
  return `${where}${first.message}${more}`;
}

/**
 * Checks everything a product needs to deploy: the compose file, the
 * environment variables it uses, the per-customer name and the domains.
 * `domain` is the base domain hosts end with (DEPLOY_DOMAIN).
 */
export function checkDeployment(
  draft: DeploymentDraft,
  domain = "example.com",
): DeploymentCheckResult {
  // Two made-up customers: a template that renders the same for both is not
  // per customer, and the second has the longest possible username.
  const sampleA: Record<BuiltInVariable, string> = {
    USERNAME: "janedoe42",
    EMAIL: "jane.doe42@example.com",
    USER_ID: "000000000000000000000001",
    DOMAIN: domain,
  };
  const sampleB: Record<BuiltInVariable, string> = {
    USERNAME: "x".repeat(MAX_USERNAME_LENGTH),
    EMAIL: `${"x".repeat(MAX_USERNAME_LENGTH)}@example.com`,
    USER_ID: "000000000000000000000002",
    DOMAIN: domain,
  };

  const compose = checkDockerCompose(draft.composeFile);
  const issues: ComposeIssue[] = [...compose.issues];
  // The field being checked; issues reported meanwhile point at it.
  let field: string | undefined;
  const report = (severity: ComposeIssueSeverity) => (message: string) =>
    issues.push({
      severity,
      file: "settings",
      line: null,
      message,
      ...(field ? { field } : {}),
    });
  const error = report("error");
  const warn = report("warning");
  const parsed = compose.services.length > 0;

  // Environment variables
  const mounted = new Set(mountVariables(draft.composeFile));
  const defined = new Map<string, DeploymentVariable>();
  draft.variables.forEach((variable, index) => {
    field = `variables.${index}`;
    const key = variable.key;
    const label = key ? `Variable "${key}"` : `Variable ${index + 1}`;
    if (!key) return error(`${label} has no name`);
    if (!VARIABLE_NAME.test(key)) {
      return error(
        `${label}: names use letters, digits and _, and cannot start with a digit`,
      );
    }
    if (isBuiltIn(key)) {
      return error(
        `${label} is built in and always set. Use \${${key}} instead of defining it`,
      );
    }
    if (defined.has(key)) return error(`${label} is defined twice`);
    defined.set(key, variable);

    if (/[\r\n]/.test(variable.value)) {
      error(`${label}: the value must be on one line`);
    }
    if (isCustomerSet(variable.visibility) && mounted.has(key)) {
      error(
        `${label} decides what a volume mounts, and the customer sets it, so they could mount any folder of the server. Make it read-only or hidden, or take it out of the volume`,
      );
    }
    const scan = scanTemplate(variable.value);
    if (scan.error) error(`${label}: ${scan.error}`);
    const bare = variable.value.trim();
    if (isBuiltIn(bare)) {
      error(
        `${label}: the value is the plain text "${bare}", the same for every customer. Write \${${bare}} to use the customer's value`,
      );
    }
    const foreign = scan.references.filter((name) => !isBuiltIn(name));
    if (foreign.length > 0) {
      error(
        `${label}: a value can only use the built-in variables (${BUILT_IN_VARIABLES.map((name) => `\${${name}}`).join(", ")}), not \${${foreign[0]}}`,
      );
    }
    if (parsed && !compose.referencedVariables.includes(key)) {
      warn(
        `${label} is not used in the compose file, so no container gets it. Pass it on, for example \`environment: - ${key}=\${${key}}\``,
      );
    }
  });

  field = undefined;
  for (const name of compose.variables) {
    if (!isBuiltIn(name) && !defined.has(name)) {
      error(
        `The compose file uses \${${name}}, which is not defined. Add it under Environment, or use a built-in variable`,
      );
    }
  }

  /** Built-ins plus every variable the customer cannot change. */
  const contextFor = (sample: Record<BuiltInVariable, string>) => {
    const context: Record<string, string> = { ...sample };
    for (const [key, variable] of defined) {
      if (!isCustomerSet(variable.visibility)) {
        context[key] = renderTemplate(variable.value, sample);
      }
    }
    return context;
  };
  const contextA = contextFor(sampleA);
  const contextB = contextFor(sampleB);

  /**
   * Renders a per-customer template for both samples, or reports why it
   * cannot be used. Returns the two renderings when it can.
   */
  const renderPerCustomer = (
    template: string,
    label: string,
  ): [string, string] | null => {
    const scan = scanTemplate(template);
    if (scan.error) {
      error(`${label}: ${scan.error}`);
      return null;
    }
    let usable = true;
    for (const name of scan.references) {
      if (isBuiltIn(name)) continue;
      const variable = defined.get(name);
      if (!variable) {
        error(`${label} uses \${${name}}, which is not defined`);
        usable = false;
      } else if (isCustomerSet(variable.visibility)) {
        error(
          `${label} uses \${${name}}, which the customer sets. Use a built-in variable or one only an admin sets`,
        );
        usable = false;
      }
    }
    if (!usable) return null;

    const a = renderTemplate(template, contextA);
    const b = renderTemplate(template, contextB);
    if (a === b) {
      error(
        `${label} is the same for every customer, so the second deployment would clash. Add a per-customer variable such as \${USERNAME}`,
      );
      return null;
    }
    return [a, b];
  };

  // Name in Dokploy
  let namePreview: string | null = null;
  field = "name";
  const name = draft.name.trim();
  if (!name) {
    error("Give the deployment a name, such as n8n-${USERNAME}");
  } else {
    const rendered = renderPerCustomer(name, "The name");
    if (rendered) {
      const [a, b] = rendered;
      if (!PROJECT_NAME.test(a)) {
        error(
          `The name becomes "${a}", but it may only use lowercase letters, digits, - and _, starting with a letter or digit`,
        );
      } else if (b.length > MAX_NAME_LENGTH) {
        error(
          `The name can be ${b.length} characters for a customer with a long username. Keep it to ${MAX_NAME_LENGTH}`,
        );
      } else {
        namePreview = a;
      }
    }
  }

  // Domains
  const subdomains = new Set<string>();
  const hostPreviews = draft.domains.map((entry, index) => {
    field = `domains.${index}`;
    const label = `Domain ${index + 1}`;
    if (!entry.serviceName) {
      error(`${label}: choose the service it points to`);
    } else if (parsed && !compose.services.includes(entry.serviceName)) {
      error(
        `${label} points to service "${entry.serviceName}", which is not in the compose file`,
      );
    }
    if (
      !Number.isInteger(entry.port) ||
      entry.port < 1 ||
      entry.port > MAX_PORT
    ) {
      error(
        `${label}: the container port must be a whole number, 1-${MAX_PORT}`,
      );
    }

    const subdomain = entry.subdomain.trim();
    if (!subdomain) {
      error(`${label} has no subdomain`);
      return null;
    }
    if (subdomains.has(subdomain)) {
      error(`${label} uses the same subdomain as an earlier domain`);
      return null;
    }
    subdomains.add(subdomain);

    const rendered = renderPerCustomer(subdomain, `${label} subdomain`);
    if (!rendered) return null;
    const [a, b] = rendered;
    if (a.length > 63 || !HOST_LABEL.test(a)) {
      error(
        `${label}: the subdomain becomes "${a}", but it must be one part without dots, using lowercase letters, digits and -, such as n8n-\${USERNAME}`,
      );
      return null;
    }
    if (b.length > 63 || `${b}.${domain}`.length > MAX_HOST_LENGTH) {
      error(
        `${label}: the subdomain can be ${b.length} characters for a customer with a long username. Keep it to 63`,
      );
      return null;
    }
    return `${a}.${domain}`;
  });

  return {
    ...compose,
    valid: !issues.some((issue) => issue.severity === "error"),
    issues: issues.sort(
      (a, b) =>
        Number(b.severity === "error") - Number(a.severity === "error") ||
        a.file.localeCompare(b.file) ||
        (a.line ?? 0) - (b.line ?? 0),
    ),
    preview: {
      username: sampleA.USERNAME,
      domain,
      name: namePreview,
      hosts: hostPreviews,
    },
  };
}
