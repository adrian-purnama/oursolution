import {
  BASE_VARIANT_ID,
  type ProductInterface,
  type ProductVariant,
} from "../../models/product/product.interface";
import { checkDeployment, checkErrorMessage } from "../../utils/deployment";
import { mountSources } from "../../utils/deploymentFolders";

/**
 * A subscription's variants. The base variant is the product's own price,
 * duration and compose file; `variants` holds the others. Pure: nothing
 * here touches the database.
 */

/** What variants are worked out from. */
export type VariantHost = Pick<
  ProductInterface,
  | "kind"
  | "name"
  | "priceIdr"
  | "durationDays"
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
  priceIdr: number;
  durationDays: number | null;
  /** What to deploy; null when the product deploys nothing. */
  composeFile: string | null;
  isBase: boolean;
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
  const baseCompose = product.deployment?.composeFile ?? null;
  return [
    {
      id: BASE_VARIANT_ID,
      name: baseVariantName(product),
      specs: product.variantSpecs ?? "",
      priceIdr: product.priceIdr,
      durationDays: product.durationDays,
      composeFile: baseCompose,
      isBase: true,
    },
    ...(product.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      specs: variant.specs,
      priceIdr: variant.priceIdr,
      durationDays: variant.durationDays,
      composeFile: product.deployment
        ? (variant.composeFile ?? baseCompose)
        : null,
      isBase: false,
    })),
  ];
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
 * problem. A variant's compose file must pass the same check as the
 * product's, run every command and mount exactly what the product's
 * mounts, so a customer who switches keeps their data.
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
  const deployment = product.deployment;
  const baseSources = deployment ? mountSources(deployment.composeFile) : [];

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

    if (variant.composeFile === null) return { ...variant };
    if (!deployment) {
      throw new Error(
        `${label} has its own compose file, but the product deploys nothing`,
      );
    }
    const check = checkDeployment(
      {
        name: deployment.name,
        composeFile: variant.composeFile,
        variables: deployment.variables,
        domains: deployment.domains,
      },
      domain,
    );
    const problem = checkErrorMessage(check.issues);
    if (problem) throw new Error(`${label}: ${problem}`);
    for (const command of deployment.commands ?? []) {
      if (!check.services.includes(command.serviceName)) {
        throw new Error(
          `${label}: command "${command.label}" runs in service "${command.serviceName}", which is not in this variant's compose file`,
        );
      }
    }
    if (!sameSources(mountSources(check.composeFile), baseSources)) {
      throw new Error(
        `${label} must mount the same volumes and folders as the product's compose file, or customers who switch to it would lose their data`,
      );
    }
    return { ...variant, composeFile: check.composeFile };
  });
}
