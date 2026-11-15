import { io, type Socket } from "socket.io-client";
import type {
  ServiceBeatOutDto,
  ServiceCheckState,
} from "../../dto/deployment.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";

const SOURCE = "modules/uptimeKuma/uptimeKuma.service.ts";
const TIMEOUT_MS = 10_000;
/** How long to wait, after signing in, for Kuma to say its version. */
const VERSION_WAIT_MS = 3_000;
/** A monitor's status is asked from Kuma at most this often. */
const STATUS_TTL_MS = 30_000;
/** A page waits this long for Kuma, then shows no status. */
const STATUS_WAIT_MS = 4_000;
const PERIOD_HOURS = 24;
const BEATS_SHOWN = 30;
const CHECK_EVERY_SECONDS = 5 * 60;
/** After a failed check, the next comes sooner, so an outage shows fast. */
const RETRY_EVERY_SECONDS = 60;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** What a monitor's checks of the last 24 hours add up to. */
export interface MonitorStatus {
  state: ServiceCheckState;
  /** Share of checks that were up, 0 to 1. Null before the first check. */
  uptime: number | null;
  /** Average response time of the checks that were up. */
  responseMs: number | null;
  checkedAt: string | null;
  /** The latest checks, oldest first. */
  beats: ServiceBeatOutDto[];
}

// Kuma's heartbeat status numbers.
const STATES: Record<number, ServiceCheckState> = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance",
};

/** Kuma stores times in UTC as "2026-01-31 12:00:00.000". */
function toIso(time: unknown): string | null {
  if (typeof time !== "string") return null;
  const date = new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(time) ? time : `${time.replace(" ", "T")}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Sums up Kuma's heartbeat rows (oldest first) for the dashboard. */
export function summarizeBeats(rows: unknown[]): MonitorStatus {
  const beats: (ServiceBeatOutDto & { ping: number | null })[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const state = STATES[Number(row.status)];
    const at = toIso(row.time);
    if (!state || !at) continue;
    const ping = Number(row.ping);
    beats.push({
      state,
      at,
      ping: row.ping !== null && Number.isFinite(ping) ? ping : null,
    });
  }

  const up = beats.filter((beat) => beat.state === "up");
  const down = beats.filter((beat) => beat.state === "down");
  const pings = up.flatMap((beat) => (beat.ping === null ? [] : [beat.ping]));
  const counted = up.length + down.length;
  const latest = beats.at(-1);

  return {
    state: latest?.state ?? "pending",
    uptime: counted > 0 ? up.length / counted : null,
    responseMs:
      pings.length > 0
        ? Math.round(pings.reduce((sum, ping) => sum + ping, 0) / pings.length)
        : null,
    checkedAt: latest?.at ?? null,
    beats: beats.slice(-BEATS_SHOWN).map(({ state, at }) => ({ state, at })),
  };
}

/**
 * The monitor Kuma is asked to create for a host. Kuma saves the object's
 * keys as database columns, so it holds only columns that version has:
 * version 2 added `conditions` and `rabbitmqNodes`.
 */
export function monitorPayload(host: string, majorVersion: number): Json {
  return {
    type: "http",
    name: host,
    url: `https://${host}`,
    method: "GET",
    interval: CHECK_EVERY_SECONDS,
    retryInterval: RETRY_EVERY_SECONDS,
    resendInterval: 0,
    // One retry before "down", so a single slow answer is not an outage.
    maxretries: 1,
    timeout: 48,
    notificationIDList: {},
    ignoreTls: false,
    upsideDown: false,
    expiryNotification: false,
    maxredirects: 10,
    // A service that answers with its sign-in wall is up.
    accepted_statuscodes: ["200-299", "300-399", "401", "403"],
    kafkaProducerBrokers: [],
    kafkaProducerSaslOptions: { mechanism: "None" },
    ...(majorVersion >= 2 ? { conditions: [], rabbitmqNodes: [] } : {}),
  };
}

/**
 * Uptime Kuma, which checks that deployed services answer. Kuma has no REST
 * API for monitors: this signs in over its Socket.IO connection, the way
 * its own pages do. One connection is kept and reopened when it drops.
 */
export class UptimeKumaService {
  private socket: Socket | null = null;
  private connecting: Promise<Socket> | null = null;
  private majorVersion = 2;
  private statuses = new Map<
    number,
    { at: number; status: MonitorStatus | null }
  >();

  /** True when the backend .env has Kuma's address and account. */
  get configured(): boolean {
    return Boolean(
      env.uptimeKumaUrl && env.uptimeKumaUsername && env.uptimeKumaPassword,
    );
  }

  private connection(): Promise<Socket> {
    if (this.socket?.connected) return Promise.resolve(this.socket);
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(): Promise<Socket> {
    const { uptimeKumaUrl, uptimeKumaUsername, uptimeKumaPassword } = env;
    if (!uptimeKumaUrl || !uptimeKumaUsername || !uptimeKumaPassword) {
      throw new Error(
        "Uptime Kuma is not set up. Add UPTIME_KUMA_URL, UPTIME_KUMA_USERNAME and UPTIME_KUMA_PASSWORD to the backend .env and restart it",
      );
    }

    const socket = io(uptimeKumaUrl, {
      transports: ["websocket"],
      reconnection: false,
      timeout: TIMEOUT_MS,
    });
    // Kuma sends "info" with its version once signed in.
    const version = new Promise<string | null>((resolve) => {
      socket.on("info", (info: unknown) => {
        if (isRecord(info) && typeof info.version === "string") {
          resolve(info.version);
        }
      });
      socket.once("disconnect", () => resolve(null));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", () =>
          reject(new Error(`Could not reach Uptime Kuma at ${uptimeKumaUrl}`)),
        );
      });
      const reply = await this.ask(socket, "login", {
        username: uptimeKumaUsername,
        password: uptimeKumaPassword,
        token: "",
      });
      if (isRecord(reply) && reply.tokenRequired === true) {
        throw new Error(
          "The Uptime Kuma account uses two-factor sign-in. Use an account without it for UPTIME_KUMA_USERNAME",
        );
      }
      if (!isRecord(reply) || reply.ok !== true) {
        throw new Error(
          "Uptime Kuma refused the sign-in. Check UPTIME_KUMA_USERNAME and UPTIME_KUMA_PASSWORD",
        );
      }
      const seen = await Promise.race([
        version,
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), VERSION_WAIT_MS),
        ),
      ]);
      const major = Number.parseInt(seen ?? "", 10);
      if (Number.isFinite(major)) this.majorVersion = major;
    } catch (error) {
      socket.close();
      throw error;
    }

    socket.on("disconnect", () => {
      if (this.socket === socket) this.socket = null;
    });
    this.socket = socket;
    return socket;
  }

  /** Sends an event and waits for Kuma's answer, whatever it is. */
  private ask(
    socket: Socket,
    event: string,
    ...args: unknown[]
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      socket
        .timeout(TIMEOUT_MS)
        .emit(event, ...args, (error: Error | null, reply: unknown) => {
          if (error) {
            reject(new Error(`Uptime Kuma did not answer "${event}" in time`));
          } else {
            resolve(reply);
          }
        });
    });
  }

  /** Like `ask`, signed in, and throws unless Kuma answers `ok`. */
  private async call(event: string, ...args: unknown[]): Promise<Json> {
    const socket = await this.connection();
    const reply = await this.ask(socket, event, ...args);
    if (!isRecord(reply) || reply.ok !== true) {
      const reason =
        isRecord(reply) && typeof reply.msg === "string" ? reply.msg : "";
      throw new Error(
        `Uptime Kuma "${event}" failed${reason ? `: ${reason}` : ""}`,
      );
    }
    return reply;
  }

  /**
   * Makes sure `host` is being checked and returns its monitor's ID. A
   * known monitor is resumed; one that is gone from Kuma is made again.
   */
  async ensureMonitor(host: string, monitorId: number | null): Promise<number> {
    if (monitorId !== null) {
      try {
        await this.call("resumeMonitor", monitorId);
        this.statuses.delete(monitorId);
        return monitorId;
      } catch (error) {
        logger.warn(
          `Monitor ${monitorId} for ${host} could not be resumed (${messageOf(error)}); creating a new one`,
          SOURCE,
          "ensureMonitor",
        );
      }
    }
    // Before `add`, so the version is known for the payload.
    await this.connection();
    const reply = await this.call(
      "add",
      monitorPayload(host, this.majorVersion),
    );
    const created = Number(reply.monitorID);
    if (!Number.isInteger(created)) {
      throw new Error("Uptime Kuma did not return the new monitor's ID");
    }
    return created;
  }

  /** Stops checking without losing the monitor's history. */
  async pauseMonitor(monitorId: number): Promise<void> {
    await this.call("pauseMonitor", monitorId);
    this.statuses.delete(monitorId);
  }

  async deleteMonitor(monitorId: number): Promise<void> {
    await this.call("deleteMonitor", monitorId);
    this.statuses.delete(monitorId);
  }

  /**
   * How the monitor did over the last 24 hours, or null when Kuma cannot
   * say. Never throws: a page must load without Kuma.
   */
  async status(monitorId: number): Promise<MonitorStatus | null> {
    const cached = this.statuses.get(monitorId);
    if (cached && Date.now() - cached.at < STATUS_TTL_MS) return cached.status;

    let status: MonitorStatus | null = null;
    try {
      const reply = await Promise.race([
        this.call("getMonitorBeats", monitorId, PERIOD_HOURS),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Uptime Kuma took too long")),
            STATUS_WAIT_MS,
          ),
        ),
      ]);
      status = summarizeBeats(Array.isArray(reply.data) ? reply.data : []);
    } catch (error) {
      logger.warn(
        `Could not read monitor ${monitorId}: ${messageOf(error)}`,
        SOURCE,
        "status",
      );
    }
    this.statuses.set(monitorId, { at: Date.now(), status });
    return status;
  }
}

export const uptimeKumaService = new UptimeKumaService();
