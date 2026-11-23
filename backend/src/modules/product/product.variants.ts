import {
  BASE_VARIANT_ID,
  type ProductDeployment,
  type ProductInterface,
  type ProductVariant,
} from "../../models/product/product.interface";
import { checkDeployment, checkErrorMessage } from "../../utils/deployment";
import { mountSources } from "../../utils/deploymentFolders";

/**
 * A subscription's variants. The base variant is the product's own price,
 * duration and deployment; `variants` holds the others, each with its own
 * price and duration and, optionally, its own deployment settings. Pure:
 * nothing here touches the database.
 */

/** What variants are worked out from. */
export type VariantHost = Pick<
  ProductInterface,
  | "kind"
  | "name"
  | "priceIdr"
  | "priceUsdCents"
  | "paddlePriceId"
  | "durationDays"
  | "pricingText"
  | "description"
  | "deployment"
  | "variantName"
  | "variantSpecs"
  | "variants"
>;

/** One variant with the product's values filled in. */
export interface ResolvedVariant {
  id: string;
  /** The name shown to customers. */
  name: string;
  specs: string;
  /** Shown as its price once chosen; empty shows the price. */
  pricingText: string;
  /** Markdown; the product's when the variant has none of its own. */
  description: string;
  priceIdr: number;
  /** Outside Indonesia, in US cents; null when not sold there. */
  priceUsdCents: number | null;
  /** The Paddle price for `priceUsdCents`, once synced. */
  paddlePriceId: string | null;
  durationDays: number | null;
  /**
   * What to deploy: the product's settings with the variant's own in place
   * of its compose file, variables, domains and commands. Null when the
   * product deploys nothing.
   */
  deployment: ProductDeployment | null;
  /** `deployment.composeFile`, or null. */
  composeFile: string | null;
  isBase: boolean;
}

/**
 * The deployment a variant runs. The project and the name in Dokploy are
 * always the product's. A variant saved before variants had settings of
 * their own may have only a compose file, used with the product's rest.
 */
export function variantDeploymentOf(
  base: ProductDeployment | null | undefined,
  variant: Pick<ProductVariant, "deployment" | "composeFile">,
): ProductDeployment | null {
  if (!base) return null;
  const own = variant.deployment;
  if (own) {
    return {
      type: base.type,
      projectId: base.projectId,
      name: base.name,
      composeFile: own.composeFile,
      variables: own.variables ?? [],
      domains: own.domains ?? [],
      commands: own.commands ?? [],
    };
  }
  if (variant.composeFile) return { ...base, composeFile: variant.composeFile };
  return base;
}

/** A stored variant id, with records saved before variants on the base. */
export function variantIdOf(id: string | null | undefined): string {
  return id || BASE_VARIANT_ID;
}

/** The name the base variant shows: its own, else the product's. */
export function baseVariantName(product: VariantHost): string {
  return (product.variantName ?? "").trim() || product.name;
}

/** Every variant of the product, the base one first. */
export function variantsOf(product: VariantHost): ResolvedVariant[] {
  const base = product.deployment ?? null;
  return [
    {
      id: BASE_VARIANT_ID,
      name: baseVariantName(product),
      specs: product.variantSpecs ?? "",
      pricingText: product.pricingText ?? "",
      description: product.description ?? "",
      priceIdr: product.priceIdr,
      priceUsdCents: product.priceUsdCents ?? null,
      paddlePriceId: product.paddlePriceId ?? null,
      durationDays: product.durationDays,
      deployment: base,
      composeFile: base?.composeFile ?? null,
      isBase: true,
    },
    ...(product.variants ?? []).map((variant) => {
      const deployment = variantDeploymentOf(base, variant);
      return {
        id: variant.id,
        name: variant.name,
        specs: variant.specs,
        pricingText: variant.pricingText ?? "",
        description: (variant.description ?? "").trim()
          ? variant.description
          : (product.description ?? ""),
        priceIdr: variant.priceIdr,
        priceUsdCents: variant.priceUsdCents ?? null,
        paddlePriceId: variant.paddlePriceId ?? null,
        durationDays: variant.durationDays,
        deployment,
        composeFile: deployment?.composeFile ?? null,
        isBase: false,
      };
    }),
  ];
}

/**
 * The deployment settings for a subscription on this variant: the
 * variant's, or the product's when the variant is gone or has none.
 */
export function deploymentFor(
  product: VariantHost,
  variantId: string | null | undefined,
): ProductDeployment | null {
  return variantOf(product, variantId)?.deployment ?? product.deployment;
}

/** Every key any variant marks with one of these visibilities. */
export function variableKeysOf(
  product: VariantHost,
  keep: (
    visibility: ProductDeployment["variables"][number]["visibility"],
  ) => boolean,
): string[] {
  const keys = new Set<string>();
  for (const variant of variantsOf(product)) {
    for (const variable of variant.deployment?.variables ?? []) {
      if (keep(variable.visibility)) keys.add(variable.key);
    }
  }
  return [...keys];
}

/** What one day of a variant costs; 0 when it has no duration. */
export function dailyPriceIdr(
  variant: Pick<ResolvedVariant, "priceIdr" | "durationDays">,
): number {
  return variant.durationDays ? variant.priceIdr / variant.durationDays : 0;
}

/** Whether customers choose between variants: it has more than the base. */
export function hasVariants(product: Pick<VariantHost, "variants">): boolean {
  return (product.variants ?? []).length > 0;
}

/**
 * What an invoice line is called: the product, and the variant when there
 * is a choice, e.g. "Minecraft (4 cores / 4 GB)".
 */
export function lineName(
  product: VariantHost,
  variant: Pick<ResolvedVariant, "name"> | null,
): string {
  return variant && hasVariants(product)
    ? `${product.name} (${variant.name})`
    : product.name;
}

/** The variant with this id (none: the base), or null when it is gone. */
export function variantOf(
  product: VariantHost,
  id: string | null | undefined,
): ResolvedVariant | null {
  const wanted = variantIdOf(id);
  return variantsOf(product).find((variant) => variant.id === wanted) ?? null;
}

/** Ids that were in `before` and are not in `after`. */
export function removedVariantIds(
  before: readonly Pick<ProductVariant, "id">[],
  after: readonly Pick<ProductVariant, "id">[],
): string[] {
  const kept = new Set(after.map(({ id }) => id));
  return before.map(({ id }) => id).filter((id) => !kept.has(id));
}

function sameSources(a: string[], b: string[]): boolean {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return (
    left.length === right.length &&
    left.every((source, index) => source === right[index])
  );
}

/**
 * Checks the product's variants against the product and returns them as
 * they are stored: each own compose file re-indented. Throws on the first
 * problem. A variant's own settings must pass the same check as the
 * product's, every command must run in a service of its compose file, and
 * it must mount exactly what the product's mounts, so a customer who
 * switches keeps their data.
 */
export function fitVariants(
  product: VariantHost,
  domain?: string,
): ProductVariant[] {
  const variants = product.variants ?? [];
  if (variants.length === 0) return [];
  if (product.kind !== "subscription") {
    throw new Error("Only a subscription can have variants");
  }
  if (!product.variantName.trim()) {
    throw new Error("Name the base variant, so customers can tell them apart");
  }

  const ids = new Set<string>([BASE_VARIANT_ID]);
  const names = new Set<string>([product.variantName.trim().toLowerCase()]);
  const base = product.deployment;
  const baseSources = base ? mountSources(base.composeFile) : [];

  return variants.map((variant) => {
    const label = `Variant "${variant.name}"`;
    if (ids.has(variant.id)) {
      throw new Error(`${label} has the same id as another variant`);
    }
    ids.add(variant.id);
    const name = variant.name.trim().toLowerCase();
    if (names.has(name)) {
      throw new Error(`${label}: another variant has this name`);
    }
    names.add(name);

    const plain = {
      ...variant,
      priceUsdCents: variant.priceUsdCents ?? null,
      paddlePriceId: variant.paddlePriceId ?? null,
      pricingText: variant.pricingText ?? "",
      description: variant.description ?? "",
      deployment: variant.deployment ?? null,
      composeFile: variant.composeFile ?? null,
    };
    if (plain.deployment === null && plain.composeFile === null) return plain;
    if (!base) {
      throw new Error(
        `${label} has its own deployment settings, but the product deploys nothing`,
      );
    }
    const settings = variantDeploymentOf(base, plain)!;
    const check = checkDeployment(
      {
        name: settings.name,
        composeFile: settings.composeFile,
        variables: settings.variables,
        domains: settings.domains,
      },
      domain,
    );
    const problem = checkErrorMessage(check.issues);
    if (problem) throw new Error(`${label}: ${problem}`);
    const commandIds = new Set<string>();
    for (const command of settings.commands) {
      if (commandIds.has(command.id)) {
        throw new Error(`${label}: two commands have the same id`);
      }
      commandIds.add(command.id);
      if (!check.services.includes(command.serviceName)) {
        throw new Error(
          `${label}: command "${command.label}" runs in service "${command.serviceName}", which is not in this variant's compose file`,
        );
      }
    }
    if (!sameSources(mountSources(check.composeFile), baseSources)) {
      throw new Error(
        `${label} must mount the same volumes and folders as the base variant's compose file, or customers who switch to it would lose their data`,
      );
    }
    return plain.deployment
      ? {
          ...plain,
          deployment: { ...plain.deployment, composeFile: check.composeFile },
          composeFile: null,
        }
      : { ...plain, composeFile: check.composeFile };
  });
}
