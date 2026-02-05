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
    { name: "bidFileDocuments", maxCount: 1 },
    { name: "compiledDocuments", maxCount: 1 },
    { name: "financialDocuments", maxCount: 1 },
    { name: "technicalProposal", maxCount: 1 },
    { name: "proofOfExperience", maxCount: 1 },
  ]),
  createTender
);
router.put(
  "/:id",
  protect,
  authorize("issuer", "admin"),
  upload.fields([
    { name: "bidFileDocuments", maxCount: 1 },
    { name: "compiledDocuments", maxCount: 1 },
    { name: "financialDocuments", maxCount: 1 },
    { name: "technicalProposal", maxCount: 1 },
    { name: "proofOfExperience", maxCount: 1 },
  ]),
  updateTender
);
router.delete("/:id", protect, authorize("issuer", "admin"), deleteTender);

export default router;
