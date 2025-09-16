import express from "express";
import { protect } from "../middleware/upload.js";
import {
  listMyNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// Notifications
router.get("/", protect, listMyNotifications);
router.put("/:id/read", protect, markAsRead);
router.put("/read-all", protect, markAllAsRead); // ✅ new endpoint
router.delete("/clear", protect, clearNotifications);

export default router;
