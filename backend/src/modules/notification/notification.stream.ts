import type { NotificationOutDto } from "../../dto/notification.dto";

/** One open SSE response (an Express Response satisfies this). */
export interface SseClient {
  write(chunk: string): boolean;
  end(): unknown;
}

export const MAX_STREAMS_PER_USER = 5;
export const HEARTBEAT_MS = 25_000;

/** One `notification` event; its id is the notification's id. */
export function formatNotificationEvent(
  notification: NotificationOutDto,
): string {
  // JSON.stringify escapes line breaks, so data stays on one line.
  return `id: ${notification.id}\nevent: notification\ndata: ${JSON.stringify(notification)}\n\n`;
}

/**
 * Open notification streams per user, in this process only. Each user may
 * keep a few (several tabs); a new one past the cap closes the oldest.
 */
export class NotificationStreamHub {
  private readonly clients = new Map<string, SseClient[]>();

  constructor(private readonly maxPerUser = MAX_STREAMS_PER_USER) {}

  /** Registers a stream; returns the function that removes it. */
  add(userId: string, client: SseClient): () => void {
    const list = this.clients.get(userId) ?? [];
    list.push(client);
    this.clients.set(userId, list);
    while (list.length > this.maxPerUser) {
      const oldest = list.shift();
      oldest?.end();
    }
    return () => this.remove(userId, client);
  }

  remove(userId: string, client: SseClient): void {
    const list = this.clients.get(userId);
    if (!list) return;
    const index = list.indexOf(client);
    if (index >= 0) list.splice(index, 1);
    if (list.length === 0) this.clients.delete(userId);
  }

  count(userId: string): number {
    return this.clients.get(userId)?.length ?? 0;
  }

  /** Sends to every open stream of the user; returns how many got it. */
  publish(userId: string, notification: NotificationOutDto): number {
    const list = this.clients.get(userId);
    if (!list) return 0;
    const event = formatNotificationEvent(notification);
    let sent = 0;
    for (const client of [...list]) {
      try {
        client.write(event);
        sent += 1;
      } catch {
        this.remove(userId, client);
      }
    }
    return sent;
  }
}

export const notificationStreams = new NotificationStreamHub();
