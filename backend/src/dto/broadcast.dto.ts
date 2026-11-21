import type {
  BroadcastProductMatch,
  BroadcastStatus,
} from "../models/broadcast/broadcast.interface";
import type { DeploymentState } from "../models/deployment/deployment.interface";

/** Who an admin email goes to, as the API takes it. */
export type BroadcastAudienceInDto =
  | { type: "all" }
  | { type: "users"; userIds: string[] }
  | {
      type: "product";
      productId: string;
      match: "active";
    }
  | {
      type: "product";
      productId: string;
      match: "deployment";
      states: DeploymentState[];
    };

export interface SendBroadcastInDto {
  subject: string;
  body: string;
  link: string | null;
  buttonLabel: string | null;
  inApp: boolean;
  audience: BroadcastAudienceInDto;
}

export interface BroadcastRecipientDto {
  id: string;
  email: string;
}

export interface BroadcastAudiencePreviewOutDto {
  count: number;
  label: string;
  /** The first few recipients, by email. */
  sample: BroadcastRecipientDto[];
}

export interface BroadcastOutDto {
  id: string;
  subject: string;
  body: string;
  link: string | null;
  buttonLabel: string | null;
  inApp: boolean;
  audienceType: "all" | "users" | "product";
  productMatch: BroadcastProductMatch | null;
  audienceLabel: string;
  status: BroadcastStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface BroadcastListOutDto {
  items: BroadcastOutDto[];
  page: number;
  pageSize: number;
  total: number;
}
