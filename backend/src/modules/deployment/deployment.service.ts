import type { HydratedDocument } from "mongoose";
import type {
  AdminDeploymentRowOutDto,
  DeploymentBulkInDto,
  DeploymentBulkItemOutDto,
  DeploymentBulkOutDto,
  DeploymentOutDto,
  DeploymentRunOutDto,
  DeploymentSyncDomainOutDto,
  DeploymentSyncItemOutDto,
  DeploymentSyncOutDto,
  DeploymentVariableOutDto,
  DeploymentVariantOutDto,
  ServiceStatusOutDto,
  VariantRefOutDto,
} from "../../dto/deployment.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type {
  DeploymentInterface,
  DeploymentMonitor,
} from "../../models/deployment/deployment.interface";
import { DeploymentModel } from "../../models/deployment/deployment.model";
import { DeploymentChangeModel } from "../../models/deploymentChange/deploymentChange.model";
import type {
  DeploymentRunInterface,
  RunAction,
} from "../../models/deploymentRun/deploymentRun.interface";
import { DeploymentRunModel } from "../../models/deploymentRun/deploymentRun.model";
import {
  isCustomerSet,
  isSetOnce,
  type DeploymentCommand,
  type DeploymentVariable,
  type ProductDeployment,
  type ProductInterface,
} from "../../models/product/product.interface";
import { ProductModel } from "../../models/product/product.model";
import type { UserInterface } from "../../models/user/user.interface";
import { UserModel } from "../../models/user/user.model";
import {
  applyOverrides,
  composeFileOf,
  diffOverrides,
  fingerprintOf,
  missingValues,
  overridesProblem,
  renderTemplate,
  resolveDeployment,
  toEnvFile,
  updateStatusOf,
  type OverridesInput,
  type UpdateStatus,
  usernameFromEmail,
  type BuiltInVariable,
  type ResolvedDeployment,
} from "../../utils/deployment";
import { commandComposeFile } from "../../utils/deploymentCommand";
import {
  customerFolders,
  hostPaths,
  isInside,
  isUnderDataRoot,
  wipeComposeFile,
  type CustomerFolders,
} from "../../utils/deploymentFolders";
import { cloudflareService } from "../cloudflare/cloudflare.service";
import { dokployService } from "../dokploy/dokploy.service";
import { waitUntilAnswering } from "./deployment.readiness";
import { entitlementService } from "../entitlement/entitlement.service";
import { mailer } from "../mail/mail.service";
import { notificationService } from "../notification/notification.service";
import { noticesOf, toProductSummary } from "../product/product.service";
import {
  deploymentFor,
  variantIdOf,
  variantOf,
  type ResolvedVariant,
} from "../product/product.variants";
import { uptimeKumaService } from "../uptimeKuma/uptimeKuma.service";
import {
  userProductService,
  type VariantSchedule,
} from "../userProduct/userProduct.service";
import {
  ACTION_LABELS,
  allowedActions,
  bulkPlan,
  BUSY_STATES,
  commandBlocker,
  domainIssue,
  mayBeRunning,
  nextAllowedStart,
  PIPELINES,
  shouldAutoApplyVariant,
  shouldAutoTurnOff,
  START_HISTORY_MS,
  STATE_AFTER,
  syncedState,
  wipeBlocker,
  STATE_DURING,
  variantPending,
  type ActualContainers,
} from "./deployment.rules";

type DeploymentDoc = HydratedDocument<DeploymentInterface>;
type RunDoc = HydratedDocument<DeploymentRunInterface>;
type ProductDoc = HydratedDocument<ProductInterface>;
type UserDoc = HydratedDocument<UserInterface>;

/** Customers see vague step names and no errors; admins see everything. */
export type DeploymentView = "customer" | "admin";

/** What the customer is told when these actions finish. */
const OWNER_MESSAGES: Partial<
  Record<
    RunAction,
    {
      done: (name: string) => string;
      doneBody: string;
      failed: (name: string) => string;
    }
  >
> = {
  deploy: {
    done: (name) => `${name} is on`,
    doneBody: "Your service was turned on and is running.",
    failed: (name) => `${name} could not be turned on`,
  },
  turnOff: {
    done: (name) => `${name} is off`,
    doneBody: "Your service was turned off.",
    failed: (name) => `${name} could not be turned off`,
  },
  restart: {
    done: (name) => `${name} restarted`,
    doneBody: "Your service was restarted and is running again.",
    failed: (name) => `${name} could not be restarted`,
  },
  erase: {
    done: (name) => `${name}'s data was erased`,
    doneBody:
      "Everything stored in your service was erased and the service was removed. Turn it on to start afresh.",
    failed: (name) => `${name}'s data could not be erased`,
  },
};

/**
 * What the customer is told about an automatic redeploy: only the variant
 * sweep starts one, to put the service on the variant they now pay for.
 */
const VARIANT_MESSAGES = {
  done: (name: string, variant: string | null) =>
    variant ? `${name} switched to ${variant}` : `${name} switched variant`,
  doneBody:
    "Your service was restarted on the variant your subscription is on now, and is running.",
  failed: (name: string) => `${name} could not switch variant`,
};

const SOURCE = "modules/deployment/deployment.service.ts";
const RUNS_SHOWN = 5;
/** How many override changes the admin view lists, newest first. */
const CHANGES_SHOWN = 50;
const MAX_SUFFIX = 9999;
/** How many deployments a sync checks at the same time. */
const SYNC_CONCURRENCY = 4;

/** Thrown when another run holds the deployment. */
export class DeploymentBusyError extends Error {}

/** Thrown when a customer starts things too often. */
export class DeploymentLimitError extends Error {}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function valuesOf(deployment: DeploymentDoc | null): Record<string, string> {
  return Object.fromEntries(
    (deployment?.values ?? []).map(({ key, value }) => [key, value]),
  );
}

function builtInsFor(
  user: UserDoc,
  username: string,
): Record<BuiltInVariable, string> {
  return {
    USERNAME: username,
    EMAIL: user.email,
    USER_ID: user.id,
    DOMAIN: env.deployDomain ?? "",
  };
}

/** An admin's overrides of a deployment, as plain data. */
function overridesOf(deployment: DeploymentDoc | null): OverridesInput {
  return {
    env: (deployment?.overrides?.env ?? []).map(({ key, value }) => ({
      key,
      value,
    })),
    composeFile: deployment?.overrides?.composeFile ?? null,
  };
}

/** The customer's values, with an admin's overrides counting as filled. */
function filledValuesOf(
  deployment: DeploymentDoc | null,
): Record<string, string> {
  const values = valuesOf(deployment);
  for (const { key, value } of overridesOf(deployment).env) values[key] = value;
  return values;
}

/**
 * The deployment as it really runs for the customer: the product's
 * settings, their values, and an admin's overrides on top.
 */
function effectiveOf(
  config: ProductDeployment,
  builtIns: Record<BuiltInVariable, string>,
  deployment: DeploymentDoc | null,
): ResolvedDeployment {
  return applyOverrides(
    resolveDeployment(config, builtIns, valuesOf(deployment)),
    overridesOf(deployment),
    builtIns,
  );
}

/**
 * Whether the deployment runs what a redeploy would send now: the compose
 * file of the variant the subscription is on (or the admin's replacement)
 * and the .env. Null when it was never pushed or cannot be deployed.
 */
function updateOf(
  user: UserDoc,
  product: ProductDoc,
  deployment: DeploymentDoc | null,
  currentVariantId: string | null | undefined,
): UpdateStatus | null {
  const config = deploymentFor(product, currentVariantId);
  if (!config || !deployment?.dokploy) return null;
  const variantCompose = variantOf(product, currentVariantId)?.composeFile;
  if (!variantCompose) return null;
  const builtIns = builtInsFor(
    user,
    user.deployUsername ?? usernameFromEmail(user.email),
  );
  const expected = fingerprintOf(
    composeFileOf(overridesOf(deployment), variantCompose),
    toEnvFile(effectiveOf(config, builtIns, deployment).env),
  );
  return updateStatusOf(deployment.pushed, expected);
}

/** A customer nobody is: "-" can never be a USERNAME or a user ID. */
const NOBODY = { USERNAME: "-", EMAIL: "-@-", USER_ID: "-" };

/**
 * The host folders that hold this customer's data only, which an erase
 * or a wipe empties. `resolved` is the deployment as resolved for the
 * customer, overrides included, and `composeFile` the one that runs.
 */
function resetFoldersOf(
  config: ProductDeployment,
  resolved: ResolvedDeployment,
  composeFile: string,
): CustomerFolders {
  const nobody = resolveDeployment(
    config,
    { ...NOBODY, DOMAIN: env.deployDomain ?? "" },
    {},
  );
  const editable = new Set(
    config.variables
      .filter((variable) => isCustomerSet(variable.visibility))
      .map((variable) => variable.key),
  );
  return customerFolders(
    composeFile,
    resolved.env,
    nobody.env,
    editable,
    env.deployDataRoots,
  );
}

function toRunOut(run: RunDoc, view: DeploymentView): DeploymentRunOutDto {
  return {
    id: run.id,
    action: run.action,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    automatic: run.startedBy === null,
    commandLabel: run.command?.label ?? null,
    steps: run.steps.map((step) => ({
      key: step.key,
      label: step.label,
      status: step.status,
      ...(view === "admin"
        ? { internalLabel: step.internalLabel, error: step.error }
        : {}),
    })),
  };
}

/** A variant by id and name; one removed since shows its id. */
function variantRef(product: ProductDoc, id: string): VariantRefOutDto {
  return { id, name: variantOf(product, id)?.name ?? id };
}

function variantOut(
  product: ProductDoc,
  deployment: DeploymentDoc | null,
  schedule: VariantSchedule,
): DeploymentVariantOutDto {
  const pushed = Boolean(deployment?.dokploy);
  const deployedId = pushed ? variantIdOf(deployment?.deployedVariantId) : null;
  return {
    current: schedule.current
      ? variantRef(product, schedule.current.variantId)
      : null,
    deployed: deployedId ? variantRef(product, deployedId) : null,
    pending: variantPending(
      deployment?.state ?? "notDeployed",
      pushed,
      deployment?.deployedVariantId ?? null,
      schedule.current?.variantId ?? null,
    ),
    applyVariant: schedule.current?.applyVariant ?? null,
    next: schedule.next
      ? {
          ...variantRef(product, schedule.next.variantId),
          startsAt: schedule.next.startsAt.toISOString(),
        }
      : null,
  };
}

/** What a pipeline's steps share while it runs. */
interface RunContext {
  run: RunDoc;
  deployment: DeploymentDoc;
  product: ProductDoc;
  user: UserDoc;
  resolved: ResolvedDeployment | null;
  environmentId: string | null;
  /** Erase and wipe: the folders the check step found safe to empty. */
  resetFolders: string[];
  /** Deploy and redeploy: the variant the check step found to deploy. */
  variant: ResolvedVariant | null;
}

/**
 * Customers' deployments of subscription products: what they look like,
 * and the pipelines that deploy, restart and turn them off through Dokploy
 * and the Cloudflare tunnel. Runs go on in the background; their steps are
 * stored, so the page can follow them and they survive as history.
 */
export class DeploymentService {
  /**
   * Deployments a run is executing on in this process, counted, so a sync
   * can tell a run that is really going on from a busy state left behind
   * by one that died. Taken before the claim, so there is no gap.
   */
  private readonly active = new Map<string, number>();

  private hold(deploymentId: string): () => void {
    this.active.set(deploymentId, (this.active.get(deploymentId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (this.active.get(deploymentId) ?? 1) - 1;
      if (left > 0) this.active.set(deploymentId, left);
      else this.active.delete(deploymentId);
    };
  }

  // ---------------------------------------------------------------- reading

  /** The user's deployable subscriptions, and any they deployed before. */
  async list(
    userId: string,
    view: DeploymentView,
  ): Promise<DeploymentOutDto[]> {
    const user = await this.loadUser(userId);
    const [active, records] = await Promise.all([
      userProductService.getActiveProducts(userId),
      DeploymentModel.find({ userId }).exec(),
    ]);
    const entitled = new Set(active.map((product) => product.id));
    const recordFor = new Map(
      records.map((record) => [String(record.productId), record]),
    );
    const products = await ProductModel.find({
      _id: { $in: [...entitled, ...recordFor.keys()] },
      kind: "subscription",
    })
      .sort({ name: 1 })
      .exec();

    return Promise.all(
      products
        .filter((product) => product.deployment || recordFor.has(product.id))
        .map((product) =>
          this.toOut(
            user,
            product,
            recordFor.get(product.id) ?? null,
            entitled.has(product.id),
            view,
          ),
        ),
    );
  }

  /**
   * Admin overview: every deployment record of every user, newest
   * activity first. Subscriptions never deployed have no record yet and
   * show only on the user's own page.
   */
  async listAll(): Promise<AdminDeploymentRowOutDto[]> {
    const records = await DeploymentModel.find().sort({ updatedAt: -1 }).exec();
    const [users, products] = await Promise.all([
      UserModel.find({
        _id: { $in: records.map((record) => record.userId) },
      }).exec(),
      ProductModel.find({
        _id: { $in: records.map((record) => record.productId) },
      }).exec(),
    ]);
    const userOf = new Map(users.map((item) => [item.id, item]));
    const productOf = new Map(products.map((item) => [item.id, item]));

    const rows = await Promise.all(
      records.map(async (record) => {
        const user = userOf.get(String(record.userId));
        const product = productOf.get(String(record.productId));
        if (!user || !product) return [];
        const entitled = await entitlementService.canRunService(
          user.id,
          product.id,
        );
        const deployment = await this.toOut(
          user,
          product,
          record,
          entitled,
          "admin",
        );
        return [{ user: { id: user.id, email: user.email }, deployment }];
      }),
    );
    return rows.flat();
  }

  async get(
    userId: string,
    productId: string,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const [user, product] = await Promise.all([
      this.loadUser(userId),
      this.loadProduct(productId),
    ]);
    const [deployment, entitled] = await Promise.all([
      DeploymentModel.findOne({ userId, productId }).exec(),
      entitlementService.canRunService(userId, productId),
    ]);
    if (!deployment && (!product.deployment || !entitled)) {
      throw new Error("This subscription has nothing to deploy");
    }
    return this.toOut(user, product, deployment, entitled, view);
  }

  // ---------------------------------------------------------------- writing

  /**
   * Saves what the customer typed for the variables they set. Applies at
   * the next deploy or redeploy; nothing is redeployed now. A set-once
   * variable is taken while empty and then kept: the customer cannot change
   * it, and leaving it blank changes nothing. An admin may change it, or
   * empty it so the customer fills it again.
   */
  async updateValues(
    userId: string,
    productId: string,
    values: Record<string, string>,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const product = await this.loadProduct(productId);
    const variables =
      (await this.settingsFor(userId, product))?.variables ?? [];
    const visibilityOf = new Map(
      variables.map((variable) => [variable.key, variable.visibility]),
    );
    const deployment = await this.findOrCreate(userId, productId);
    const merged = valuesOf(deployment);
    // A customer sees an admin's override as the value. Sending it back
    // unchanged keeps the override; changing it replaces it, which is logged.
    const overrides = overridesOf(deployment);
    const user =
      view === "customer" ? await UserModel.findById(userId).exec() : null;
    const builtIns = user
      ? builtInsFor(user, user.deployUsername ?? usernameFromEmail(user.email))
      : null;
    const replaced: { key: string; before: string; after: string }[] = [];

    for (const [key, value] of Object.entries(values)) {
      const visibility = visibilityOf.get(key);
      if (!visibility || !isCustomerSet(visibility)) {
        throw new Error(`${key} cannot be changed`);
      }
      const override = overrides.env.find((item) => item.key === key);
      if (override && builtIns && visibility === "editable") {
        if (value === renderTemplate(override.value, builtIns)) continue;
        replaced.push({ key, before: override.value, after: value });
      }
      if (visibility === "editable") {
        merged[key] = value;
        continue;
      }
      const filled = Boolean(merged[key]?.trim());
      if (view === "admin") {
        if (value.trim()) merged[key] = value;
        else delete merged[key];
      } else if (!value.trim()) {
        // Left blank: still to fill, or already set and kept.
      } else if (filled && value !== merged[key]) {
        throw new Error(`${key} is already set and cannot be changed`);
      } else {
        merged[key] = value;
      }
    }

    deployment.values = Object.entries(merged)
      .filter(([key]) => {
        const visibility = visibilityOf.get(key);
        return visibility !== undefined && isCustomerSet(visibility);
      })
      .map(([key, value]) => ({ key, value }));
    if (replaced.length > 0) {
      const gone = new Set(replaced.map(({ key }) => key));
      deployment.overrides = {
        env: overrides.env.filter(({ key }) => !gone.has(key)),
        composeFile: overrides.composeFile,
      };
    }
    await deployment.save();
    if (replaced.length > 0 && user) {
      const at = new Date();
      await DeploymentChangeModel.insertMany(
        replaced.map(({ key, before, after }) => ({
          deploymentId: deployment._id,
          byUserId: user._id,
          byEmail: `${user.email} (customer)`,
          target: "env",
          key,
          before,
          after: null,
          at,
        })),
      );
      logger.info(
        `Deployment ${deployment.id}: customer replaced override(s) ${replaced.map(({ key }) => key).join(", ")}`,
        SOURCE,
        "updateValues",
      );
    }
    return this.get(userId, productId, view);
  }

  /**
   * Admin: replaces the deployment's overrides with `input` and logs each
   * difference. Removing one is a reset to the product's. They apply from
   * the next deploy or redeploy; nothing is redeployed now.
   */
  async updateOverrides(
    userId: string,
    productId: string,
    input: OverridesInput,
    adminId: string,
  ): Promise<DeploymentOutDto> {
    const problem = overridesProblem(input);
    if (problem) throw new Error(problem);
    await this.loadProduct(productId);
    const deployment = await this.findOrCreate(userId, productId);
    const changes = diffOverrides(overridesOf(deployment), input);
    if (changes.length > 0) {
      const admin = await UserModel.findById(adminId).exec();
      deployment.overrides = {
        env: input.env.map(({ key, value }) => ({ key, value })),
        composeFile: input.composeFile,
      };
      await deployment.save();
      const at = new Date();
      await DeploymentChangeModel.insertMany(
        changes.map((change) => ({
          ...change,
          deploymentId: deployment._id,
          byUserId: admin?._id ?? null,
          byEmail: admin?.email ?? "unknown admin",
          at,
        })),
      );
      logger.info(
        `Deployment ${deployment.id}: ${changes.length} override change(s) by ${admin?.email ?? adminId}`,
        SOURCE,
        "updateOverrides",
      );
    }
    return this.get(userId, productId, "admin");
  }

  /**
   * Starts an action in the background and returns at once. Without a
   * running subscription only turning off is allowed; asking for anything
   * else turns a possibly running service off.
   */
  async start(
    userId: string,
    productId: string,
    action: RunAction,
    startedBy: string,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const product = await this.loadProduct(productId);
    const entitled = await entitlementService.canRunService(userId, productId);

    if (action === "wipe") {
      if (view !== "admin") throw new Error("Only an admin can delete data");
      const existing = await DeploymentModel.findOne({
        userId,
        productId,
      }).exec();
      if (!existing)
        throw new Error("It was never deployed, so there is no data");
      const out = await this.get(userId, productId, "admin");
      const blocker = out.internal?.wipe.reason ?? "Data cannot be deleted";
      if (!out.internal?.wipe.allowed) throw new Error(blocker);
      await this.launch(existing, "wipe", startedBy);
      return this.get(userId, productId, view);
    }

    const deployment = await this.findOrCreate(userId, productId);

    if (action !== "turnOff" && !entitled) {
      if (mayBeRunning(deployment.state)) {
        await this.launch(deployment, "turnOff", null);
        throw new Error(
          "The subscription has ended, so the service is being turned off. Renew it to deploy again",
        );
      }
      throw new Error(
        "The subscription is not active, so the service cannot be deployed",
      );
    }
    if (BUSY_STATES.includes(deployment.state)) {
      throw new DeploymentBusyError(
        "Something is already in progress. Wait for it to finish",
      );
    }
    if (!allowedActions(deployment.state, entitled).includes(action)) {
      throw new Error(
        `${ACTION_LABELS[action]} is not possible while the service is ${deployment.state}`,
      );
    }
    if (action !== "turnOff" && !product.deployment) {
      throw new Error("This product has nothing to deploy");
    }
    if (action === "deploy" || action === "redeploy") {
      this.assertFilled(
        (await this.settingsFor(userId, product))?.variables ?? [],
        deployment,
      );
    }
    if (action === "erase") {
      const out = await this.get(userId, productId, "admin");
      if (!out.actions.includes("erase")) {
        throw new Error(
          "This service keeps no data in a folder of its own, so there is nothing to erase",
        );
      }
    }

    if (view === "customer") {
      await this.assertWithinLimits(deployment, action, startedBy);
    }

    await this.launch(deployment, action, startedBy);
    return this.get(userId, productId, view);
  }

  /**
   * Runs one of the product's commands inside the customer's running
   * service, in the background. Customers are limited like other starts.
   */
  async startCommand(
    userId: string,
    productId: string,
    commandId: string,
    startedBy: string,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const product = await this.loadProduct(productId);
    const [deployment, entitled] = await Promise.all([
      DeploymentModel.findOne({ userId, productId }).exec(),
      entitlementService.canRunService(userId, productId),
    ]);
    // The commands of the variant that runs, not the one paid for next.
    const command = deploymentFor(
      product,
      deployment?.deployedVariantId,
    )?.commands.find((item) => item.id === commandId);
    if (!command) throw new Error("This command does not exist");
    if (!deployment) throw new Error("Turn the service on first");
    const blocker = commandBlocker(deployment.state, entitled);
    if (blocker) {
      throw BUSY_STATES.includes(deployment.state)
        ? new DeploymentBusyError(blocker)
        : new Error(blocker);
    }
    if (!deployment.dokploy?.appName) {
      throw new Error("Nothing has been deployed yet");
    }

    if (view === "customer") {
      await this.assertWithinLimits(deployment, "command", startedBy);
    }

    await this.launch(deployment, "command", startedBy, command);
    return this.get(userId, productId, view);
  }

  /**
   * The deployment settings of the variant the customer's subscription is
   * on now: what the next deploy sends.
   */
  private async settingsFor(userId: string, product: ProductDoc) {
    const schedule = await userProductService.variantSchedule(
      userId,
      product.id,
    );
    return deploymentFor(product, schedule.current?.variantId);
  }

  /** Throws while the customer still has set-once variables to fill. */
  private assertFilled(
    variables: DeploymentVariable[],
    deployment: DeploymentDoc,
  ): void {
    const missing = missingValues(variables, filledValuesOf(deployment));
    if (missing.length > 0) {
      const them = missing.length === 1 ? "it" : "them";
      throw new Error(
        `Fill in ${missing.join(", ")} first: the service cannot be turned on without ${them}`,
      );
    }
  }

  /** Throws when this customer has started too much on it lately. */
  private async assertWithinLimits(
    deployment: DeploymentDoc,
    action: RunAction,
    startedBy: string,
  ): Promise<void> {
    const now = new Date();
    const starts = await DeploymentRunModel.find({
      deploymentId: deployment._id,
      startedBy,
      startedAt: { $gt: new Date(now.getTime() - START_HISTORY_MS) },
    })
      .select("action startedAt")
      .exec();
    const next = nextAllowedStart(action, starts, now);
    if (!next) return;
    const minutes = Math.ceil((next.getTime() - now.getTime()) / 60_000);
    const wait =
      minutes >= 90
        ? `about ${Math.round(minutes / 60)} hours`
        : `${minutes} minute${minutes === 1 ? "" : "s"}`;
    throw new DeploymentLimitError(
      `${ACTION_LABELS[action]} was used a lot lately. You can do it again in ${wait}`,
    );
  }

  /**
   * Admin: one action on many deployments. Each is checked on its own,
   * exactly as if it were started by itself, and one being refused never
   * stops the rest. Ones already as asked, or busy, are left alone.
   */
  async bulk(
    input: DeploymentBulkInDto,
    startedBy: string,
  ): Promise<DeploymentBulkOutDto> {
    const seen = new Set<string>();
    const targets = input.targets.filter(({ userId, productId }) => {
      const key = `${userId}:${productId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const items: DeploymentBulkItemOutDto[] = [];
    for (const { userId, productId } of targets) {
      // An update compares with the product's settings, so it needs all.
      const full = input.action === "update";
      const [record, user, product] = await Promise.all([
        DeploymentModel.findOne({ userId, productId }).exec(),
        UserModel.findById(userId)
          .select(full ? "" : "email")
          .exec(),
        ProductModel.findById(productId)
          .select(full ? "" : "name")
          .exec(),
      ]);
      const item: DeploymentBulkItemOutDto = {
        user: { id: userId, email: user?.email ?? null },
        product: { id: productId, name: product?.name ?? null },
        outcome: "skipped",
        run: null,
        message: null,
      };
      items.push(item);
      if (!user || !product) {
        item.message = "Not found";
        continue;
      }
      try {
        const entitled = await entitlementService.canRunService(
          userId,
          productId,
        );
        // No record yet: a subscription never deployed, which turning on
        // may deploy for the first time.
        const update = full
          ? updateOf(
              user,
              product,
              record,
              (await userProductService.variantSchedule(userId, productId))
                .current?.variantId,
            )
          : null;
        const plan = bulkPlan(
          input.action,
          record?.state ?? "notDeployed",
          entitled,
          update,
        );
        if ("skip" in plan) {
          item.message = plan.skip;
          continue;
        }
        await this.start(userId, productId, plan.run, startedBy, "admin");
        item.outcome = "started";
        item.run = plan.run;
      } catch (error) {
        item.outcome =
          error instanceof DeploymentBusyError ? "skipped" : "refused";
        item.message = messageOf(error);
      }
    }

    const count = (outcome: DeploymentBulkItemOutDto["outcome"]) =>
      items.filter((item) => item.outcome === outcome).length;
    const result: DeploymentBulkOutDto = {
      started: count("started"),
      skipped: count("skipped"),
      refused: count("refused"),
      items,
    };
    logger.info(
      `Bulk ${input.action} by ${startedBy}: ${result.started} started, ${result.skipped} skipped, ${result.refused} refused`,
      SOURCE,
      "bulk",
    );
    return result;
  }

  /**
   * Turns off every deployment whose subscription has ended and that may
   * still be running. Called on a schedule; returns how many it started.
   */
  async turnOffLapsed(now: Date = new Date()): Promise<number> {
    const candidates = await DeploymentModel.find({
      state: { $in: ["running", "failed"] },
    }).exec();
    let started = 0;
    for (const deployment of candidates) {
      const userId = String(deployment.userId);
      const productId = String(deployment.productId);
      const [entitled, latestRun] = await Promise.all([
        entitlementService.canRunService(userId, productId, now),
        this.latestRunOf(deployment),
      ]);
      if (!shouldAutoTurnOff(deployment.state, entitled, latestRun)) continue;
      try {
        await this.launch(deployment, "turnOff", null);
        started++;
        logger.info(
          `Subscription ended: turning off deployment ${deployment.id}`,
          SOURCE,
          "turnOffLapsed",
        );
      } catch (error) {
        // Busy: something else is running on it; the next sweep checks again.
        if (!(error instanceof DeploymentBusyError)) throw error;
      }
    }
    return started;
  }

  /**
   * Redeploys running services onto the variant their subscription is on
   * now, when the customer chose to have that done by itself: a switch
   * that starts at once, or a period on another variant that has begun.
   * A service that failed is left for an admin. Returns how many
   * redeploys it started.
   */
  async applyPendingVariants(now: Date = new Date()): Promise<number> {
    const candidates = await DeploymentModel.find({
      state: "running",
      dokploy: { $ne: null },
    }).exec();
    let started = 0;
    for (const deployment of candidates) {
      const schedule = await userProductService.variantSchedule(
        String(deployment.userId),
        String(deployment.productId),
        now,
      );
      const current = schedule.current;
      const pending = variantPending(
        deployment.state,
        true,
        deployment.deployedVariantId ?? null,
        current?.variantId ?? null,
      );
      // Most services have nothing pending: skip the run lookup for them.
      if (!pending || current?.applyVariant !== "auto") continue;
      const latestRun = await this.latestRunOf(deployment);
      if (!shouldAutoApplyVariant(pending, current.applyVariant, latestRun)) {
        continue;
      }
      // The new variant may ask for values the old one did not. Redeploying
      // without them would fail and leave the service marked failed while
      // the old variant still runs, so wait for the customer to fill them.
      const product = await ProductModel.findById(deployment.productId).exec();
      const settings = product
        ? deploymentFor(product, current.variantId)
        : null;
      if (
        !settings ||
        missingValues(settings.variables, filledValuesOf(deployment)).length > 0
      ) {
        continue;
      }
      try {
        await this.launch(deployment, "redeploy", null);
        started++;
        logger.info(
          `Variant changed: redeploying deployment ${deployment.id} on ${current.variantId}`,
          SOURCE,
          "applyPendingVariants",
        );
      } catch (error) {
        // Busy: something else is running on it; the next sweep checks again.
        if (!(error instanceof DeploymentBusyError)) throw error;
      }
    }
    return started;
  }

  /** The deployment's latest run, as the sweep rules read it. */
  private async latestRunOf(deployment: DeploymentDoc): Promise<{
    action: RunAction;
    automatic: boolean;
    failed: boolean;
  } | null> {
    const latest = await DeploymentRunModel.findOne({
      deploymentId: deployment._id,
    })
      .sort({ startedAt: -1 })
      .exec();
    return latest
      ? {
          action: latest.action,
          automatic: latest.startedBy === null,
          failed: latest.status === "failed",
        }
      : null;
  }

  /**
   * Admin: brings every deployment's stored state in step with what its
   * containers really do in Dokploy, and checks each host: registered as a
   * domain in Dokploy, and on (routed, with its DNS record) in Cloudflare.
   * One deployment failing does not stop the rest. Nothing is started,
   * stopped or routed here; only our own records change.
   */
  async syncAll(): Promise<DeploymentSyncOutDto> {
    // Asked once up front: without Dokploy nothing can be checked.
    await dokployService.listProjects();

    let routed: Set<string> | null = null;
    let cloudflareError: string | null = null;
    try {
      routed = await cloudflareService.routedHostnames();
    } catch (error) {
      cloudflareError = messageOf(error);
    }

    const records = await DeploymentModel.find().sort({ updatedAt: -1 }).exec();
    const [users, products] = await Promise.all([
      UserModel.find({
        _id: { $in: records.map((record) => record.userId) },
      }).exec(),
      ProductModel.find({
        _id: { $in: records.map((record) => record.productId) },
      }).exec(),
    ]);
    const userOf = new Map(users.map((item) => [item.id, item]));
    const productOf = new Map(products.map((item) => [item.id, item]));

    const found: (DeploymentSyncItemOutDto | null)[] = records.map(() => null);
    let next = 0;
    const worker = async () => {
      while (next < records.length) {
        const index = next++;
        const record = records[index];
        const user = userOf.get(String(record.userId));
        const product = productOf.get(String(record.productId));
        // Like the overview: records of a deleted user or product are left out.
        if (!user || !product) continue;
        found[index] = await this.syncOne(record, user, product, routed);
      }
    };
    await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker));

    const items = found.flatMap((item) => (item ? [item] : []));
    const count = (outcome: DeploymentSyncItemOutDto["outcome"]) =>
      items.filter((item) => item.outcome === outcome).length;
    const result: DeploymentSyncOutDto = {
      checked: items.length - count("skipped") - count("failed"),
      changed: count("changed"),
      skipped: count("skipped"),
      failed: count("failed"),
      domainIssues: items.reduce(
        (sum, item) =>
          sum + item.domains.filter((domain) => domain.issue !== null).length,
        0,
      ),
      cloudflareError,
      items,
    };
    logger.info(
      `Synced deployments: ${result.checked} checked, ${result.changed} changed, ${result.skipped} skipped, ${result.failed} failed, ${result.domainIssues} host issue(s)`,
      SOURCE,
      "syncAll",
    );
    return result;
  }

  /** Syncs one deployment. Never throws: a failure is the item's outcome. */
  private async syncOne(
    record: DeploymentDoc,
    user: UserDoc,
    product: ProductDoc,
    routed: Set<string> | null,
  ): Promise<DeploymentSyncItemOutDto> {
    const item: DeploymentSyncItemOutDto = {
      user: { id: user.id, email: user.email },
      product: { id: product.id, name: product.name },
      outcome: "unchanged",
      from: record.state,
      to: record.state,
      containers: null,
      message: null,
      domains: [],
    };
    if (BUSY_STATES.includes(record.state) && this.active.has(record.id)) {
      return { ...item, outcome: "skipped", message: "A run is in progress" };
    }

    try {
      const notes: string[] = [];
      let cleared = false;
      if (BUSY_STATES.includes(record.state)) {
        // Busy, yet no run works on it here: one died and left it stuck.
        if (!(await this.clearStuck(record))) {
          return {
            ...item,
            outcome: "skipped",
            message: "A run started meanwhile",
          };
        }
        cleared = true;
        notes.push(
          `It was stuck ${item.from}: the run had stopped mid-way and is now marked failed`,
        );
      }

      const link = record.dokploy;
      let actual: ActualContainers | null = null;
      let registered: string[] | null = null;
      if (link && (await dokployService.composeExists(link.composeId))) {
        const appName = link.appName || record.name;
        if (!appName) throw new Error("Its name in Dokploy is not known");
        [actual, registered] = await Promise.all([
          dokployService.containersState(appName),
          dokployService.domainHosts(link.composeId),
        ]);
        // Pushed before fingerprints were kept: take them from what Dokploy
        // holds, so its update status is known.
        if (!record.pushed) {
          const content = await dokployService.composeContent(link.composeId);
          if (content) {
            const pushed = {
              ...fingerprintOf(content.composeFile, content.env),
              at: null,
            };
            await DeploymentModel.updateOne(
              { _id: record._id, pushed: null },
              { $set: { pushed } },
            ).exec();
            record.pushed = pushed;
          }
        }
      } else if (link || record.state !== "notDeployed") {
        actual = "missing";
        registered = [];
        if (link) notes.push("Its compose is gone from Dokploy");
      }
      item.containers = actual;

      const to = actual ? syncedState(record.state, actual) : record.state;
      const forgetLink = actual === "missing" && link !== null;
      if (to !== record.state || forgetLink) {
        // Only while no run took it meanwhile: a run's state wins.
        const saved = await DeploymentModel.findOneAndUpdate(
          { _id: record._id, state: record.state },
          { $set: { state: to, ...(forgetLink ? { dokploy: null } : {}) } },
          { new: true },
        ).exec();
        if (!saved) {
          return {
            ...item,
            outcome: "skipped",
            message: "A run started meanwhile",
          };
        }
        item.to = to;
        item.outcome = "changed";
        if (to !== record.state) await this.syncMonitorsTo(record, to);
      } else if (cleared) {
        item.to = record.state;
        item.outcome = "changed";
      }

      const config = deploymentFor(product, record.deployedVariantId);
      const expected =
        config && env.deployDomain
          ? resolveDeployment(
              config,
              builtInsFor(
                user,
                user.deployUsername ?? usernameFromEmail(user.email),
              ),
              valuesOf(record),
            ).domains.map(({ host }) => host)
          : [];
      const stale: string[] = [];
      for (const host of new Set([...expected, ...record.routedHosts])) {
        let on: boolean | null = null;
        if (routed) {
          try {
            const pointed = await cloudflareService.pointsToTunnel(host);
            on = routed.has(host) && pointed;
            if (!routed.has(host) && !pointed) stale.push(host);
          } catch (error) {
            notes.push(`${host}: ${messageOf(error)}`);
          }
        }
        const check = {
          registered: registered ? registered.includes(host) : null,
          on,
        };
        const domain: DeploymentSyncDomainOutDto = {
          host,
          ...check,
          issue: domainIssue(to, check),
        };
        item.domains.push(domain);
      }

      // Hosts we thought we had in Cloudflare and that are gone there.
      const forgotten = record.routedHosts.filter((host) =>
        stale.includes(host),
      );
      if (forgotten.length > 0) {
        await DeploymentModel.updateOne(
          { _id: record._id },
          { $pull: { routedHosts: { $in: forgotten } } },
        ).exec();
        item.outcome = "changed";
        notes.push(`No longer in Cloudflare: ${forgotten.join(", ")}`);
      }

      item.message = notes.length > 0 ? notes.join(". ") : null;
      return item;
    } catch (error) {
      logger.warn(
        `Deployment ${record.id} could not be synced: ${messageOf(error)}`,
        SOURCE,
        "syncOne",
      );
      return { ...item, outcome: "failed", message: messageOf(error) };
    }
  }

  /**
   * Fails the runs left "running" on a deployment no run works on, and
   * moves it out of its busy state to "failed", as a restart would.
   * Returns false when a run took it meanwhile; `record` then is untouched.
   */
  private async clearStuck(record: DeploymentDoc): Promise<boolean> {
    const runs = await DeploymentRunModel.find({
      deploymentId: record._id,
      status: "running",
    }).exec();
    if (this.active.has(record.id)) return false;
    const freed = await DeploymentModel.findOneAndUpdate(
      { _id: record._id, state: record.state },
      { $set: { state: "failed" } },
      { new: true },
    ).exec();
    if (!freed) return false;
    for (const run of runs) {
      const step =
        run.steps.find((item) => item.status === "running") ??
        run.steps.find((item) => item.status === "pending");
      await this.failRun(
        run,
        step?.key ?? null,
        "Stuck: this run stopped mid-way and a sync found it. Check Dokploy and Cloudflare, then run it again",
      );
    }
    record.state = "failed";
    logger.warn(
      `Deployment ${record.id} was stuck; ${runs.length} run(s) marked failed`,
      SOURCE,
      "clearStuck",
    );
    return true;
  }

  /**
   * After a sync changed the state: checks resume for a service found
   * running and pause for one found off, so being off is not downtime.
   * An extra, like `syncMonitors`: a failure is only logged.
   */
  private async syncMonitorsTo(
    record: DeploymentDoc,
    to: DeploymentInterface["state"],
  ): Promise<void> {
    if (!uptimeKumaService.configured || record.monitors.length === 0) return;
    try {
      if (to === "stopped") {
        for (const { monitorId } of record.monitors) {
          await uptimeKumaService.pauseMonitor(monitorId);
        }
      } else if (to === "running") {
        const monitors: DeploymentMonitor[] = [];
        for (const { host, monitorId } of record.monitors) {
          monitors.push({
            host,
            monitorId: await uptimeKumaService.ensureMonitor(host, monitorId),
          });
        }
        await DeploymentModel.updateOne(
          { _id: record._id },
          { $set: { monitors } },
        ).exec();
      }
    } catch (error) {
      logger.warn(
        `Deployment ${record.id}: Uptime Kuma is out of step after a sync: ${messageOf(error)}`,
        SOURCE,
        "syncMonitorsTo",
      );
    }
  }

  /**
   * After a restart of this server, runs that were going on are marked
   * failed (they stopped mid-way) and admins are told.
   */
  async recoverInterruptedRuns(): Promise<void> {
    // "reset" (erase, then deploy) became "erase" (erase only). Old runs
    // keep their history under the new name.
    // Straight on the collection: "reset" is no longer a known action.
    await DeploymentRunModel.collection.updateMany(
      { action: "reset" },
      { $set: { action: "erase" } },
    );
    const runs = await DeploymentRunModel.find({ status: "running" }).exec();
    for (const run of runs) {
      const step =
        run.steps.find((item) => item.status === "running") ??
        run.steps.find((item) => item.status === "pending");
      await this.failRun(
        run,
        step?.key ?? null,
        "Interrupted: the server restarted while this step ran. Check Dokploy and Cloudflare, then run it again",
      );
    }
    if (runs.length > 0) {
      logger.warn(
        `Marked ${runs.length} interrupted deployment run(s) as failed`,
        SOURCE,
        "recoverInterruptedRuns",
      );
    }
  }

  // ---------------------------------------------------------------- pipeline

  private async launch(
    deployment: DeploymentDoc,
    action: RunAction,
    startedBy: string | null,
    command: DeploymentCommand | null = null,
  ): Promise<void> {
    const release = this.hold(deployment.id);
    const claimed = await DeploymentModel.findOneAndUpdate(
      { _id: deployment._id, state: { $nin: BUSY_STATES } },
      { $set: { state: STATE_DURING[action] } },
      { new: true },
    )
      .exec()
      .catch((error: unknown) => {
        release();
        throw error;
      });
    if (!claimed) {
      release();
      throw new DeploymentBusyError(
        "Something is already in progress. Wait for it to finish",
      );
    }

    let run: RunDoc;
    try {
      run = await this.createRun(deployment, action, startedBy, command);
    } catch (error) {
      // No run to follow: give the deployment back instead of leaving it busy.
      await DeploymentModel.updateOne(
        { _id: deployment._id, state: STATE_DURING[action] },
        { $set: { state: deployment.state } },
      ).exec();
      release();
      throw error;
    }

    void this.execute(run)
      .catch(async (error: unknown) => {
        logger.error(
          `Deployment run ${run.id} crashed: ${messageOf(error)}`,
          SOURCE,
          "launch",
        );
        // Never leave it busy: mark the run and the deployment failed.
        if (run.status === "running") {
          const step = run.steps.find((item) => item.status === "running");
          await this.failRun(
            run,
            step?.key ?? null,
            `Crashed: ${messageOf(error)}`,
          ).catch(() => undefined);
        }
      })
      .finally(release);
  }

  private createRun(
    deployment: DeploymentDoc,
    action: RunAction,
    startedBy: string | null,
    command: DeploymentCommand | null,
  ): Promise<RunDoc> {
    return DeploymentRunModel.create({
      deploymentId: deployment._id,
      userId: deployment.userId,
      productId: deployment.productId,
      action,
      status: "running",
      command: command ? { id: command.id, label: command.label } : null,
      steps: PIPELINES[action].map((step) => ({
        ...step,
        ...(command && step.key === "command" ? { label: command.label } : {}),
        status: "pending",
        error: null,
        startedAt: null,
        finishedAt: null,
      })),
      startedBy,
      startedAt: new Date(),
      finishedAt: null,
    });
  }

  private async execute(run: RunDoc): Promise<void> {
    const [deployment, product, user] = await Promise.all([
      DeploymentModel.findById(run.deploymentId).exec(),
      ProductModel.findById(run.productId).exec(),
      UserModel.findById(run.userId).exec(),
    ]);
    if (!deployment || !product || !user) {
      await this.failRun(
        run,
        run.steps[0]?.key ?? null,
        "The deployment, product or user no longer exists",
      );
      return;
    }
    const context: RunContext = {
      run,
      deployment,
      product,
      user,
      resolved: null,
      environmentId: null,
      resetFolders: [],
      variant: null,
    };

    for (const step of run.steps) {
      step.status = "running";
      step.startedAt = new Date();
      run.markModified("steps");
      await run.save();
      try {
        await this.runStep(step.key, context);
      } catch (error) {
        await this.failRun(run, step.key, messageOf(error));
        return;
      }
      step.status = "done";
      step.finishedAt = new Date();
      run.markModified("steps");
      await run.save();
    }

    run.status = "succeeded";
    run.finishedAt = new Date();
    await run.save();
    await DeploymentModel.updateOne(
      { _id: deployment._id },
      { $set: { state: STATE_AFTER[run.action] } },
    ).exec();
    await this.syncMonitors(context);
    await this.notifyOwner(run, true, product.name, context.variant?.name);
  }

  /**
   * Keeps Uptime Kuma in step with a run that succeeded: a deploy checks
   * every host, turning off pauses the checks. Monitoring is an extra, so
   * a failure here is logged and the run stays succeeded; the next deploy
   * or redeploy tries again.
   */
  private async syncMonitors(context: RunContext): Promise<void> {
    const { run, deployment } = context;
    if (
      !uptimeKumaService.configured ||
      run.action === "restart" ||
      run.action === "wipe" ||
      run.action === "erase" ||
      run.action === "command"
    ) {
      return;
    }
    try {
      if (run.action === "turnOff") {
        for (const { monitorId } of deployment.monitors) {
          await uptimeKumaService.pauseMonitor(monitorId);
        }
        return;
      }

      const wanted = (context.resolved?.domains ?? []).map(({ host }) => host);
      let monitors: DeploymentMonitor[] = deployment.monitors.map(
        ({ host, monitorId }) => ({ host, monitorId }),
      );
      const save = () =>
        DeploymentModel.updateOne(
          { _id: deployment._id },
          { $set: { monitors } },
        ).exec();

      for (const host of wanted) {
        const existing = monitors.find((monitor) => monitor.host === host);
        const monitorId = await uptimeKumaService.ensureMonitor(
          host,
          existing?.monitorId ?? null,
        );
        if (existing?.monitorId === monitorId) continue;
        monitors = [
          ...monitors.filter((monitor) => monitor.host !== host),
          { host, monitorId },
        ];
        // Saved at once: a monitor nobody remembers would be made twice.
        await save();
      }
      for (const { host, monitorId } of [...monitors]) {
        if (wanted.includes(host)) continue;
        await uptimeKumaService.deleteMonitor(monitorId);
        monitors = monitors.filter((monitor) => monitor.host !== host);
        await save();
      }
    } catch (error) {
      logger.warn(
        `Deployment ${deployment.id}: Uptime Kuma is out of step after ${run.action}: ${messageOf(error)}`,
        SOURCE,
        "syncMonitors",
      );
    }
  }

  /** Each monitored host's status, leaving out ones Kuma cannot report. */
  private async statusOf(
    deployment: DeploymentDoc | null,
  ): Promise<ServiceStatusOutDto[]> {
    if (!deployment || deployment.state !== "running") return [];
    if (!uptimeKumaService.configured) return [];
    const statuses = await Promise.all(
      deployment.monitors.map(async ({ host, monitorId }) => {
        const status = await uptimeKumaService.status(monitorId);
        return status ? [{ host, ...status }] : [];
      }),
    );
    return statuses.flat();
  }

  private async runStep(key: string, context: RunContext): Promise<void> {
    switch (key) {
      case "check":
        return this.stepCheck(context);
      case "dokploy":
        return this.stepDokploy(context);
      case "route":
        return this.stepRoute(context);
      case "restart":
        return this.stepRestart(context);
      case "ready":
        return this.stepReady(context);
      case "stop":
        return this.stepStop(context);
      case "wipeCheck":
        return this.stepWipeCheck(context);
      case "wipe":
        return this.stepWipe(context);
      case "unroute":
        return this.stepUnroute(context);
      case "remove":
        return this.stepRemove(context);
      case "command":
        return this.stepCommand(context);
      default:
        throw new Error(`Unknown step "${key}"`);
    }
  }

  /** Subscription, settings, Dokploy, Cloudflare, and no clashes. */
  private async stepCheck(context: RunContext): Promise<void> {
    const { deployment, product, user } = context;
    if (!env.deployDomain) {
      throw new Error("DEPLOY_DOMAIN is not set in the backend .env");
    }
    const config = product.deployment;
    if (!config) throw new Error("The product has no deployment settings");
    if (!config.name) {
      throw new Error(
        "The product's deployment has no name. Edit the product and save it",
      );
    }
    if (!(await entitlementService.canRunService(user.id, product.id))) {
      throw new Error("The subscription is no longer active");
    }
    // The variant the subscription is on now decides what is deployed.
    const schedule = await userProductService.variantSchedule(
      user.id,
      product.id,
    );
    const variant = variantOf(product, schedule.current?.variantId);
    if (!variant?.composeFile) {
      throw new Error(
        `The subscription is on variant "${schedule.current?.variantId}", which the product no longer has`,
      );
    }
    context.variant = variant;
    const settings = variant.deployment ?? config;
    this.assertFilled(settings.variables, deployment);

    const username = await this.ensureUsername(user);
    const resolved = effectiveOf(
      settings,
      builtInsFor(user, username),
      deployment,
    );
    context.resolved = resolved;

    const environment = await dokployService.getEnvironment(config.projectId);
    context.environmentId = environment.environmentId;
    if (
      deployment.dokploy &&
      !(await dokployService.composeExists(deployment.dokploy.composeId))
    ) {
      // Deleted in Dokploy: the next step creates it again.
      deployment.dokploy = null;
      await deployment.save();
    }
    if (!deployment.dokploy) {
      const taken = await DeploymentModel.exists({
        _id: { $ne: deployment._id },
        name: resolved.name,
      });
      if (taken) {
        throw new Error(
          `Another customer's deployment is already named "${resolved.name}"`,
        );
      }
      if (environment.composes.some((item) => item.name === resolved.name)) {
        throw new Error(
          `Dokploy already has a compose named "${resolved.name}" in project ${config.projectId}`,
        );
      }
    }

    await cloudflareService.checkAvailable();
    for (const { host } of resolved.domains) {
      if (deployment.routedHosts.includes(host)) continue;
      const owner = await DeploymentModel.exists({
        _id: { $ne: deployment._id },
        routedHosts: host,
      });
      if (owner) {
        throw new Error(`${host} is used by another customer's deployment`);
      }
      if (await cloudflareService.isHostInUse(host)) {
        throw new Error(
          `${host} already has a Cloudflare tunnel route or DNS record that this deployment did not make`,
        );
      }
    }
  }

  /**
   * Before deleting data: the service is off and the folders are this
   * customer's only. An admin's wipe needs the subscription over; a
   * customer's erase needs it still active. Resolved with the username the
   * customer was deployed under, so the folders are the ones used.
   */
  private async stepWipeCheck(context: RunContext): Promise<void> {
    const { deployment, product, user, run } = context;
    // The data is the running variant's; every variant mounts the same.
    const config = deploymentFor(product, deployment.deployedVariantId);
    if (!config) throw new Error("The product has no deployment settings");
    if (!user.deployUsername) {
      throw new Error("It was never deployed, so there is no data");
    }
    const entitled = await entitlementService.canRunService(
      user.id,
      product.id,
    );
    if (run.action === "wipe" && entitled) {
      throw new Error(
        "The subscription is active again, so its data is kept. Nothing was erased",
      );
    }
    if (run.action === "erase" && !entitled) {
      throw new Error(
        "The subscription is no longer active. Nothing was erased",
      );
    }
    const resolved = effectiveOf(
      config,
      builtInsFor(user, user.deployUsername),
      deployment,
    );
    const { folders } = resetFoldersOf(
      config,
      resolved,
      composeFileOf(overridesOf(deployment), config.composeFile),
    );
    if (folders.length === 0) {
      throw new Error(
        "The compose file mounts no host folder that is this customer's only and inside DEPLOY_DATA_ROOTS, so there is nothing to erase",
      );
    }
    await this.assertFoldersAreOwn(deployment, folders);
    context.resolved = resolved;
    context.resetFolders = folders;
  }

  /** Creates the compose when needed, pushes settings, deploys, waits. */
  private async stepDokploy(context: RunContext): Promise<void> {
    const { deployment, product, run } = context;
    const config = product.deployment;
    const { resolved, variant } = context;
    // An admin's replacement wins over the variant's own.
    const composeFile = variant?.composeFile
      ? composeFileOf(overridesOf(deployment), variant.composeFile)
      : null;
    if (
      !config ||
      !resolved ||
      !context.environmentId ||
      !variant ||
      !composeFile
    ) {
      throw new Error("The check step did not finish");
    }

    if (!deployment.dokploy) {
      const compose = await dokployService.createCompose({
        environmentId: context.environmentId,
        name: resolved.name,
        composeFile,
      });
      deployment.dokploy = {
        projectId: config.projectId,
        environmentId: context.environmentId,
        composeId: compose.composeId,
        appName: compose.appName,
      };
      deployment.name = resolved.name;
      await deployment.save();
    }

    const { composeId } = deployment.dokploy;
    const envFile = toEnvFile(resolved.env);
    await dokployService.updateCompose(composeId, {
      composeFile,
      env: envFile,
    });
    // Dokploy has this variant's compose now, even if the deploy fails.
    const pushed = { ...fingerprintOf(composeFile, envFile), at: new Date() };
    deployment.deployedVariantId = variant.id;
    deployment.pushed = pushed;
    await DeploymentModel.updateOne(
      { _id: deployment._id },
      { $set: { deployedVariantId: variant.id, pushed } },
    ).exec();
    await dokployService.syncDomains(composeId, resolved.domains);
    await dokployService.deployAndWait(
      composeId,
      `${ACTION_LABELS[run.action]} by the app`,
    );
  }

  /** Routes the wanted hosts and drops ones the product no longer has. */
  private async stepRoute(context: RunContext): Promise<void> {
    const { deployment } = context;
    const wanted = (context.resolved?.domains ?? []).map(({ host }) => host);
    for (const host of wanted) {
      await cloudflareService.addRoute(host);
      await DeploymentModel.updateOne(
        { _id: deployment._id },
        { $addToSet: { routedHosts: host } },
      ).exec();
    }
    for (const host of deployment.routedHosts) {
      if (wanted.includes(host)) continue;
      await cloudflareService.removeRoute(host);
      await DeploymentModel.updateOne(
        { _id: deployment._id },
        { $pull: { routedHosts: host } },
      ).exec();
    }
  }

  private async stepRestart({ deployment }: RunContext): Promise<void> {
    if (!deployment.dokploy) throw new Error("Nothing has been deployed yet");
    const { composeId, appName } = deployment.dokploy;
    if (!(await dokployService.composeExists(composeId))) {
      throw new Error(
        "The compose is gone from Dokploy, so there is nothing to restart. Deploy again to create it",
      );
    }
    await dokployService.stopCompose(composeId, appName);
    await dokployService.startCompose(composeId, appName);
  }

  /**
   * Waits for the hosts to answer. A slow start is logged, not a failure:
   * the containers are up, and Uptime Kuma reports what happens next.
   */
  private async stepReady(context: RunContext): Promise<void> {
    const { deployment } = context;
    const hosts = context.resolved
      ? context.resolved.domains.map(({ host }) => host)
      : deployment.routedHosts;
    const silent = await waitUntilAnswering(hosts);
    if (silent.length > 0) {
      logger.warn(
        `Deployment ${deployment.id}: still not answering after the deploy: ${silent.join(", ")}`,
        SOURCE,
        "stepReady",
      );
    }
  }

  /**
   * Stops the compose. One already gone from Dokploy (deleted there by
   * hand, say) has nothing left to stop: the link is forgotten and the run
   * goes on, so turning off still takes the address offline.
   */
  private async stepStop({ deployment }: RunContext): Promise<void> {
    if (!deployment.dokploy) return;
    const { composeId, appName } = deployment.dokploy;
    if (!(await dokployService.composeExists(composeId))) {
      logger.warn(
        `Deployment ${deployment.id}: compose ${composeId} is gone from Dokploy, so there is nothing to stop`,
        SOURCE,
        "stepStop",
      );
      deployment.dokploy = null;
      await DeploymentModel.updateOne(
        { _id: deployment._id },
        { $set: { dokploy: null } },
      ).exec();
      return;
    }
    await dokployService.stopCompose(composeId, appName);
  }

  /**
   * Empties the customer's own host folders. Dokploy's API cannot touch
   * the host's disk, so a one-off container that mounts them does it.
   */
  private async stepWipe(context: RunContext): Promise<void> {
    const config = context.product.deployment;
    const folders = context.resetFolders;
    if (!config || folders.length === 0) {
      throw new Error("The check step did not finish");
    }
    // Checked again right where it matters.
    for (const folder of folders) {
      if (!isUnderDataRoot(folder, env.deployDataRoots)) {
        throw new Error(`${folder} is not inside DEPLOY_DATA_ROOTS`);
      }
    }
    logger.info(
      `Deployment ${context.deployment.id}: erasing ${folders.join(", ")}`,
      SOURCE,
      "stepWipe",
    );
    await dokployService.runOnce({
      projectId: config.projectId,
      // New every time, so it can never be an existing compose's name.
      name: `wipe-${context.deployment.id}-${Date.now().toString(36)}`,
      composeFile: wipeComposeFile(folders),
      title: `Erase the customer's data (${context.run.action === "wipe" ? "deleted by an admin" : "erased by the customer"} in the app)`,
    });
  }

  /**
   * Throws unless emptying `folders` leaves every other deployment alone,
   * of any customer and any product. Stops, for example, a customer whose
   * username is the name of a folder another product keeps its data in.
   */
  private async assertFoldersAreOwn(
    deployment: DeploymentDoc,
    folders: string[],
  ): Promise<void> {
    const others = await DeploymentModel.find({
      _id: { $ne: deployment._id },
    }).exec();
    const [products, owners] = await Promise.all([
      ProductModel.find({
        _id: { $in: others.map((other) => other.productId) },
      }).exec(),
      UserModel.find({
        _id: { $in: others.map((other) => other.userId) },
      }).exec(),
    ]);
    const productOf = new Map(products.map((item) => [item.id, item]));
    const ownerOf = new Map(owners.map((item) => [item.id, item]));

    for (const other of others) {
      const product = productOf.get(String(other.productId));
      const owner = ownerOf.get(String(other.userId));
      const config = product?.deployment;
      if (!product || !config || !owner) continue;
      const resolved = effectiveOf(
        config,
        builtInsFor(
          owner,
          owner.deployUsername ?? usernameFromEmail(owner.email),
        ),
        other,
      );
      const otherCompose = composeFileOf(
        overridesOf(other),
        config.composeFile,
      );
      const mounted = hostPaths(otherCompose, resolved.env);
      if (mounted === null) {
        throw new Error(
          `Product "${product.name}" mounts a path that cannot be read, so it is not certain the folders to erase are this customer's only`,
        );
      }
      const theirs = resetFoldersOf(config, resolved, otherCompose).folders;
      for (const folder of folders) {
        const clash =
          mounted.find((path) => isInside(path, folder)) ??
          theirs.find((path) => isInside(folder, path));
        if (clash) {
          throw new Error(
            `${folder} overlaps ${clash}, which ${owner.email}'s "${product.name}" also uses. Nothing was erased`,
          );
        }
      }
    }
  }

  /**
   * Runs the run's command in its service's container. Dokploy's API has
   * no exec, so a one-off container with the Docker socket does it. The
   * command is read from the product now, so an admin's fix applies.
   */
  private async stepCommand(context: RunContext): Promise<void> {
    const { run, deployment, product } = context;
    const config = deploymentFor(product, deployment.deployedVariantId);
    const command = config?.commands.find(
      (item) => item.id === run.command?.id,
    );
    if (!config || !command) {
      throw new Error("The command was removed from the product");
    }
    if (!deployment.dokploy?.appName) {
      throw new Error("Nothing has been deployed yet");
    }
    logger.info(
      `Deployment ${deployment.id}: running command ${command.id} (${command.label}) in ${command.serviceName}`,
      SOURCE,
      "stepCommand",
    );
    await dokployService.runOnce({
      projectId: config.projectId,
      // New every time, so it can never be an existing compose's name.
      name: `cmd-${deployment.id}-${Date.now().toString(36)}`,
      composeFile: commandComposeFile({
        appName: deployment.dokploy.appName,
        serviceName: command.serviceName,
        command: command.command,
      }),
      title: `Run "${command.label}" (started by the app)`,
    });
  }

  /**
   * After an erase: takes away everything the service had, so it is as if
   * it was never deployed. Its settings go back to the product's too: the
   * customer's values, set-once ones included, so they choose them afresh
   * (a first admin password is useless without its data), and any admin
   * overrides of the environment or compose file.
   */
  private async stepRemove(context: RunContext): Promise<void> {
    const { deployment } = context;
    await this.stepUnroute(context);
    if (
      deployment.dokploy &&
      (await dokployService.composeExists(deployment.dokploy.composeId))
    ) {
      await dokployService.deleteCompose(deployment.dokploy.composeId);
    }
    deployment.dokploy = null;
    await DeploymentModel.updateOne(
      { _id: deployment._id },
      { $set: { dokploy: null } },
    ).exec();

    if (uptimeKumaService.configured) {
      for (const { monitorId } of [...deployment.monitors]) {
        await uptimeKumaService.deleteMonitor(monitorId);
        await DeploymentModel.updateOne(
          { _id: deployment._id },
          { $pull: { monitors: { monitorId } } },
        ).exec();
      }
    }

    // Back to the product's: every value the customer filled in (every
    // variant's, so switching later asks for them afresh too) and every
    // override of the environment or compose file an admin made.
    const cleared = diffOverrides(overridesOf(deployment), {
      env: [],
      composeFile: null,
    });
    deployment.values = [];
    deployment.overrides = { env: [], composeFile: null };
    await DeploymentModel.updateOne(
      { _id: deployment._id },
      { $set: { values: [], overrides: { env: [], composeFile: null } } },
    ).exec();
    if (cleared.length > 0) {
      const starter = context.run.startedBy
        ? await UserModel.findById(context.run.startedBy).exec()
        : null;
      const at = new Date();
      await DeploymentChangeModel.insertMany(
        cleared.map((change) => ({
          ...change,
          deploymentId: deployment._id,
          byUserId: starter?._id ?? null,
          byEmail: `${starter?.email ?? "the app"} (${context.run.action === "wipe" ? "Delete data" : "Erase data"})`,
          at,
        })),
      );
    }
  }

  private async stepUnroute({ deployment }: RunContext): Promise<void> {
    for (const host of [...deployment.routedHosts]) {
      await cloudflareService.removeRoute(host);
      await DeploymentModel.updateOne(
        { _id: deployment._id },
        { $pull: { routedHosts: host } },
      ).exec();
    }
  }

  /** Marks the run failed at `stepKey`, the deployment failed, tells admins. */
  private async failRun(
    run: RunDoc,
    stepKey: string | null,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    for (const step of run.steps) {
      if (step.key === stepKey) {
        step.status = "failed";
        step.error = reason;
        step.startedAt ??= now;
        step.finishedAt = now;
      }
    }
    run.markModified("steps");
    run.status = "failed";
    run.finishedAt = now;
    await run.save();
    // Nothing was stopped or erased yet: it is still off, as it was.
    const untouched =
      (run.action === "wipe" || run.action === "erase") &&
      stepKey === "wipeCheck";
    // A failed command leaves the service as it was: running. A sync
    // corrects that if it is not.
    const state =
      run.action === "command" ? "running" : untouched ? "stopped" : "failed";
    await DeploymentModel.updateOne(
      { _id: run.deploymentId },
      { $set: { state } },
    ).exec();

    logger.error(
      `Deployment run ${run.id} (${run.action}) failed at ${stepKey ?? "start"}: ${reason}`,
      SOURCE,
      "failRun",
    );
    await this.notifyOwner(run, false);
    await this.notifyAdmins(run, stepKey, reason).catch((error: unknown) => {
      logger.error(
        `Could not tell admins about run ${run.id}: ${messageOf(error)}`,
        SOURCE,
        "failRun",
      );
    });
  }

  /**
   * Tells the customer in the app (no email) how turning their service on,
   * off or restarting it went. Other actions are not announced. Never throws.
   */
  private async notifyOwner(
    run: RunDoc,
    succeeded: boolean,
    productName?: string,
    variantName?: string,
  ): Promise<void> {
    const messages =
      run.action === "redeploy" && run.startedBy === null
        ? {
            ...VARIANT_MESSAGES,
            done: (name: string) =>
              VARIANT_MESSAGES.done(name, variantName ?? null),
          }
        : OWNER_MESSAGES[run.action];
    if (!messages) return;
    try {
      const name =
        productName ??
        (await ProductModel.findById(run.productId).select("name").exec())
          ?.name ??
        "Your service";
      await notificationService.send({
        userId: String(run.userId),
        title: (succeeded ? messages.done : messages.failed)(name).slice(
          0,
          100,
        ),
        body: succeeded
          ? messages.doneBody
          : "Something went wrong. Our team has been told and will look into it.",
        link: `/dashboard/deployments/${String(run.productId)}`,
        channels: "in_app",
      });
    } catch (error) {
      logger.error(
        `Could not notify the owner of run ${run.id}: ${messageOf(error)}`,
        SOURCE,
        "notifyOwner",
      );
    }
  }

  private async notifyAdmins(
    run: RunDoc,
    stepKey: string | null,
    reason: string,
  ): Promise<void> {
    const [admins, user, product] = await Promise.all([
      UserModel.find({ role: "admin", isBlocked: false })
        .select("email")
        .exec(),
      UserModel.findById(run.userId).select("email").exec(),
      ProductModel.findById(run.productId).select("name").exec(),
    ]);
    const step = run.steps.find((item) => item.key === stepKey);
    await mailer.sendDeploymentFailure(
      admins.map((admin) => admin.email),
      {
        customerEmail: user?.email ?? String(run.userId),
        productName: product?.name ?? String(run.productId),
        action: run.command
          ? `${ACTION_LABELS[run.action]}: ${run.command.label}`
          : ACTION_LABELS[run.action],
        step: step
          ? `${step.label}: ${step.internalLabel}`
          : "Before the first step",
        reason,
        adminUrl: `${env.frontendUrl}/admin/users/${String(run.userId)}?tab=deployments`,
      },
    );
  }

  // ---------------------------------------------------------------- helpers

  private async loadUser(userId: string): Promise<UserDoc> {
    const user = await UserModel.findById(userId).exec();
    if (!user) throw new Error("User not found");
    return user;
  }

  private async loadProduct(productId: string): Promise<ProductDoc> {
    const product = await ProductModel.findById(productId).exec();
    if (!product || product.kind !== "subscription") {
      throw new Error("Subscription not found");
    }
    return product;
  }

  private async findOrCreate(
    userId: string,
    productId: string,
  ): Promise<DeploymentDoc> {
    try {
      return await DeploymentModel.findOneAndUpdate(
        { userId, productId },
        { $setOnInsert: { userId, productId } },
        { upsert: true, new: true },
      ).orFail();
    } catch (error) {
      // Two first requests at once: the other one created it.
      if (!isDuplicateKeyError(error)) throw error;
      return DeploymentModel.findOne({ userId, productId }).orFail().exec();
    }
  }

  /**
   * The user's USERNAME, fixed at first use. When another user already has
   * the one from their email, a number is added: jo, jo2, jo3…
   */
  private async ensureUsername(user: UserDoc): Promise<string> {
    if (user.deployUsername) return user.deployUsername;
    const base = usernameFromEmail(user.email);
    for (let suffix = 1; suffix <= MAX_SUFFIX; suffix++) {
      const candidate = suffix === 1 ? base : `${base}${suffix}`;
      try {
        const updated = await UserModel.findOneAndUpdate(
          { _id: user._id, deployUsername: { $exists: false } },
          { $set: { deployUsername: candidate } },
          { new: true },
        ).exec();
        const username = updated?.deployUsername;
        if (username) {
          user.deployUsername = username;
          return username;
        }
        // Set meanwhile by another request.
        const fresh = await UserModel.findById(user._id).exec();
        if (fresh?.deployUsername) return fresh.deployUsername;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
    throw new Error(`No free username left for ${user.email}`);
  }

  private async toOut(
    user: UserDoc,
    product: ProductDoc,
    deployment: DeploymentDoc | null,
    entitled: boolean,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const schedule = await userProductService.variantSchedule(
      user.id,
      product.id,
    );
    // What the customer sees and fills is for the variant they are on.
    const config = deploymentFor(product, schedule.current?.variantId);
    // What runs may still be another variant, until it is redeployed: its
    // commands and addresses are the ones that work now.
    const running = deployment?.pushed
      ? deploymentFor(product, deployment.deployedVariantId)
      : config;
    const state = deployment?.state ?? "notDeployed";
    const username = user.deployUsername ?? usernameFromEmail(user.email);
    const resolved = config
      ? resolveDeployment(
          config,
          builtInsFor(user, username),
          valuesOf(deployment),
        )
      : null;

    const builtIns = builtInsFor(user, username);
    // Customers see what really runs, an admin's overrides included; the
    // product's visibility decides whether they may change it. Admins edit
    // the customer's own values here and the overrides in their section.
    const shown =
      view === "customer" && resolved
        ? applyOverrides(resolved, overridesOf(deployment), builtIns)
        : resolved;
    const variables: DeploymentVariableOutDto[] = (config?.variables ?? [])
      .filter(
        (variable) => view === "admin" || variable.visibility !== "hidden",
      )
      .map((variable) => {
        const value = shown?.env[variable.key] ?? "";
        const setOnce = isSetOnce(variable.visibility);
        const filled = setOnce && Boolean(value.trim());
        const secret = variable.visibility === "setOnceHidden";
        const concealed = view === "customer" && filled && secret;
        return {
          key: variable.key,
          value: concealed ? "" : value,
          editable:
            variable.visibility === "editable" ||
            (setOnce && (view === "admin" || !filled)),
          setOnce,
          filled,
          secret,
          placeholder: setOnce
            ? renderTemplate(variable.value, builtIns) || null
            : null,
          ...(view === "admin" ? { visibility: variable.visibility } : {}),
        };
      });

    const runs = deployment
      ? await DeploymentRunModel.find({ deploymentId: deployment._id })
          .sort({ startedAt: -1 })
          .limit(RUNS_SHOWN)
          .exec()
      : [];

    const [status, endsAt, cameUp] = await Promise.all([
      this.statusOf(deployment),
      entitled ? userProductService.runsUntil(user.id, product.id) : null,
      deployment && state === "running"
        ? DeploymentRunModel.findOne({
            deploymentId: deployment._id,
            status: "succeeded",
            action: { $ne: "turnOff" },
          })
            .sort({ startedAt: -1 })
            .select("finishedAt")
            .exec()
        : null,
    ]);

    const overrides = overridesOf(deployment);
    const changes =
      view === "admin" && deployment
        ? await DeploymentChangeModel.find({ deploymentId: deployment._id })
            .sort({ at: -1 })
            .limit(CHANGES_SHOWN)
            .exec()
        : [];
    const reset: CustomerFolders = config
      ? resetFoldersOf(
          config,
          effectiveOf(config, builtInsFor(user, username), deployment),
          composeFileOf(overrides, config.composeFile),
        )
      : { folders: [], skipped: [] };
    const wipeReason = wipeBlocker(state, entitled, reset.folders.length);
    const actions = allowedActions(state, entitled).filter(
      (action) =>
        action === "turnOff" ||
        (action === "erase" ? reset.folders.length > 0 : Boolean(config)),
    );

    return {
      product: toProductSummary(product),
      notices: noticesOf(product),
      entitled,
      state,
      subscriptionEndsAt: endsAt?.toISOString() ?? null,
      runningSince: cameUp?.finishedAt?.toISOString() ?? null,
      hosts:
        running && env.deployDomain
          ? resolveDeployment(
              running,
              builtInsFor(user, username),
              valuesOf(deployment),
            ).domains.map(({ host }) => host)
          : (deployment?.routedHosts ?? []),
      variables,
      missingValues: config
        ? missingValues(config.variables, filledValuesOf(deployment))
        : [],
      status,
      actions,
      commands: (running?.commands ?? []).map(({ id, label }) => ({
        id,
        label,
      })),
      commandsBlocked: commandBlocker(state, entitled),
      runs: runs.map((run) => toRunOut(run, view)),
      variant: variantOut(product, deployment, schedule),
      ...(view === "admin"
        ? {
            internal: {
              name: deployment?.name ?? resolved?.name ?? null,
              username,
              composeId: deployment?.dokploy?.composeId ?? null,
              appName: deployment?.dokploy?.appName ?? null,
              routedHosts: deployment?.routedHosts ?? [],
              resetFolders: reset.folders,
              resetSkipped: reset.skipped,
              wipe: {
                allowed: wipeReason === null,
                reason: wipeReason,
              },
              monitors: (deployment?.monitors ?? []).map(
                ({ host, monitorId }) => ({ host, monitorId }),
              ),
              update: updateOf(
                user,
                product,
                deployment,
                schedule.current?.variantId,
              ),
              pushedAt: deployment?.pushed?.at?.toISOString() ?? null,
              overrides: {
                // Every product variable, then overrides of other names.
                env: [
                  ...new Set([
                    ...(config?.variables ?? []).map(({ key }) => key),
                    ...overrides.env.map(({ key }) => key),
                  ]),
                ].map((key) => ({
                  key,
                  productValue: resolved?.env[key] ?? null,
                  override:
                    overrides.env.find((item) => item.key === key)?.value ??
                    null,
                })),
                composeFile: overrides.composeFile,
                productComposeFile:
                  variantOf(product, schedule.current?.variantId)
                    ?.composeFile ??
                  config?.composeFile ??
                  "",
                changes: changes.map((change) => ({
                  id: change.id,
                  at: change.at.toISOString(),
                  byEmail: change.byEmail,
                  target: change.target,
                  key: change.key,
                  before: change.before,
                  after: change.after,
                })),
              },
            },
          }
        : {}),
    };
  }
}

export const deploymentService = new DeploymentService();
