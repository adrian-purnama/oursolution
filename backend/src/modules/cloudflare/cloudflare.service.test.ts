import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withoutRoute,
  withRoute,
  type IngressRule,
} from "./cloudflare.service";

const TRAEFIK = "http://dokploy-traefik:80";

describe("tunnel ingress", () => {
  const existing: IngressRule[] = [
    { hostname: "n8n-prima-tech.amfphub.com", service: TRAEFIK },
    { service: "http_status:404" },
  ];

  it("adds a route before the catch-all and replaces an older one", () => {
    const added = withRoute(existing, "n8n-jo.amfphub.com", TRAEFIK);
    assert.deepEqual(
      added.map((rule) => rule.hostname ?? "*"),
      ["n8n-prima-tech.amfphub.com", "n8n-jo.amfphub.com", "*"],
    );
    assert.equal(
      withRoute(added, "n8n-jo.amfphub.com", TRAEFIK).length,
      added.length,
    );
  });

  it("adds the catch-all when the tunnel has none yet", () => {
    assert.deepEqual(withRoute([], "a.example.com", TRAEFIK).at(-1), {
      service: "http_status:404",
    });
  });

  it("removes only the given host", () => {
    assert.deepEqual(withoutRoute(existing, "n8n-prima-tech.amfphub.com"), [
      { service: "http_status:404" },
    ]);
  });
});
