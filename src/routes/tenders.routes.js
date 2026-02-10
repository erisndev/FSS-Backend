import express from "express";
import { protect, authorize, upload } from "../middleware/upload.js";
import {
  createTender,
  updateTender,
  listTenders,
  getTender,
  deleteTender,
  getMyTenders,
  checkTenderVerification,
} from "../controllers/tenders.controller.js";

const router = express.Router();

router.get("/", listTenders);
router.get("/my", protect, authorize("issuer", "admin"), getMyTenders);
router.get("/:id/check-verification", checkTenderVerification);
router.get("/:id", getTender);

router.post(
  "/",
  protect,
  authorize("issuer", "admin"),
  upload.fields([
    { name: "termsOfReference", maxCount: 1 },
    { name: "sbd1", maxCount: 1 },
    { name: "sbd2", maxCount: 1 },
    { name: "sbd4DeclarationOfInterest", maxCount: 1 },
    { name: "sbd61", maxCount: 1 },
    { name: "bidTechnicalSubmissionTemplate", maxCount: 1 },
    { name: "bidFinancialSubmissionTemplate", maxCount: 1 },
    { name: "annexure1", maxCount: 1 },
    { name: "annexure2", maxCount: 1 },
    { name: "annexure3", maxCount: 1 },
  ]),
  createTender
);
router.put(
  "/:id",
  protect,
  authorize("issuer", "admin"),
  upload.fields([
    { name: "termsOfReference", maxCount: 1 },
    { name: "sbd1", maxCount: 1 },
    { name: "sbd2", maxCount: 1 },
    { name: "sbd4DeclarationOfInterest", maxCount: 1 },
    { name: "sbd61", maxCount: 1 },
    { name: "bidTechnicalSubmissionTemplate", maxCount: 1 },
    { name: "bidFinancialSubmissionTemplate", maxCount: 1 },
    { name: "annexure1", maxCount: 1 },
    { name: "annexure2", maxCount: 1 },
    { name: "annexure3", maxCount: 1 },
  ]),
  updateTender
);
router.delete("/:id", protect, authorize("issuer", "admin"), deleteTender);

export default router;
