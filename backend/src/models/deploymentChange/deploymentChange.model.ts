import { model, Schema } from "mongoose";
import {
  CHANGE_TARGETS,
  DeploymentChangeInterface,
} from "./deploymentChange.interface";

const deploymentChangeSchema = new Schema<DeploymentChangeInterface>({
  deploymentId: {
    type: Schema.Types.ObjectId,
    ref: "Deployment",
    required: true,
  },
  byUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  byEmail: { type: String, required: true },
  target: { type: String, required: true, enum: CHANGE_TARGETS },
  key: { type: String, default: null },
  before: { type: String, default: null },
  after: { type: String, default: null },
  at: { type: Date, required: true, default: () => new Date() },
});

deploymentChangeSchema.index({ deploymentId: 1, at: -1 });

export const DeploymentChangeModel = model<DeploymentChangeInterface>(
  "DeploymentChange",
  deploymentChangeSchema,
);
