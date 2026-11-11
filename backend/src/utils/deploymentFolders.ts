import { parse, stringify } from "yaml";

/** `$$`, `${NAME}`, `${NAME:-default}`, `${NAME-default}` or `$NAME`. */
const TOKEN = /\$\$|\$\{([^}]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;
const BRACED = /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?-)([^$]*))?$/;
/**
 * What a customer's own value (username, user ID, email) may look like
 * inside a path: one plain folder name. No "/", so it cannot reach into
 * another folder, and not "." or "..".
 */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._@+-]*$/;
/** Paths with anything else (control characters, quotes…) are left alone. */
const SAFE_PATH = /^\/[A-Za-z0-9._@+\-/ ]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fills variables the way Docker Compose does. Null when the text uses a
 * form this does not read (such as `${NAME:?error}`): better not to guess
 * a path that is about to be erased.
 */
function interpolate(
  text: string,
  env: Readonly<Record<string, string>>,
): { text: string; names: string[] } | null {
  if (text.replace(TOKEN, "").includes("$")) return null;
  const names: string[] = [];
  let readable = true;
  const rendered = text.replace(
    TOKEN,
    (match, braced?: string, bare?: string) => {
      if (match === "$$") return "$";
      const parts = bare ? [bare, bare] : BRACED.exec(braced ?? "");
      if (!parts) {
        readable = false;
        return "";
      }
      const [, name, operator, fallback] = parts;
      names.push(name);
      const value = env[name];
      if (operator === ":-") return value || (fallback ?? "");
      if (operator === "-") return value ?? fallback ?? "";
      return value ?? "";
    },
  );
  return readable ? { text: rendered, names } : null;
}

/** "source:target:mode" split at colons outside `${...}`. */
function splitMount(mount: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let index = 0; index < mount.length; index++) {
    const char = mount[index];
    if (char === "{" && mount[index - 1] === "$") depth++;
    else if (char === "}" && depth > 0) depth--;
    if (char === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  return [...parts, current];
}

/**
 * Everything the compose file takes from outside its containers, as
 * written: each service's volume sources, and the host folder behind a
 * named volume (`driver_opts.device`).
 */
function mountSources(composeFile: string): string[] {
  let doc: unknown;
  try {
    doc = parse(composeFile, { merge: true });
  } catch {
    return [];
  }
  if (!isRecord(doc)) return [];
  const sources: string[] = [];
  if (isRecord(doc.services)) {
    for (const service of Object.values(doc.services)) {
      if (!isRecord(service) || !Array.isArray(service.volumes)) continue;
      for (const volume of service.volumes as unknown[]) {
        if (typeof volume === "string") {
          const parts = splitMount(volume);
          if (parts.length >= 2) sources.push(parts[0]);
        } else if (isRecord(volume) && typeof volume.source === "string") {
          sources.push(volume.source);
        }
      }
    }
  }
  if (isRecord(doc.volumes)) {
    for (const volume of Object.values(doc.volumes)) {
      const options = isRecord(volume) ? volume.driver_opts : null;
      if (isRecord(options) && typeof options.device === "string") {
        sources.push(options.device);
      }
    }
  }
  return sources;
}

/** The variables used in volume sources: whoever sets them picks what is mounted. */
export function mountVariables(composeFile: string): string[] {
  const names = new Set<string>();
  for (const source of mountSources(composeFile)) {
    for (const match of source.matchAll(TOKEN)) {
      const name = match[2] ?? /^[A-Za-z_][A-Za-z0-9_]*/.exec(match[1] ?? "");
      if (typeof name === "string") names.add(name);
      else if (name) names.add(name[0]);
    }
  }
  return [...names];
}

function normalize(path: string): string {
  return path.replace(/\/+/g, "/").replace(/(?!^)\/$/, "");
}

/** True when `inner` is `outer` or somewhere inside it. */
export function isInside(inner: string, outer: string): boolean {
  return inner === outer || inner.startsWith(`${outer}/`);
}

/**
 * The folders customers' data may live in, from DEPLOY_DATA_ROOTS: a
 * comma-separated list such as "/mnt/nas-sd*, /srv/data". `*` stands for
 * part of one folder name. Entries that are not a real folder path (such
 * as "/") are dropped: they would allow everything.
 */
export function parseDataRoots(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => normalize(item.trim()))
    .filter(
      (root) =>
        /^\/[A-Za-z0-9._@+\-/*]+$/.test(root) &&
        !root.split("/").some((part) => part === "." || part === "..") &&
        root.split("/").some((part) => /[A-Za-z0-9]/.test(part)),
    );
}

/** True when `path` is strictly inside one of the roots, never a root itself. */
export function isUnderDataRoot(
  path: string,
  roots: readonly string[],
): boolean {
  return roots.some((root) => {
    const pattern = root
      .split("*")
      .map((piece) => piece.replace(/[.+\-/@]/g, "\\$&"))
      .join("[^/]*");
    return new RegExp(`^${pattern}/[^/]`).test(path);
  });
}

/**
 * Every absolute host path the compose file mounts for one customer. Null
 * when a source cannot be read, so nothing can be said for sure.
 */
export function hostPaths(
  composeFile: string,
  env: Readonly<Record<string, string>>,
): string[] | null {
  const paths = new Set<string>();
  for (const source of mountSources(composeFile)) {
    const rendered = interpolate(source, env);
    if (!rendered) return null;
    if (rendered.text.startsWith("/")) paths.add(normalize(rendered.text));
  }
  return [...paths];
}

export interface CustomerFolders {
  /** Host folders that hold this customer's data and nobody else's. */
  folders: string[];
  /** Mounted host paths that are left alone, and why. */
  skipped: { path: string; reason: string }[];
}

/**
 * The host folders a reset may empty for one customer. It fails closed: a
 * path is taken only when all of this holds, else it is left alone.
 *
 * - It is absolute and inside one of `roots` (DEPLOY_DATA_ROOTS).
 * - It is different for every customer: it is rendered for this customer
 *   (`env`) and for a made-up other one (`otherEnv`), and one that comes
 *   out the same is shared.
 * - The customer cannot steer it: no variable they can edit, and their own
 *   values (username, email…) are one plain folder name each.
 * - No other path the compose file mounts is it, or inside it.
 *
 * One mount that cannot be read at all means no folder is taken.
 */
export function customerFolders(
  composeFile: string,
  env: Readonly<Record<string, string>>,
  otherEnv: Readonly<Record<string, string>>,
  editable: ReadonlySet<string>,
  roots: readonly string[],
): CustomerFolders {
  const candidates = new Set<string>();
  const others = new Set<string>();
  const skipped = new Map<string, string>();
  let unreadable = false;

  for (const source of mountSources(composeFile)) {
    const mine = interpolate(source, env);
    const theirs = interpolate(source, otherEnv);
    if (!mine || !theirs) {
      unreadable = true;
      skipped.set(source, "uses a kind of variable that cannot be read");
      continue;
    }
    // Named volumes and paths relative to the compose file are not host folders.
    if (!mine.text.startsWith("/")) continue;

    const path = normalize(mine.text);
    const parts = path.split("/").filter(Boolean);
    const steered = mine.names.find(
      (name) =>
        env[name] !== otherEnv[name] && !SAFE_SEGMENT.test(env[name] ?? ""),
    );
    let reason: string | null = null;
    if (mine.names.some((name) => editable.has(name))) {
      reason = "uses a variable the customer can change";
    } else if (steered) {
      reason = `\${${steered}} is not one plain folder name for this customer`;
    } else if (parts.includes("..") || parts.includes(".")) {
      reason = 'has "." or ".." in it';
    } else if (!SAFE_PATH.test(path)) {
      reason = "has unusual characters in it";
    } else if (path === normalize(theirs.text)) {
      reason = "is shared by every customer";
    } else if (!isUnderDataRoot(path, roots)) {
      reason =
        roots.length === 0
          ? "DEPLOY_DATA_ROOTS is not set in the backend .env"
          : "is not inside a folder listed in DEPLOY_DATA_ROOTS";
    }
    if (reason) {
      skipped.set(path, reason);
      others.add(path);
    } else {
      candidates.add(path);
    }
  }

  const folders: string[] = [];
  for (const path of [...candidates].sort()) {
    const inside = [...others].find((other) => isInside(other, path));
    if (unreadable) {
      skipped.set(path, "another mount in the compose file cannot be read");
    } else if (inside) {
      skipped.set(path, `holds ${inside}, which is not this customer's only`);
    } else if (!folders.some((parent) => isInside(path, parent))) {
      // A folder inside one already taken goes with its parent.
      folders.push(path);
    }
  }
  return {
    folders,
    skipped: [...skipped].map(([path, reason]) => ({ path, reason })),
  };
}

/**
 * A compose file whose only container empties `folders` and exits. The
 * folders themselves stay, as the services expect them to exist. `find`
 * does not follow links, so a link a customer planted in their folder is
 * removed, not what it points to; and the container sees nothing of the
 * host but these folders.
 */
export function wipeComposeFile(folders: readonly string[]): string {
  const targets = folders.map((_folder, index) => `/wipe/${index}`);
  return stringify({
    services: {
      wipe: {
        image: "busybox:1.36",
        restart: "no",
        network_mode: "none",
        read_only: true,
        security_opt: ["no-new-privileges:true"],
        command: ["find", ...targets, "-xdev", "-mindepth", "1", "-delete"],
        volumes: folders.map((folder, index) => ({
          type: "bind",
          // Compose reads "$" as a variable; "$$" is a plain one.
          source: folder.replace(/\$/g, "$$$$"),
          target: targets[index],
        })),
      },
    },
  });
}
