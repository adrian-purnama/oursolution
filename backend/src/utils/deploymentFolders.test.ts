import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse } from "yaml";
import {
  customerFolders,
  hostPaths,
  isInside,
  isUnderDataRoot,
  mountVariables,
  parseDataRoots,
  wipeComposeFile,
} from "./deploymentFolders";

const JO = { USERNAME: "jo", DATA_ROOT: "/mnt/nas-sda", FOLDER: "mine" };
const OTHER = { USERNAME: "-", DATA_ROOT: "/mnt/nas-sda", FOLDER: "theirs" };
const NONE = new Set<string>();
const ROOTS = ["/mnt/nas-sd*"];

function compose(volumes: string[]): string {
  return [
    "services:",
    "  app:",
    "    image: n8n",
    "    volumes:",
    ...volumes.map((volume) => `      - ${volume}`),
    "volumes:",
    "  cache:",
  ].join("\n");
}

function foldersOf(
  volumes: string[],
  env: Record<string, string> = JO,
  roots: string[] = ROOTS,
) {
  return customerFolders(compose(volumes), env, OTHER, NONE, roots);
}

describe("customerFolders", () => {
  it("finds the host folders that differ per customer", () => {
    const result = foldersOf([
      "/mnt/nas-sda/n8n/${USERNAME}/data:/home/node/.n8n",
      "${DATA_ROOT}/pg/$USERNAME:/var/lib/postgresql/data:rw",
      "cache:/cache",
      "./local:/local",
    ]);
    assert.deepEqual(result.folders, [
      "/mnt/nas-sda/n8n/jo/data",
      "/mnt/nas-sda/pg/jo",
    ]);
    assert.deepEqual(result.skipped, []);
  });

  it("never takes a folder every customer shares", () => {
    const result = foldersOf([
      "/var/run/docker.sock:/var/run/docker.sock",
      "/mnt/nas-sda/shared:/shared",
    ]);
    assert.deepEqual(result.folders, []);
    assert.deepEqual(
      result.skipped.map((item) => item.reason),
      ["is shared by every customer", "is shared by every customer"],
    );
  });

  it("takes nothing outside DEPLOY_DATA_ROOTS, or without it", () => {
    assert.deepEqual(foldersOf(["/etc/${USERNAME}:/a"]).folders, []);
    assert.deepEqual(foldersOf(["/mnt/${USERNAME}:/a"]).folders, []);
    // A root itself is never a customer's folder.
    assert.deepEqual(
      foldersOf(["/mnt/nas-sd${USERNAME}:/a"], { ...JO, USERNAME: "a" })
        .folders,
      [],
    );
    const unset = foldersOf(["/mnt/nas-sda/${USERNAME}:/a"], JO, []);
    assert.deepEqual(unset.folders, []);
    assert.match(unset.skipped[0]?.reason ?? "", /DEPLOY_DATA_ROOTS/);
  });

  it("leaves out paths the customer could steer", () => {
    const editable = customerFolders(
      compose(["/mnt/nas-sda/${FOLDER}:/data"]),
      JO,
      OTHER,
      new Set(["FOLDER"]),
      ROOTS,
    );
    assert.deepEqual(editable.folders, []);
    assert.equal(
      editable.skipped[0]?.reason,
      "uses a variable the customer can change",
    );

    // An email with "/" in it must not reach into someone else's folder.
    for (const EMAIL of ["a/../victim@x.com", "victim/data", "..", ""]) {
      const result = customerFolders(
        compose(["/mnt/nas-sda/${EMAIL}:/data"]),
        { EMAIL },
        { EMAIL: "-@-" },
        NONE,
        ROOTS,
      );
      assert.deepEqual(result.folders, [], EMAIL);
    }
  });

  it("leaves out a folder that holds something not the customer's", () => {
    // A customer named "shared" must not empty what everyone shares.
    const result = foldersOf(
      ["/mnt/nas-sda/${USERNAME}:/data", "/mnt/nas-sda/shared/models:/models"],
      { ...JO, USERNAME: "shared" },
    );
    assert.deepEqual(result.folders, []);
    assert.match(
      result.skipped.find((item) => item.path === "/mnt/nas-sda/shared")
        ?.reason ?? "",
      /holds \/mnt\/nas-sda\/shared\/models/,
    );
  });

  it("takes nothing when any mount cannot be read", () => {
    const result = foldersOf([
      "/mnt/nas-sda/${USERNAME}:/a",
      "/mnt/nas-sda/${USERNAME:?missing}:/c",
    ]);
    assert.deepEqual(result.folders, []);
  });

  it("leaves out paths that climb", () => {
    assert.deepEqual(
      foldersOf(["/mnt/nas-sda/${USERNAME}/../other:/a"]).folders,
      [],
    );
  });

  it("reads defaults, the long form and volume devices, and folds nested folders", () => {
    const file = [
      "services:",
      "  app:",
      "    volumes:",
      "      - ${ROOT:-/mnt/nas-sdb}/${USERNAME}:/data",
      "      - type: bind",
      "        source: /mnt/nas-sdb/${USERNAME}/files/",
      "        target: /files",
      "      - pg:/var/lib/postgresql/data",
      "volumes:",
      "  pg:",
      "    driver_opts:",
      "      type: none",
      "      o: bind",
      "      device: /mnt/nas-sda/pg/${USERNAME}",
    ].join("\n");
    assert.deepEqual(customerFolders(file, JO, OTHER, NONE, ROOTS).folders, [
      "/mnt/nas-sda/pg/jo",
      "/mnt/nas-sdb/jo",
    ]);
  });

  it("finds nothing in a file that is not YAML", () => {
    assert.deepEqual(
      customerFolders("a: [", JO, OTHER, NONE, ROOTS).folders,
      [],
    );
  });
});

describe("hostPaths", () => {
  it("lists every absolute path, or null when one cannot be read", () => {
    assert.deepEqual(
      hostPaths(compose(["/mnt/a/${USERNAME}/:/a", "cache:/c", "/x:/x"]), JO),
      ["/mnt/a/jo", "/x"],
    );
    assert.equal(hostPaths(compose(["/mnt/${A:?no}:/a"]), JO), null);
  });
});

describe("mountVariables", () => {
  it("names the variables that decide what is mounted", () => {
    assert.deepEqual(
      mountVariables(
        compose(["${ROOT:-/mnt}/$USERNAME:/data", "${VOL}:/x", "cache:/c"]),
      ).sort(),
      ["ROOT", "USERNAME", "VOL"],
    );
  });
});

describe("data roots", () => {
  it("drops entries that would allow everything", () => {
    assert.deepEqual(
      parseDataRoots(" /mnt/nas-sd*/ , /, /*, ../x, /srv/data,relative"),
      ["/mnt/nas-sd*", "/srv/data"],
    );
    assert.deepEqual(parseDataRoots(undefined), []);
  });

  it("matches only paths strictly inside a root", () => {
    assert.equal(isUnderDataRoot("/mnt/nas-sda/jo", ROOTS), true);
    assert.equal(isUnderDataRoot("/mnt/nas-sda", ROOTS), false);
    assert.equal(isUnderDataRoot("/mnt/nas-sda/", ROOTS), false);
    assert.equal(isUnderDataRoot("/mnt/other/jo", ROOTS), false);
    assert.equal(isUnderDataRoot("/x/mnt/nas-sda/jo", ROOTS), false);
    assert.equal(isUnderDataRoot("/srv/dataX/jo", ["/srv/data"]), false);
  });
});

describe("isInside", () => {
  it("goes by whole folder names", () => {
    assert.equal(isInside("/a/jo/x", "/a/jo"), true);
    assert.equal(isInside("/a/jo", "/a/jo"), true);
    assert.equal(isInside("/a/jo2", "/a/jo"), false);
  });
});

describe("wipeComposeFile", () => {
  it("mounts each folder and empties it without removing it", () => {
    const doc = parse(wipeComposeFile(["/mnt/nas/jo", "/mnt/nas/pg$1"])) as {
      services: {
        wipe: {
          command: string[];
          network_mode: string;
          volumes: { source: string; target: string }[];
        };
      };
    };
    const { command, volumes, network_mode } = doc.services.wipe;
    assert.equal(network_mode, "none");
    assert.deepEqual(command, [
      "find",
      "/wipe/0",
      "/wipe/1",
      "-xdev",
      "-mindepth",
      "1",
      "-delete",
    ]);
    assert.deepEqual(volumes, [
      { type: "bind", source: "/mnt/nas/jo", target: "/wipe/0" },
      { type: "bind", source: "/mnt/nas/pg$$1", target: "/wipe/1" },
    ]);
  });
});
