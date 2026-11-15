import { Router } from "express";
import { requireUser } from "../../middleware/requireUser";
import { NotificationController } from "./notification.controller";

const router = Router();
const notificationController = new NotificationController();

// Mounted at /notifications: the signed-in user's own notifications.
router.use(requireUser);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.get("/stream", notificationController.stream);
router.post("/read-all", notificationController.markAllRead);
router.patch("/:id/read", notificationController.markRead);

export default router;
