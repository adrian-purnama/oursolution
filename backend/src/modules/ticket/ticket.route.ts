import { Router } from "express";
import { requireUser } from "../../middleware/requireUser";
import { uploadSingleImage } from "../../middleware/uploadImage";
import { MAX_TICKET_IMAGE_BYTES } from "../../utils/ticketImage";
import { TicketController } from "./ticket.controller";

const router = Router();
const ticketController = new TicketController();

// Before requireUser: an <img> sends no token; the signed link is the check.
router.get("/attachments/:messageId", ticketController.attachment);

// The signed-in user's own tickets. Admin access lives under /admin.
router.use(requireUser);

router.get("/", ticketController.listOwn);
router.post(
  "/",
  uploadSingleImage("image", MAX_TICKET_IMAGE_BYTES),
  ticketController.create,
);
router.get("/unread-count", ticketController.unreadCount);
router.get("/:id", ticketController.getOwn);
router.post(
  "/:id/messages",
  uploadSingleImage("image", MAX_TICKET_IMAGE_BYTES),
  ticketController.addUserMessage,
);

export default router;
