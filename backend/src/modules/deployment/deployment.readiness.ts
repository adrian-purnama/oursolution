/** How long a fresh deploy may take to start answering. */
const READY_TIMEOUT_MS = 5 * 60_000;
const READY_POLL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * Whether an HTTP status means the service itself answered, the way the
 * Uptime Kuma monitors count it: a sign-in wall is up. 404 is not: Traefik
 * says it while the route is not there yet, as Cloudflare says 52x while
 * nothing answers behind the tunnel.
 */
export function answered(status: number): boolean {
  return (status >= 200 && status < 400) || status === 401 || status === 403;
}

async function answers(host: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${host}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return answered(response.status);
  } catch {
    return false;
  }
}

/**
 * Waits until every host answers over HTTPS, so a run ends when the
 * service can be used and its first uptime check is not a false outage.
 * Returns the hosts still silent after the time allowed.
 */
export async function waitUntilAnswering(hosts: string[]): Promise<string[]> {
  let silent = [...new Set(hosts)];
  const since = Date.now();
  while (silent.length > 0) {
    const results = await Promise.all(silent.map(answers));
    silent = silent.filter((_, index) => !results[index]);
    if (silent.length === 0 || Date.now() - since >= READY_TIMEOUT_MS) break;
    await sleep(READY_POLL_MS);
  }
  return silent;
}
