import { Router } from "express";
import { protect } from "../middleware/upload.js";
import { upload } from "../middleware/upload.js";
import { uploadFile, downloadFile } from "../controllers/files.controller.js";

const router = Router();

router.post("/upload", protect, upload.single("file"), uploadFile);
router.get("/download", protect, downloadFile);

export default router;
