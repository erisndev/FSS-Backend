import express from "express";
import { protect, authorize, upload } from "../middleware/upload.js";
import {
  createTender,
  updateTender,
  listTenders,
  getTender,
  deleteTender,
  getMyTenders,
} from "../controllers/tenders.controller.js";

const router = express.Router();

router.get("/", listTenders);
router.get("/my", protect, authorize("issuer", "admin"), getMyTenders);
router.get("/:id", getTender);

router.post(
  "/",
  protect,
  authorize("issuer", "admin"),
  upload.array("documents"), // <-- multiple files
  createTender
);
router.put(
  "/:id",
  protect,
  authorize("issuer", "admin"),
  upload.array("documents"), // <-- multiple files
  updateTender
);
router.delete("/:id", protect, authorize("issuer", "admin"), deleteTender);

export default router;
