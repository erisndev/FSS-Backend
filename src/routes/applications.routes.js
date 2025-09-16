import { Router } from "express";
import { protect, authorize, upload } from "../middleware/upload.js";
import {
  applyToTender,
  myApplications,
  receivedApplications,
  setApplicationStatus,
  withdrawApplication,
  getApplicationById,
  getAllApplications,
} from "../controllers/applications.controller.js";

const router = Router();

// Apply to tender (bidder) with files
router.post(
  "/:tenderId",
  protect,
  authorize("bidder"),
  upload.array("files"), // <-- multiple files
  applyToTender
);

router.get("/my", protect, authorize("bidder"), myApplications);
router.get(
  "/received/:tenderId",
  protect,
  authorize("issuer", "admin"),
  receivedApplications
);
router.put(
  "/:id/status",
  protect,
  authorize("issuer", "admin"),
  setApplicationStatus
);
router.delete(
  "/:id",
  protect,
  authorize("bidder", "admin"),
  withdrawApplication
);
router.get(
  "/:id",
  protect,
  authorize("bidder", "issuer", "admin"),
  getApplicationById
);
router.get("/", protect, authorize("admin"), getAllApplications);

export default router;
