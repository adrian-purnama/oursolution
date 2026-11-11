import type { HydratedDocument } from "mongoose";
import type {
  AdminDeploymentRowOutDto,
  DeploymentOutDto,
  DeploymentRunOutDto,
  DeploymentVariableOutDto,
  ServiceStatusOutDto,
} from "../../dto/deployment.dto";
import { env } from "../../environment/env";
import { logger } from "../../logger/logger";
import type {
  DeploymentInterface,
  DeploymentMonitor,
} from "../../models/deployment/deployment.interface";
import { DeploymentModel } from "../../models/deployment/deployment.model";
import type {
  DeploymentRunInterface,
  RunAction,
} from "../../models/deploymentRun/deploymentRun.interface";
import { DeploymentRunModel } from "../../models/deploymentRun/deploymentRun.model";
import type {
  ProductDeployment,
  ProductInterface,
} from "../../models/product/product.interface";
import { ProductModel } from "../../models/product/product.model";
import type { UserInterface } from "../../models/user/user.interface";
import { UserModel } from "../../models/user/user.model";
import {
  resolveDeployment,
  toEnvFile,
  usernameFromEmail,
  type BuiltInVariable,
  type ResolvedDeployment,
} from "../../utils/deployment";
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
import { entitlementService } from "../entitlement/entitlement.service";
import { mailer } from "../mail/mail.service";
import { toProductSummary } from "../product/product.service";
import { uptimeKumaService } from "../uptimeKuma/uptimeKuma.service";
import { userProductService } from "../userProduct/userProduct.service";
import {
  ACTION_LABELS,
  allowedActions,
  BUSY_STATES,
  mayBeRunning,
  nextAllowedStart,
  PIPELINES,
  shouldAutoTurnOff,
  START_HISTORY_MS,
  STATE_AFTER,
  wipeBlocker,
  STATE_DURING,
} from "./deployment.rules";

type DeploymentDoc = HydratedDocument<DeploymentInterface>;
type RunDoc = HydratedDocument<DeploymentRunInterface>;
type ProductDoc = HydratedDocument<ProductInterface>;
type UserDoc = HydratedDocument<UserInterface>;

/** Customers see vague step names and no errors; admins see everything. */
export type DeploymentView = "customer" | "admin";

const SOURCE = "modules/deployment/deployment.service.ts";
const RUNS_SHOWN = 5;
const MAX_SUFFIX = 9999;

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

/** A customer nobody is: "-" can never be a USERNAME or a user ID. */
const NOBODY = { USERNAME: "-", EMAIL: "-@-", USER_ID: "-" };

/**
 * The host folders that hold this customer's data only, which a reset
 * empties. `resolved` is the deployment as resolved for the customer.
 */
function resetFoldersOf(
  config: ProductDeployment,
  resolved: ResolvedDeployment,
): CustomerFolders {
  const nobody = resolveDeployment(
    config,
    { ...NOBODY, DOMAIN: env.deployDomain ?? "" },
    {},
  );
  const editable = new Set(
    config.variables
      .filter((variable) => variable.visibility === "editable")
      .map((variable) => variable.key),
  );
  return customerFolders(
    config.composeFile,
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

/** What a pipeline's steps share while it runs. */
interface RunContext {
  run: RunDoc;
  deployment: DeploymentDoc;
  product: ProductDoc;
  user: UserDoc;
  resolved: ResolvedDeployment | null;
  environmentId: string | null;
  /** Reset only: the folders the check step found safe to empty. */
  resetFolders: string[];
}

/**
 * Customers' deployments of subscription products: what they look like,
 * and the pipelines that deploy, restart and turn them off through Dokploy
 * and the Cloudflare tunnel. Runs go on in the background; their steps are
 * stored, so the page can follow them and they survive as history.
 */
export class DeploymentService {
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
   * Saves what the customer typed for editable variables. Applies at the
   * next deploy or redeploy; nothing is redeployed now.
   */
  async updateValues(
    userId: string,
    productId: string,
    values: Record<string, string>,
    view: DeploymentView,
  ): Promise<DeploymentOutDto> {
    const product = await this.loadProduct(productId);
    const editable = new Set(
      (product.deployment?.variables ?? [])
        .filter((variable) => variable.visibility === "editable")
        .map((variable) => variable.key),
    );
    for (const key of Object.keys(values)) {
      if (!editable.has(key)) throw new Error(`${key} cannot be changed`);
    }
    const deployment = await this.findOrCreate(userId, productId);
    const merged = { ...valuesOf(deployment), ...values };
    deployment.values = Object.entries(merged)
      .filter(([key]) => editable.has(key))
      .map(([key, value]) => ({ key, value }));
    await deployment.save();
    return this.get(userId, productId, view);
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
    if (action === "reset") {
      const out = await this.get(userId, productId, "admin");
      if (!out.actions.includes("reset")) {
        throw new Error(
          "This service keeps no data in a folder of its own, so there is nothing to reset",
        );
      }
    }

    if (view === "customer") {
      await this.assertWithinLimits(deployment, action, startedBy);
    }

    await this.launch(deployment, action, startedBy);
    return this.get(userId, productId, view);
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
      const [entitled, latest] = await Promise.all([
        entitlementService.canRunService(userId, productId, now),
        DeploymentRunModel.findOne({ deploymentId: deployment._id })
          .sort({ startedAt: -1 })
          .exec(),
      ]);
      const latestRun = latest
        ? {
            action: latest.action,
            automatic: latest.startedBy === null,
            failed: latest.status === "failed",
          }
        : null;
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
   * After a restart of this server, runs that were going on are marked
   * failed (they stopped mid-way) and admins are told.
   */
  async recoverInterruptedRuns(): Promise<void> {
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
  ): Promise<void> {
    const claimed = await DeploymentModel.findOneAndUpdate(
      { _id: deployment._id, state: { $nin: BUSY_STATES } },
      { $set: { state: STATE_DURING[action] } },
      { new: true },
    ).exec();
    if (!claimed) {
      throw new DeploymentBusyError(
        "Something is already in progress. Wait for it to finish",
      );
    }

    const run = await DeploymentRunModel.create({
      deploymentId: deployment._id,
      userId: deployment.userId,
      productId: deployment.productId,
      action,
      status: "running",
      steps: PIPELINES[action].map((step) => ({
        ...step,
        status: "pending",
        error: null,
        startedAt: null,
        finishedAt: null,
      })),
      startedBy,
      startedAt: new Date(),
      finishedAt: null,
    });

    void this.execute(run).catch((error: unknown) => {
      logger.error(
        `Deployment run ${run.id} crashed: ${messageOf(error)}`,
        SOURCE,
        "launch",
      );
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
      run.action === "wipe"
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
      case "stop":
        return this.stepStop(context);
      case "wipeCheck":
        return this.stepWipeCheck(context);
      case "wipe":
        return this.stepWipe(context);
      case "unroute":
        return this.stepUnroute(context);
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

    const username = await this.ensureUsername(user);
    const resolved = resolveDeployment(
      config,
      builtInsFor(user, username),
      valuesOf(deployment),
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

    if (context.run.action === "reset") {
      const { folders } = resetFoldersOf(config, resolved);
      if (folders.length === 0) {
        throw new Error(
          "The compose file mounts no host folder that is this customer's only and inside DEPLOY_DATA_ROOTS, so there is nothing to erase",
        );
      }
      await this.assertFoldersAreOwn(deployment, folders);
      context.resetFolders = folders;
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
   * Before deleting data: the service is off, nobody is entitled to it,
   * and the folders are this customer's only. Resolved with the username
   * the customer was deployed under, so the folders are the ones used.
   */
  private async stepWipeCheck(context: RunContext): Promise<void> {
    const { deployment, product, user } = context;
    const config = product.deployment;
    if (!config) throw new Error("The product has no deployment settings");
    if (!user.deployUsername) {
      throw new Error("It was never deployed, so there is no data");
    }
    if (await entitlementService.canRunService(user.id, product.id)) {
      throw new Error(
        "The subscription is active again, so its data is kept. Nothing was erased",
      );
    }
    const resolved = resolveDeployment(
      config,
      builtInsFor(user, user.deployUsername),
      valuesOf(deployment),
    );
    const { folders } = resetFoldersOf(config, resolved);
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
    const resolved = context.resolved;
    if (!config || !resolved || !context.environmentId) {
      throw new Error("The check step did not finish");
    }

    if (!deployment.dokploy) {
      const compose = await dokployService.createCompose({
        environmentId: context.environmentId,
        name: resolved.name,
        composeFile: config.composeFile,
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
    await dokployService.updateCompose(composeId, {
      composeFile: config.composeFile,
      env: toEnvFile(resolved.env),
    });
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
    await dokployService.stopCompose(deployment.dokploy.composeId);
    await dokployService.startCompose(deployment.dokploy.composeId);
  }

  private async stepStop({ deployment }: RunContext): Promise<void> {
    if (deployment.dokploy) {
      await dokployService.stopCompose(deployment.dokploy.composeId);
    }
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
      title: "Erase the customer's data (reset by the app)",
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
      const resolved = resolveDeployment(
        config,
        builtInsFor(
          owner,
          owner.deployUsername ?? usernameFromEmail(owner.email),
        ),
        valuesOf(other),
      );
      const mounted = hostPaths(config.composeFile, resolved.env);
      if (mounted === null) {
        throw new Error(
          `Product "${product.name}" mounts a path that cannot be read, so it is not certain the folders to erase are this customer's only`,
        );
      }
      const theirs = resetFoldersOf(config, resolved).folders;
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
    const untouched = run.action === "wipe" && stepKey === "wipeCheck";
    await DeploymentModel.updateOne(
      { _id: run.deploymentId },
      { $set: { state: untouched ? "stopped" : "failed" } },
    ).exec();

    logger.error(
      `Deployment run ${run.id} (${run.action}) failed at ${stepKey ?? "start"}: ${reason}`,
      SOURCE,
      "failRun",
    );
    await this.notifyAdmins(run, stepKey, reason).catch((error: unknown) => {
      logger.error(
        `Could not tell admins about run ${run.id}: ${messageOf(error)}`,
        SOURCE,
        "failRun",
      );
    });
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
        action: ACTION_LABELS[run.action],
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
    const config = product.deployment;
    const state = deployment?.state ?? "notDeployed";
    const username = user.deployUsername ?? usernameFromEmail(user.email);
    const resolved = config
      ? resolveDeployment(
          config,
          builtInsFor(user, username),
          valuesOf(deployment),
        )
      : null;

    const variables: DeploymentVariableOutDto[] = (config?.variables ?? [])
      .filter(
        (variable) => view === "admin" || variable.visibility !== "hidden",
      )
      .map((variable) => ({
        key: variable.key,
        value: resolved?.env[variable.key] ?? "",
        editable: variable.visibility === "editable",
        ...(view === "admin" ? { visibility: variable.visibility } : {}),
      }));

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

    const reset: CustomerFolders =
      config && resolved
        ? resetFoldersOf(config, resolved)
        : { folders: [], skipped: [] };
    const wipeReason = wipeBlocker(state, entitled, reset.folders.length);
    const actions = allowedActions(state, entitled).filter(
      (action) =>
        action === "turnOff" ||
        (action === "reset" ? reset.folders.length > 0 : Boolean(config)),
    );

    return {
      product: toProductSummary(product),
      entitled,
      state,
      subscriptionEndsAt: endsAt?.toISOString() ?? null,
      runningSince: cameUp?.finishedAt?.toISOString() ?? null,
      hosts:
        resolved && env.deployDomain
          ? resolved.domains.map(({ host }) => host)
          : (deployment?.routedHosts ?? []),
      variables,
      status,
      actions,
      runs: runs.map((run) => toRunOut(run, view)),
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
            },
          }
        : {}),
    };
  }
}

export const deploymentService = new DeploymentService();
