import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  applyToTender,
  myApplications,
  receivedApplications,
  setApplicationStatus,
  withdrawApplication,
  getApplicationById,
} from "../controllers/applications.controller.js";

const router = Router();

// Bidder applies to tender
router.post(
  "/:tenderId",
  protect,
  authorize("bidder"),
  upload.array("files", 10),
  applyToTender
);

// Bidder view own applications
router.get("/my", protect, authorize("bidder"), myApplications);

// Issuer/Admin view received applications for a tender
router.get(
  "/received/:tenderId",
  protect,
  authorize("issuer", "admin"),
  receivedApplications
);

// Update application status (issuer/admin)
router.put(
  "/:id/status",
  protect,
  authorize("issuer", "admin"),
  setApplicationStatus
);

// Withdraw application (bidder/admin)
router.delete(
  "/:id",
  protect,
  authorize("bidder", "admin"),
  withdrawApplication
);

// Get single application (bidder, issuer of tender, admin)
router.get(
  "/:id",
  protect,
  authorize("bidder", "issuer", "admin"),
  getApplicationById
);

export default router;
