import { env } from "../../environment/env";

const API = "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One rule of a tunnel's ingress list. The last one has no hostname. */
export interface IngressRule extends Json {
  hostname?: string;
  service: string;
}

/** The ingress list with `hostname` routed to `service`, before the catch-all. */
export function withRoute(
  ingress: IngressRule[],
  hostname: string,
  service: string,
): IngressRule[] {
  const rules = ingress.filter((rule) => rule.hostname !== hostname);
  const catchAll = rules.findIndex((rule) => !rule.hostname);
  const route: IngressRule = { hostname, service, originRequest: {} };
  if (catchAll === -1) {
    return [...rules, route, { service: "http_status:404" }];
  }
  return [...rules.slice(0, catchAll), route, ...rules.slice(catchAll)];
}

export function withoutRoute(
  ingress: IngressRule[],
  hostname: string,
): IngressRule[] {
  return ingress.filter((rule) => rule.hostname !== hostname);
}

interface DnsRecord {
  id: string;
  type: string;
  content: string;
}

/**
 * Publishes hosts on the Cloudflare tunnel set by CLOUDFLARE_TUNNEL_ID: a
 * route in the tunnel's ingress and a proxied CNAME to the tunnel.
 */
export class CloudflareService {
  private zoneId: string | null = null;
  /** The ingress list is replaced whole, so changes go one at a time. */
  private queue: Promise<unknown> = Promise.resolve();

  private config() {
    const { cloudflareAccountId, cloudflareApiToken, cloudflareTunnelId } = env;
    if (
      !cloudflareAccountId ||
      !cloudflareApiToken ||
      !cloudflareTunnelId ||
      !env.deployDomain
    ) {
      throw new Error(
        "Cloudflare is not set up. Add DEPLOY_DOMAIN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and CLOUDFLARE_TUNNEL_ID to the backend .env and restart it",
      );
    }
    return {
      accountId: cloudflareAccountId,
      token: cloudflareApiToken,
      tunnelId: cloudflareTunnelId,
      domain: env.deployDomain,
    };
  }

  private async request(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    payload?: Json,
  ): Promise<unknown> {
    const { token } = this.config();
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Error("Could not reach the Cloudflare API");
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Reported below with the status.
    }
    if (!response.ok || !isRecord(body) || body.success !== true) {
      const errors =
        isRecord(body) && Array.isArray(body.errors)
          ? body.errors
              .filter(isRecord)
              .map((item) => `${String(item.message)} (${String(item.code)})`)
              .join("; ")
          : "";
      throw new Error(
        `Cloudflare ${method} ${path.split("?")[0]} failed (${response.status})${errors ? `: ${errors}` : ""}`,
      );
    }
    return body.result;
  }

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async getZoneId(): Promise<string> {
    if (this.zoneId) return this.zoneId;
    const { domain } = this.config();
    const zones = await this.request(
      "GET",
      `/zones?name=${encodeURIComponent(domain)}`,
    );
    const zone = Array.isArray(zones) ? zones.find(isRecord) : undefined;
    if (!zone || typeof zone.id !== "string") {
      throw new Error(
        `The Cloudflare account has no zone named ${domain} (DEPLOY_DOMAIN), or the token cannot read it`,
      );
    }
    this.zoneId = zone.id;
    return zone.id;
  }

  private async getIngress(): Promise<{
    config: Json;
    ingress: IngressRule[];
  }> {
    const { accountId, tunnelId } = this.config();
    const result = await this.request(
      "GET",
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    );
    const config =
      isRecord(result) && isRecord(result.config) ? result.config : {};
    const ingress = Array.isArray(config.ingress)
      ? config.ingress.filter(
          (rule): rule is IngressRule =>
            isRecord(rule) && typeof rule.service === "string",
        )
      : [];
    return { config, ingress };
  }

  private async putIngress(config: Json, ingress: IngressRule[]) {
    const { accountId, tunnelId } = this.config();
    await this.request(
      "PUT",
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      { config: { ...config, ingress } },
    );
  }

  private async dnsRecords(host: string): Promise<DnsRecord[]> {
    const zoneId = await this.getZoneId();
    const records = await this.request(
      "GET",
      `/zones/${zoneId}/dns_records?name=${encodeURIComponent(host)}`,
    );
    return (Array.isArray(records) ? records : [])
      .filter(isRecord)
      .map((record) => ({
        id: String(record.id),
        type: String(record.type),
        content: String(record.content),
      }));
  }

  private tunnelTarget(): string {
    return `${this.config().tunnelId}.cfargotunnel.com`;
  }

  /** Throws unless Cloudflare is set up and reachable with the token. */
  async checkAvailable(): Promise<void> {
    await this.getZoneId();
    await this.getIngress();
  }

  /** Whether a host already has a tunnel route or a DNS record. */
  async isHostInUse(host: string): Promise<boolean> {
    const [{ ingress }, records] = await Promise.all([
      this.getIngress(),
      this.dnsRecords(host),
    ]);
    return ingress.some((rule) => rule.hostname === host) || records.length > 0;
  }

  /** The hostnames the tunnel routes right now. */
  async routedHostnames(): Promise<Set<string>> {
    const { ingress } = await this.getIngress();
    return new Set(ingress.flatMap((rule) => rule.hostname ?? []));
  }

  /** Whether `host` has the DNS record that points it to the tunnel. */
  async pointsToTunnel(host: string): Promise<boolean> {
    const target = this.tunnelTarget();
    const records = await this.dnsRecords(host);
    return records.some(
      (record) => record.type === "CNAME" && record.content === target,
    );
  }

  /** Routes `host` through the tunnel to Dokploy's Traefik. Idempotent. */
  async addRoute(host: string): Promise<void> {
    const zoneId = await this.getZoneId();
    const target = this.tunnelTarget();
    const records = await this.dnsRecords(host);
    const ours = records.find(
      (record) => record.type === "CNAME" && record.content === target,
    );
    if (!ours) {
      if (records.length > 0) {
        throw new Error(
          `${host} already has a DNS record that does not point to the tunnel`,
        );
      }
      await this.request("POST", `/zones/${zoneId}/dns_records`, {
        type: "CNAME",
        name: host,
        content: target,
        proxied: true,
        comment: "Managed by the app's deployments",
      });
    }

    await this.serialized(async () => {
      const { config, ingress } = await this.getIngress();
      await this.putIngress(
        config,
        withRoute(ingress, host, env.cloudflareTunnelService),
      );
    });
  }

  /** Removes `host`'s tunnel route and its CNAME to the tunnel. Idempotent. */
  async removeRoute(host: string): Promise<void> {
    await this.serialized(async () => {
      const { config, ingress } = await this.getIngress();
      if (ingress.some((rule) => rule.hostname === host)) {
        await this.putIngress(config, withoutRoute(ingress, host));
      }
    });

    const zoneId = await this.getZoneId();
    const target = this.tunnelTarget();
    for (const record of await this.dnsRecords(host)) {
      if (record.type === "CNAME" && record.content === target) {
        await this.request(
          "DELETE",
          `/zones/${zoneId}/dns_records/${record.id}`,
        );
      }
    }
  }
}

export const cloudflareService = new CloudflareService();
