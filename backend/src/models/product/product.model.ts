import { model, Schema } from "mongoose";
import {
  DEPLOYMENT_TYPES,
  DeploymentCommand,
  DeploymentDomain,
  DeploymentVariable,
  NOTICE_TONES,
  PRODUCT_KINDS,
  ProductNotice,
  ProductDeployment,
  ProductInterface,
  ProductVariant,
  VARIABLE_VISIBILITIES,
  VariantDeployment,
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

const commandSchema = new Schema<DeploymentCommand>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    serviceName: { type: String, required: true },
    command: { type: String, required: true },
  },
  { _id: false },
);

const noticeSchema = new Schema<ProductNotice>(
  {
    tone: { type: String, required: true, enum: NOTICE_TONES },
    text: { type: String, required: true },
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
    commands: { type: [commandSchema], default: [] },
  },
  { _id: false },
);

const variantDeploymentSchema = new Schema<VariantDeployment>(
  {
    composeFile: { type: String, required: true },
    variables: { type: [variableSchema], default: [] },
    domains: { type: [domainSchema], default: [] },
    commands: { type: [commandSchema], default: [] },
  },
  { _id: false },
);

const variantSchema = new Schema<ProductVariant>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    specs: { type: String, default: "" },
    pricingText: { type: String, default: "" },
    description: { type: String, default: "" },
    priceIdr: { type: Number, required: true, min: 0 },
    priceUsdCents: { type: Number, default: null, min: 0 },
    paddlePriceId: { type: String, default: null },
    durationDays: { type: Number, required: true, min: 1 },
    deployment: { type: variantDeploymentSchema, default: null },
    // Legacy: read only while `deployment` is null.
    composeFile: { type: String, default: null },
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
    // Markdown; the frontend renders it formatted on the product page.
    description: {
      type: String,
      required: false,
      default: "",
    },
    // Markdown each; rules and disclaimers shown to buyers and subscribers.
    notices: {
      type: [noticeSchema],
      default: [],
    },
    priceIdr: {
      type: Number,
      required: true,
      min: 0,
    },
    priceUsdCents: {
      type: Number,
      default: null,
      min: 0,
    },
    paddlePriceId: {
      type: String,
      default: null,
    },
    paddleProductId: {
      type: String,
      default: null,
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
    // The base variant is the product's own price, days and compose file.
    variantName: {
      type: String,
      default: "",
    },
    variantSpecs: {
      type: String,
      default: "",
    },
    variants: {
      type: [variantSchema],
      default: [],
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
    // In display order; the first is the cover. Older products had a single
    // `image`, moved here at startup (ProductService.migrateLegacyImages).
    images: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const ProductModel = model<ProductInterface>("Product", productSchema);
