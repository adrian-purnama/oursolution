import type { DokployProjectOutDto } from "../../dto/dokploy.dto";
import { env } from "../../environment/env";

const TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 5_000;
/** How long a deployment may build before we call it failed. */
const DEPLOY_TIMEOUT_MS = 20 * 60_000;
/** How long to wait for Dokploy to list a deployment we just queued. */
const QUEUE_GRACE_MS = 3 * 60_000;
/** How long a one-off job may run: erasing a big folder on a NAS is slow. */
const RUN_ONCE_TIMEOUT_MS = 30 * 60_000;
const RUN_ONCE_POLL_MS = 3_000;
/** How long to wait for a job's container to be listed at all. */
const CONTAINER_GRACE_MS = 60_000;
/** Dokploy's clock and ours may differ a little. */
const CLOCK_SKEW_MS = 15_000;
/**
 * compose.stop / compose.start answer only once Docker is done, and a
 * container that ignores SIGTERM takes its whole stop grace period.
 */
const LIFECYCLE_TIMEOUT_MS = 90_000;
/** How long to watch the containers when that answer never came. */
const LIFECYCLE_SETTLE_MS = 3 * 60_000;
const LIFECYCLE_POLL_MS = 3_000;

/** Dokploy could not be reached, or did not answer in time. */
export class DokployUnreachableError extends Error {}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function list(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Reads the answer of Dokploy's `project.all`, keeping only what we use. */
export function parseDokployProjects(body: unknown): DokployProjectOutDto[] {
  if (!Array.isArray(body)) {
    throw new Error("Dokploy sent an unexpected list of projects");
  }
  return body
    .flatMap((item: unknown) => {
      if (!isRecord(item)) return [];
      const { projectId, name, description } = item;
      if (typeof projectId !== "string" || typeof name !== "string") return [];
      return [
        {
          id: projectId,
          name,
          description: typeof description === "string" ? description : "",
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface DokployCompose {
  composeId: string;
  name: string;
  appName: string;
}

export interface DokployEnvironment {
  environmentId: string;
  composes: DokployCompose[];
}

function parseCompose(item: Json): DokployCompose | null {
  const composeId = text(item.composeId);
  if (!composeId) return null;
  return {
    composeId,
    name: text(item.name) ?? "",
    appName: text(item.appName) ?? "",
  };
}

/**
 * The environment a project's deployments go into: the default one, else
 * "production", else the first.
 */
export function pickEnvironment(project: unknown): DokployEnvironment | null {
  if (!isRecord(project)) return null;
  const environments = list(project.environments);
  const chosen =
    environments.find((item) => item.isDefault === true) ??
    environments.find((item) => item.name === "production") ??
    environments[0];
  const environmentId = chosen ? text(chosen.environmentId) : null;
  if (!chosen || !environmentId) return null;
  return {
    environmentId,
    composes: list(chosen.compose).flatMap((item) => {
      const compose = parseCompose(item);
      return compose ? [compose] : [];
    }),
  };
}

export type DeploymentOutcome =
  | { status: "done" }
  | { status: "error"; message: string }
  | { status: "pending" };

/**
 * What Dokploy's list of a compose's deployments says about the one started
 * at `since`: the newest started then or later.
 */
export function deploymentOutcome(
  deployments: unknown,
  since: Date,
): DeploymentOutcome {
  const started = list(deployments)
    .map((item) => ({
      item,
      at: new Date(text(item.createdAt) ?? 0).getTime(),
    }))
    .filter(({ at }) => at >= since.getTime() - CLOCK_SKEW_MS)
    .sort((a, b) => b.at - a.at);
  const newest = started[0]?.item;
  if (!newest) return { status: "pending" };
  if (newest.status === "done") return { status: "done" };
  if (newest.status === "error" || newest.status === "cancelled") {
    return {
      status: "error",
      message:
        text(newest.errorMessage) ??
        `The deployment ended with status "${String(newest.status)}". See its log in Dokploy`,
    };
  }
  return { status: "pending" };
}

export type ContainersOutcome =
  | { status: "done" }
  | { status: "error"; message: string }
  | { status: "running" }
  | { status: "missing" };

/**
 * What Dokploy's list of a project's containers (`docker ps -a` lines) says
 * about a job: done once every container exited with code 0.
 */
export function containersOutcome(containers: unknown): ContainersOutcome {
  const items = list(containers);
  if (items.length === 0) return { status: "missing" };
  let running = false;
  for (const item of items) {
    const name = text(item.name) ?? "A container";
    const state = text(item.state);
    if (state === "dead") {
      return { status: "error", message: `${name} died` };
    }
    if (state !== "exited") {
      running = true;
      continue;
    }
    const code = /^Exited \((\d+)\)/.exec(text(item.status) ?? "")?.[1];
    if (code === undefined) {
      return {
        status: "error",
        message: `${name} exited, but Dokploy did not say with which code`,
      };
    }
    if (code !== "0") {
      return {
        status: "error",
        message: `${name} exited with code ${code}. See its log in Dokploy`,
      };
    }
  }
  return running ? { status: "running" } : { status: "done" };
}

/** Whether a compose's containers are up, as Docker reports them now. */
export type ContainersState = "running" | "stopped" | "degraded";

/**
 * What Dokploy's list of a compose's containers says about a service that
 * should stay up. "degraded": some run while others died, keep restarting
 * or exited with an error. Exit codes do not matter once nothing runs:
 * stopping a compose leaves non-zero ones behind.
 */
export function containersState(containers: unknown): ContainersState {
  let running = 0;
  let restarting = 0;
  let broken = 0;
  for (const item of list(containers)) {
    const state = text(item.state);
    if (state === "running") running++;
    else if (state === "restarting") restarting++;
    else if (state === "dead") broken++;
    else if (state === "exited") {
      const code = /^Exited \((\d+)\)/.exec(text(item.status) ?? "")?.[1];
      if (code !== undefined && code !== "0") broken++;
    }
  }
  if (restarting > 0) return "degraded";
  if (running === 0) return "stopped";
  return broken > 0 ? "degraded" : "running";
}

/** Talks to the Dokploy server set by DOKPLOY_URL and DOKPLOY_API_KEY. */
export class DokployService {
  private async request(
    method: "GET" | "POST",
    path: string,
    payload?: Json,
    timeoutMs = TIMEOUT_MS,
  ): Promise<unknown> {
    if (!env.dokployUrl || !env.dokployApiKey) {
      throw new Error(
        "Dokploy is not set up. Add DOKPLOY_URL and DOKPLOY_API_KEY to the backend .env and restart it",
      );
    }

    const query =
      method === "GET" && payload
        ? `?${new URLSearchParams(payload as Record<string, string>).toString()}`
        : "";
    let response: Response;
    try {
      response = await fetch(`${env.dokployUrl}/api/${path}${query}`, {
        method,
        headers: {
          "x-api-key": env.dokployApiKey,
          accept: "application/json",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new DokployUnreachableError(
          `Dokploy did not answer ${path} within ${timeoutMs / 1000} seconds`,
        );
      }
      throw new DokployUnreachableError(
        `Could not reach Dokploy at ${env.dokployUrl}`,
      );
    }

    const raw = await response.text();
    let body: unknown = null;
    try {
      body = raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      if (response.ok) {
        throw new Error(
          "Dokploy sent something unreadable. Check that DOKPLOY_URL is the Dokploy address",
        );
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Dokploy rejected the API key (DOKPLOY_API_KEY)");
    }
    if (!response.ok) {
      const reason = isRecord(body) ? text(body.message) : null;
      throw new Error(
        `Dokploy ${path} failed (${response.status})${reason ? `: ${reason}` : ""}`,
      );
    }
    return body;
  }

  async listProjects(): Promise<DokployProjectOutDto[]> {
    return parseDokployProjects(await this.request("GET", "project.all"));
  }

  /** The environment of a project that deployments go into, with its composes. */
  async getEnvironment(projectId: string): Promise<DokployEnvironment> {
    const project = await this.request("GET", "project.one", { projectId });
    const environment = pickEnvironment(project);
    if (!environment) {
      throw new Error(
        `Dokploy project ${projectId} was not found or has no environment`,
      );
    }
    return environment;
  }

  async createCompose(input: {
    environmentId: string;
    name: string;
    composeFile: string;
  }): Promise<DokployCompose> {
    const created = await this.request("POST", "compose.create", {
      name: input.name,
      appName: input.name,
      environmentId: input.environmentId,
      composeType: "docker-compose",
      sourceType: "raw",
      composeFile: input.composeFile,
      description: "Managed by the app. Changes here may be overwritten.",
    });
    const compose = isRecord(created) ? parseCompose(created) : null;
    if (compose) return compose;

    // Older Dokploy versions answer with nothing: find it by name.
    const environments = await this.request("GET", "project.all");
    for (const project of list(environments)) {
      for (const environment of list(project.environments)) {
        if (environment.environmentId !== input.environmentId) continue;
        const found = list(environment.compose)
          .map(parseCompose)
          .find((item) => item?.name === input.name);
        if (found) return found;
      }
    }
    throw new Error("Dokploy created the compose but did not say its id");
  }

  /** True when the compose still exists in Dokploy. */
  async composeExists(composeId: string): Promise<boolean> {
    try {
      await this.request("GET", "compose.one", { composeId });
      return true;
    } catch (error) {
      if (error instanceof Error && /\((400|404)\)/.test(error.message)) {
        return false;
      }
      throw error;
    }
  }

  /** Whether the compose's containers are up right now. */
  async containersState(appName: string): Promise<ContainersState> {
    return containersState(
      await this.request("GET", "docker.getContainersByAppNameMatch", {
        appName,
        appType: "docker-compose",
      }),
    );
  }

  /** The hosts Dokploy has registered as domains of the compose. */
  async domainHosts(composeId: string): Promise<string[]> {
    const domains = list(
      await this.request("GET", "domain.byComposeId", { composeId }),
    );
    return domains.flatMap((item) => {
      const host = text(item.host);
      return host ? [host] : [];
    });
  }

  async updateCompose(
    composeId: string,
    input: { composeFile: string; env: string },
  ): Promise<void> {
    await this.request("POST", "compose.update", {
      composeId,
      composeFile: input.composeFile,
      env: input.env,
      sourceType: "raw",
      composeType: "docker-compose",
    });
  }

  /**
   * Makes the compose's domains exactly `domains`: removes the others and
   * creates the missing. HTTPS stays off: Cloudflare terminates TLS.
   */
  async syncDomains(
    composeId: string,
    domains: { serviceName: string; host: string; port: number }[],
  ): Promise<void> {
    const existing = list(
      await this.request("GET", "domain.byComposeId", { composeId }),
    );
    const matches = (item: Json, wanted: (typeof domains)[number]) =>
      item.host === wanted.host &&
      item.serviceName === wanted.serviceName &&
      Number(item.port) === wanted.port;

    for (const item of existing) {
      const domainId = text(item.domainId);
      if (domainId && !domains.some((wanted) => matches(item, wanted))) {
        await this.request("POST", "domain.delete", { domainId });
      }
    }
    for (const wanted of domains) {
      if (existing.some((item) => matches(item, wanted))) continue;
      await this.request("POST", "domain.create", {
        host: wanted.host,
        path: "/",
        port: wanted.port,
        https: false,
        certificateType: "none",
        composeId,
        serviceName: wanted.serviceName,
        domainType: "compose",
      });
    }
  }

  /**
   * Queues a deployment and waits until Dokploy says it finished. Throws
   * with Dokploy's reason when it fails or takes too long.
   */
  async deployAndWait(composeId: string, title: string): Promise<void> {
    const since = new Date();
    await this.request("POST", "compose.deploy", { composeId, title });

    while (Date.now() - since.getTime() < DEPLOY_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      const outcome = deploymentOutcome(
        await this.request("GET", "deployment.allByCompose", { composeId }),
        since,
      );
      if (outcome.status === "done") return;
      if (outcome.status === "error") throw new Error(outcome.message);

      if (Date.now() - since.getTime() > QUEUE_GRACE_MS) {
        // Not listed yet: fall back to the compose's own status.
        const compose = await this.request("GET", "compose.one", {
          composeId,
        });
        const status = isRecord(compose) ? compose.composeStatus : null;
        if (status === "error") {
          throw new Error("Dokploy marked the compose as failed");
        }
      }
    }
    throw new Error(
      `Dokploy did not finish deploying within ${DEPLOY_TIMEOUT_MS / 60_000} minutes`,
    );
  }

  /**
   * Runs a compose file whose containers do one job and exit: creates it
   * in the project under `name`, deploys it, waits for every container to
   * exit with code 0, and removes it again whatever happened. `name` must
   * be new each time: nothing that already exists is ever replaced or
   * removed here, so a job can never take a real deployment's place.
   */
  async runOnce(input: {
    projectId: string;
    name: string;
    composeFile: string;
    title: string;
  }): Promise<void> {
    const environment = await this.getEnvironment(input.projectId);
    if (environment.composes.some((item) => item.name === input.name)) {
      throw new Error(`Dokploy already has a compose named "${input.name}"`);
    }
    const compose = await this.createCompose({
      environmentId: environment.environmentId,
      name: input.name,
      composeFile: input.composeFile,
    });
    try {
      await this.updateCompose(compose.composeId, {
        composeFile: input.composeFile,
        env: "",
      });
      await this.deployAndWait(compose.composeId, input.title);
      await this.waitForExit(compose.appName || input.name);
    } finally {
      await this.deleteCompose(compose.composeId).catch(() => undefined);
    }
  }

  private async deleteCompose(composeId: string): Promise<void> {
    await this.request("POST", "compose.delete", {
      composeId,
      deleteVolumes: true,
    });
  }

  /** Waits until the compose project's containers have all exited with 0. */
  private async waitForExit(appName: string): Promise<void> {
    const since = Date.now();
    while (Date.now() - since < RUN_ONCE_TIMEOUT_MS) {
      const outcome = containersOutcome(
        await this.request("GET", "docker.getContainersByAppNameMatch", {
          appName,
          appType: "docker-compose",
        }),
      );
      if (outcome.status === "done") return;
      if (outcome.status === "error") throw new Error(outcome.message);
      if (
        outcome.status === "missing" &&
        Date.now() - since > CONTAINER_GRACE_MS
      ) {
        throw new Error(
          `Dokploy lists no container for ${appName}, so it is unknown whether the job ran`,
        );
      }
      await sleep(RUN_ONCE_POLL_MS);
    }
    throw new Error(
      `The job ${appName} did not finish within ${RUN_ONCE_TIMEOUT_MS / 60_000} minutes`,
    );
  }

  async stopCompose(composeId: string, appName: string): Promise<void> {
    await this.lifecycle("compose.stop", composeId, appName, "stopped");
  }

  async startCompose(composeId: string, appName: string): Promise<void> {
    await this.lifecycle("compose.start", composeId, appName, "running");
  }

  /**
   * Calls compose.stop or compose.start. When the answer is lost (slow
   * Docker, dropped connection), Docker's own view decides instead: the
   * containers often reach `wanted` a moment later.
   */
  private async lifecycle(
    path: "compose.stop" | "compose.start",
    composeId: string,
    appName: string,
    wanted: ContainersState,
  ): Promise<void> {
    try {
      await this.request("POST", path, { composeId }, LIFECYCLE_TIMEOUT_MS);
      return;
    } catch (error) {
      // An empty appName would match every compose's containers.
      if (!(error instanceof DokployUnreachableError) || !appName) throw error;
      const since = Date.now();
      while (Date.now() - since < LIFECYCLE_SETTLE_MS) {
        const state = await this.containersState(appName).catch(() => null);
        if (state === wanted) return;
        await sleep(LIFECYCLE_POLL_MS);
      }
      throw error;
    }
  }
}

export const dokployService = new DokployService();
