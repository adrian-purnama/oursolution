import { model, Schema } from "mongoose";
import {
  DEPLOYMENT_TYPES,
  DeploymentDomain,
  DeploymentVariable,
  PRODUCT_KINDS,
  ProductDeployment,
  ProductInterface,
  VARIABLE_VISIBILITIES,
} from "./product.interface";

const variableSchema = new Schema<DeploymentVariable>(
  {
    key: { type: String, required: true },
    value: { type: String, default: "" },
    visibility: { type: String, required: true, enum: VARIABLE_VISIBILITIES },
  },
  { _id: false },
);

const domainSchema = new Schema<DeploymentDomain>(
  {
    serviceName: { type: String, required: true },
    subdomain: { type: String, required: true },
    port: { type: Number, required: true, min: 1, max: 65_535 },
  },
  { _id: false },
);

const deploymentSchema = new Schema<ProductDeployment>(
  {
    type: { type: String, required: true, enum: DEPLOYMENT_TYPES },
    projectId: { type: String, required: true },
    // Products saved before names existed have none until edited.
    name: { type: String, default: "" },
    composeFile: { type: String, required: true },
    variables: { type: [variableSchema], default: [] },
    domains: { type: [domainSchema], default: [] },
  },
  { _id: false },
);

const productSchema = new Schema<ProductInterface>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    kind: {
      type: String,
      required: true,
      enum: PRODUCT_KINDS,
      // Products made before kinds existed were all subscriptions.
      default: "subscription",
    },
    color: {
      type: String,
      required: true,
    },
    pricingText: {
      type: String,
      required: false,
      default: "",
    },
    description: {
      type: String,
      required: false,
      default: "",
    },
    priceIdr: {
      type: Number,
      required: true,
      min: 0,
    },
    durationDays: {
      type: Number,
      default: null,
      min: 1,
    },
    deployment: {
      type: deploymentSchema,
      default: null,
    },
    accessUrl: {
      type: String,
      default: null,
    },
    showOnPricingPage: {
      type: Boolean,
      required: true,
      default: false,
    },
    image: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const ProductModel = model<ProductInterface>("Product", productSchema);
