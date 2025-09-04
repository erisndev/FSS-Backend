import { Router } from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { download, upload } from "../controllers/files.controller.js";

const router = Router();

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const uploadMiddleware = multer({ storage });

// Routes
router.post("/upload", protect, uploadMiddleware.single("file"), upload);
router.get("/download", protect, download);

export default router;
