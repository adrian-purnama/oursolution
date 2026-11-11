import { model, Schema } from "mongoose";
import {
  DeploymentRunInterface,
  RUN_ACTIONS,
  RUN_STATUSES,
  RunStep,
  STEP_STATUSES,
} from "./deploymentRun.interface";

const stepSchema = new Schema<RunStep>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    internalLabel: { type: String, required: true },
    status: { type: String, required: true, enum: STEP_STATUSES },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false },
);

const deploymentRunSchema = new Schema<DeploymentRunInterface>({
  deploymentId: {
    type: Schema.Types.ObjectId,
    ref: "Deployment",
    required: true,
  },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  action: { type: String, required: true, enum: RUN_ACTIONS },
  status: { type: String, required: true, enum: RUN_STATUSES },
  steps: { type: [stepSchema], default: [] },
  startedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, default: null },
});

deploymentRunSchema.index({ deploymentId: 1, startedAt: -1 });
deploymentRunSchema.index({ status: 1 });

export const DeploymentRunModel = model<DeploymentRunInterface>(
  "DeploymentRun",
  deploymentRunSchema,
);
