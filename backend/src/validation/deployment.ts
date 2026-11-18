import { Types } from "mongoose";
import type {
  DeploymentActionInDto,
  DeploymentBulkInDto,
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
