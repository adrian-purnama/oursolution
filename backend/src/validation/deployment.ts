import { Types } from "mongoose";
import type {
  DeploymentActionInDto,
  DeploymentBulkInDto,
  UpdateDeploymentOverridesInDto,
  UpdateDeploymentValuesInDto,
} from "../dto/deployment.dto";
import {
  BULK_ACTIONS,
  RUN_ACTIONS,
  type BulkAction,
  type RunAction,
} from "../models/deploymentRun/deploymentRun.interface";
import { MAX_BULK_TARGETS } from "../modules/deployment/deployment.rules";

const MAX_VALUES = 100;
const MAX_VALUE_LENGTH = 4000;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid request body");
  }
  return body as Record<string, unknown>;
}

/** Body: `{ action }`. */
export function parseDeploymentActionInDto(
  body: unknown,
): DeploymentActionInDto {
  const { action } = asRecord(body);
  if (!RUN_ACTIONS.includes(action as RunAction)) {
    throw new Error(`action must be one of ${RUN_ACTIONS.join(", ")}`);
  }
  return { action: action as RunAction };
}

/** Body: `{ action, targets: [{ userId, productId }] }`. */
export function parseDeploymentBulkInDto(body: unknown): DeploymentBulkInDto {
  const { action, targets } = asRecord(body);
  if (!BULK_ACTIONS.includes(action as BulkAction)) {
    throw new Error(`action must be one of ${BULK_ACTIONS.join(", ")}`);
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("Select at least one deployment");
  }
  if (targets.length > MAX_BULK_TARGETS) {
    throw new Error(`Select at most ${MAX_BULK_TARGETS} deployments at once`);
  }
  return {
    action: action as BulkAction,
    targets: targets.map((raw) => {
      const { userId, productId } = asRecord(raw);
      if (
        typeof userId !== "string" ||
        typeof productId !== "string" ||
        !Types.ObjectId.isValid(userId) ||
        !Types.ObjectId.isValid(productId)
      ) {
        throw new Error("Each target needs a valid userId and productId");
      }
      return { userId, productId };
    }),
  };
}

const MAX_COMPOSE_LENGTH = 100_000;

/**
 * Body: `{ env: [{ key, value }], composeFile: string | null }`. Keys are
 * trimmed; values are kept as typed, one line each.
 */
export function parseUpdateDeploymentOverridesInDto(
  body: unknown,
): UpdateDeploymentOverridesInDto {
  const { env, composeFile } = asRecord(body);
  if (!Array.isArray(env)) throw new Error("env must be a list");
  if (env.length > MAX_VALUES) throw new Error("Too many overrides");
  const entries = env.map((raw) => {
    const { key, value } = asRecord(raw);
    if (typeof key !== "string" || typeof value !== "string") {
      throw new Error("Each override needs a key and a value");
    }
    const name = key.trim();
    if (value.length > MAX_VALUE_LENGTH) throw new Error(`${name} is too long`);
    if (/[\r\n]/.test(value)) throw new Error(`${name} must be on one line`);
    return { key: name, value };
  });
  if (composeFile !== null && typeof composeFile !== "string") {
    throw new Error("composeFile must be text or null");
  }
  if (typeof composeFile === "string" && composeFile.length > MAX_COMPOSE_LENGTH) {
    throw new Error("The compose file is too long");
  }
  return { env: entries, composeFile };
}

/** Body: `{ values: { KEY: "value" } }`, one line each. */
export function parseUpdateDeploymentValuesInDto(
  body: unknown,
): UpdateDeploymentValuesInDto {
  const values = asRecord(asRecord(body).values);
  const entries = Object.entries(values);
  if (entries.length > MAX_VALUES) throw new Error("Too many values");
  for (const [key, value] of entries) {
    if (typeof value !== "string") throw new Error(`${key} must be text`);
    if (value.length > MAX_VALUE_LENGTH) throw new Error(`${key} is too long`);
    if (/[\r\n]/.test(value)) throw new Error(`${key} must be on one line`);
  }
  return { values: values as Record<string, string> };
}
