import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASE_VARIANT_ID,
  type ProductDeployment,
  type ProductVariant,
} from "../../models/product/product.interface";
import {
  deploymentFor,
  fitVariants,
  removedVariantIds,
  variantIdOf,
  variantOf,
  variantsOf,
  type VariantHost,
} from "./product.variants";

const compose = (memory: string, extraVolume = "") => `services:
  mc:
    image: itzg/minecraft-server:2024.10.0
    environment:
      - MEMORY=${memory}
    volumes:
      - /mnt/data/mc/\${USERNAME}:/data
${extraVolume}`;

const DEPLOYMENT: ProductDeployment = {
  type: "dockerCompose",
  projectId: "p1",
  name: "mc-${USERNAME}",
  composeFile: compose("2G"),
  variables: [],
  domains: [],
  commands: [
    {
      id: "c1",
      label: "Say hi",
      serviceName: "mc",
      command: "rcon-cli say hi",
    },
  ],
};

const variant = (over: Partial<ProductVariant> = {}): ProductVariant => ({
  id: "big",
  name: "4 cores / 4 GB",
  specs: "",
  pricingText: "",
  description: "",
  priceIdr: 100_000,
  durationDays: 30,
  deployment: null,
  composeFile: null,
  ...over,
});

const host = (over: Partial<VariantHost> = {}): VariantHost => ({
  kind: "subscription",
  name: "Minecraft",
  priceIdr: 50_000,
  durationDays: 30,
  pricingText: "Rp 50.000 / month",
  description: "About Minecraft",
  deployment: DEPLOYMENT,
  variantName: "2 cores / 2 GB",
  variantSpecs: "",
  variants: [variant()],
  ...over,
});

describe("variantsOf / variantOf", () => {
  it("puts the base variant, made of the product's own values, first", () => {
    const [base, big] = variantsOf(host());
    assert.equal(base.id, BASE_VARIANT_ID);
    assert.equal(base.priceIdr, 50_000);
    assert.equal(base.composeFile, DEPLOYMENT.composeFile);
    assert.equal(big.id, "big");
    // No own compose file: it deploys the product's.
    assert.equal(big.composeFile, DEPLOYMENT.composeFile);
  });

  it("shows the product's description unless a variant has its own", () => {
    const [base, big] = variantsOf(host());
    assert.equal(base.pricingText, "Rp 50.000 / month");
    assert.equal(big.pricingText, "");
    assert.equal(big.description, "About Minecraft");
    const own = variantOf(
      host({ variants: [variant({ description: "More RAM" })] }),
      "big",
    );
    assert.equal(own?.description, "More RAM");
  });

  it("names the base after the product when it has no name of its own", () => {
    assert.equal(variantsOf(host({ variantName: " " }))[0].name, "Minecraft");
  });

  it("treats a missing id as the base and an unknown one as gone", () => {
    assert.equal(variantIdOf(undefined), BASE_VARIANT_ID);
    assert.equal(variantOf(host(), null)?.id, BASE_VARIANT_ID);
    assert.equal(variantOf(host(), "big")?.priceIdr, 100_000);
    assert.equal(variantOf(host(), "nope"), null);
  });

  it("gives no compose file when the product deploys nothing", () => {
    const big = variantOf(
      host({ deployment: null, variants: [variant({ composeFile: "x" })] }),
      "big",
    );
    assert.equal(big?.composeFile, null);
  });
});

describe("variant deployment settings", () => {
  const own = {
    composeFile: compose("4G"),
    variables: [{ key: "SEED", value: "1", visibility: "editable" as const }],
    domains: [],
    commands: [],
  };

  it("uses the variant's own settings with the product's project and name", () => {
    const settings = deploymentFor(
      host({ variants: [variant({ deployment: own })] }),
      "big",
    );
    assert.equal(settings?.projectId, "p1");
    assert.equal(settings?.name, "mc-${USERNAME}");
    assert.deepEqual(
      settings?.variables.map(({ key }) => key),
      ["SEED"],
    );
    assert.deepEqual(settings?.commands, []);
  });

  it("falls back to the product's for the base or a gone variant", () => {
    assert.equal(deploymentFor(host(), null), DEPLOYMENT);
    assert.equal(deploymentFor(host(), "nope"), DEPLOYMENT);
  });

  it("keeps a legacy compose-only variant on the product's other settings", () => {
    const settings = deploymentFor(
      host({ variants: [variant({ composeFile: compose("4G") })] }),
      "big",
    );
    assert.equal(settings?.commands.length, 1);
    assert.match(settings?.composeFile ?? "", /MEMORY=4G/);
  });

  it("checks own settings and stores them re-indented", () => {
    const [fitted] = fitVariants(
      host({ variants: [variant({ deployment: own })] }),
    );
    assert.equal(fitted.composeFile, null);
    assert.match(fitted.deployment?.composeFile ?? "", /MEMORY=4G/);
    assert.throws(
      () =>
        fitVariants(
          host({
            variants: [
              variant({
                deployment: {
                  ...own,
                  commands: [
                    { id: "x", label: "X", serviceName: "nope", command: "ls" },
                  ],
                },
              }),
            ],
          }),
        ),
      /not in this variant's compose file/,
    );
  });
});

describe("fitVariants", () => {
  it("accepts a variant with its own compose that mounts the same data", () => {
    const [fitted] = fitVariants(
      host({ variants: [variant({ composeFile: compose("4G") })] }),
    );
    assert.match(fitted.composeFile ?? "", /MEMORY=4G/);
  });

  it("refuses a compose file that mounts other data", () => {
    assert.throws(
      () =>
        fitVariants(
          host({
            variants: [
              variant({
                composeFile: compose("4G", "      - /mnt/data/other:/x\n"),
              }),
            ],
          }),
        ),
      /same volumes/,
    );
  });

  it("refuses a compose file without the service a command runs in", () => {
    const renamed = compose("4G").replace("  mc:", "  server:");
    assert.throws(
      () =>
        fitVariants(host({ variants: [variant({ composeFile: renamed })] })),
      /not in this variant's compose file/,
    );
  });

  it("needs a named base and unique names and ids", () => {
    assert.throws(() => fitVariants(host({ variantName: "" })), /base variant/);
    assert.throws(
      () =>
        fitVariants(host({ variants: [variant({ name: "2 Cores / 2 GB" })] })),
      /this name/,
    );
    assert.throws(
      () => fitVariants(host({ variants: [variant({ id: BASE_VARIANT_ID })] })),
      /same id/,
    );
    assert.throws(
      () =>
        fitVariants(
          host({ variants: [variant(), variant({ name: "8 cores" })] }),
        ),
      /same id/,
    );
  });

  it("allows variants only on subscriptions, and own compose only with a deployment", () => {
    assert.throws(() => fitVariants(host({ kind: "oneTime" })), /subscription/);
    assert.throws(
      () =>
        fitVariants(
          host({
            deployment: null,
            variants: [variant({ composeFile: compose("4G") })],
          }),
        ),
      /deploys nothing/,
    );
    assert.deepEqual(fitVariants(host({ kind: "oneTime", variants: [] })), []);
  });
});

describe("removedVariantIds", () => {
  it("lists the ids that are gone", () => {
    assert.deepEqual(
      removedVariantIds([{ id: "a" }, { id: "b" }], [{ id: "b" }]),
      ["a"],
    );
  });
});
