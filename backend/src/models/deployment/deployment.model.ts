import { model, Schema } from "mongoose";
import {
  DEPLOYMENT_STATES,
  DeploymentInterface,
  DeploymentMonitor,
  DeploymentValue,
  DokployLink,
} from "./deployment.interface";

const valueSchema = new Schema<DeploymentValue>(
  {
    key: { type: String, required: true },
    value: { type: String, default: "" },
  },
  { _id: false },
);

const dokploySchema = new Schema<DokployLink>(
  {
    projectId: { type: String, required: true },
    environmentId: { type: String, required: true },
    composeId: { type: String, required: true },
    appName: { type: String, default: "" },
  },
  { _id: false },
);

const monitorSchema = new Schema<DeploymentMonitor>(
  {
    host: { type: String, required: true },
    monitorId: { type: Number, required: true },
  },
  { _id: false },
);

const deploymentSchema = new Schema<DeploymentInterface>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    state: {
      type: String,
      required: true,
      enum: DEPLOYMENT_STATES,
      default: "notDeployed",
    },
    values: { type: [valueSchema], default: [] },
    name: { type: String, default: null },
    routedHosts: { type: [String], default: [] },
    dokploy: { type: dokploySchema, default: null },
    deployedVariantId: { type: String, default: null },
    monitors: { type: [monitorSchema], default: [] },
  },
  { timestamps: true },
);

deploymentSchema.index({ userId: 1, productId: 1 }, { unique: true });
deploymentSchema.index({ routedHosts: 1 });

export const DeploymentModel = model<DeploymentInterface>(
  "Deployment",
  deploymentSchema,
);
