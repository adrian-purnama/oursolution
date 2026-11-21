import { model, Schema } from "mongoose";
import { DEPLOYMENT_STATES } from "../deployment/deployment.interface";
import {
  BROADCAST_AUDIENCE_TYPES,
  BROADCAST_PRODUCT_MATCHES,
  BROADCAST_STATUSES,
  BroadcastAudience,
  BroadcastInterface,
} from "./broadcast.interface";

const audienceSchema = new Schema<BroadcastAudience>(
  {
    type: { type: String, required: true, enum: BROADCAST_AUDIENCE_TYPES },
    userIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    match: { type: String, enum: [...BROADCAST_PRODUCT_MATCHES, null], default: null },
    states: { type: [String], enum: DEPLOYMENT_STATES, default: [] },
  },
  { _id: false },
);

const broadcastSchema = new Schema<BroadcastInterface>(
  {
    subject: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    buttonLabel: { type: String, default: null },
    inApp: { type: Boolean, default: false },
    audience: { type: audienceSchema, required: true },
    audienceLabel: { type: String, default: "" },
    status: { type: String, required: true, enum: BROADCAST_STATUSES },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

broadcastSchema.index({ createdAt: -1 });

export const BroadcastModel = model<BroadcastInterface>(
  "Broadcast",
  broadcastSchema,
);
