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
  upload.fields([
    { name: "bidFileDocuments", maxCount: 1 },
    { name: "compiledDocuments", maxCount: 1 },
    { name: "financialDocuments", maxCount: 1 },
    { name: "technicalProposal", maxCount: 1 },
    { name: "proofOfExperience", maxCount: 1 },
    { name: "supportingDocuments", maxCount: 1 }, // Extra field for applications
  ]),
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
