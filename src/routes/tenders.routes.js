import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createTender,
  listTenders,
  getTender,
  updateTender,
  deleteTender,
} from "../controllers/tenders.controller.js";

const router = Router();

router.get("/", listTenders);
router.get("/:id", getTender);

router.post(
  "/",
  protect,
  authorize("issuer", "admin"),
  upload.array("documents", 10), // ← match frontend field name
  createTender
);

router.put(
  "/:id",
  protect,
  authorize("issuer", "admin"),
  upload.array("documents", 10),
  updateTender
);

router.delete("/:id", protect, authorize("issuer", "admin"), deleteTender);

export default router;
