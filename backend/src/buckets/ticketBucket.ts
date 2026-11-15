import { Types } from "mongoose";
import {
  deleteFileIfExists,
  findFile,
  openDownload,
  uploadFile,
  type GridFsFileResult,
} from "./gridfs";

/**
 * Private: ticket photos. Nothing serves this bucket by id; a photo is only
 * read through a signed, short-lived link to its message (modules/ticket).
 */
const BUCKET = "ticketAttachments";

export async function uploadTicketFile(opts: {
  buffer: Buffer;
  path: string;
  contentType: string;
  ticketId: Types.ObjectId;
  messageId: Types.ObjectId;
}): Promise<GridFsFileResult> {
  return uploadFile(BUCKET, {
    buffer: opts.buffer,
    filename: opts.path,
    contentType: opts.contentType,
    metadata: { ticketId: opts.ticketId, messageId: opts.messageId },
  });
}

export async function deleteTicketFile(
  id: string | Types.ObjectId,
): Promise<void> {
  await deleteFileIfExists(BUCKET, id);
}

export async function findTicketFile(id: string | Types.ObjectId) {
  return findFile(BUCKET, id);
}

export function openTicketDownload(id: string | Types.ObjectId) {
  return openDownload(BUCKET, id);
}
