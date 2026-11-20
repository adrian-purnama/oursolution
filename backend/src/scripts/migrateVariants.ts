/**
 * One-off: gives records saved before product variants existed their
 * variant fields explicitly. The app already reads missing fields as the
 * base variant, so this only makes the data say so; it is safe to run more
 * than once and never runs by itself.
 *
 * Dry run (counts only):
 *   production:  node dist/scripts/migrateVariants.js
 *   development: npx tsx --env-file=.env src/scripts/migrateVariants.ts
 * Write the changes: add --apply.
 */
import mongoose from "mongoose";
import { connectDatabase } from "../database/database";
import { env } from "../environment/env";
import { BASE_VARIANT_ID } from "../models/product/product.interface";
import { DeploymentModel } from "../models/deployment/deployment.model";
import { ProductModel } from "../models/product/product.model";
import { UserProductPeriodModel } from "../models/userProductPeriod/userProductPeriod.model";

interface Change {
  label: string;
  collection: mongoose.Collection;
  filter: Record<string, unknown>;
  set: Record<string, unknown>;
}

const missing = { $exists: false };

const changes: Change[] = [
  {
    label: "products without variant fields",
    collection: ProductModel.collection,
    filter: { variants: missing },
    set: { variantName: "", variantSpecs: "", variants: [] },
  },
  {
    label: "periods without a variant (set to the base)",
    collection: UserProductPeriodModel.collection,
    filter: { variantId: missing },
    set: { variantId: BASE_VARIANT_ID },
  },
  {
    label: "periods without a way to apply a variant (set to auto)",
    collection: UserProductPeriodModel.collection,
    filter: { applyVariant: missing },
    set: { applyVariant: "auto" },
  },
  {
    label: "deployed services without a deployed variant (set to the base)",
    collection: DeploymentModel.collection,
    filter: { deployedVariantId: missing, dokploy: { $ne: null } },
    set: { deployedVariantId: BASE_VARIANT_ID },
  },
  {
    label: "never-deployed services without a deployed variant (set to none)",
    collection: DeploymentModel.collection,
    filter: { deployedVariantId: missing, dokploy: null },
    set: { deployedVariantId: null },
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  await connectDatabase(env.mongodbUrl, env.build);
  console.log(apply ? "Applying:" : "Dry run (add --apply to write):");
  for (const change of changes) {
    const count = await change.collection.countDocuments(change.filter);
    if (apply && count > 0) {
      const result = await change.collection.updateMany(change.filter, {
        $set: change.set,
      });
      console.log(`  ${change.label}: ${result.modifiedCount} updated`);
    } else {
      console.log(`  ${change.label}: ${count}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
