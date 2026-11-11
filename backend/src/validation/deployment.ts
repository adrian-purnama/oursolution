import type {
  DeploymentActionInDto,
  UpdateDeploymentValuesInDto,
} from "../dto/deployment.dto";
import {
  RUN_ACTIONS,
  type RunAction,
} from "../models/deploymentRun/deploymentRun.interface";

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
