import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  requestVerificationCode,
  getVerificationCodeRequests,
  approveVerificationCodeRequest,
  rejectVerificationCodeRequest,
  verifyCode,
  getMyVerificationCodeRequests,
  checkVerificationStatus,
} from "../controllers/verificationCode.controller.js";

const router = express.Router();

// Bidder routes
router.post("/request/:tenderId", protect, requestVerificationCode);
router.post("/verify/:tenderId", protect, verifyCode);
router.get("/status/:tenderId", protect, checkVerificationStatus);
router.get("/my-requests", protect, getMyVerificationCodeRequests);

// Admin/Issuer routes
router.get(
  "/requests",
  protect,
  authorize("admin", "issuer"),
  getVerificationCodeRequests
);
router.put(
  "/approve/:requestId",
  protect,
  authorize("admin", "issuer"),
  approveVerificationCodeRequest
);
router.put(
  "/reject/:requestId",
  protect,
  authorize("admin", "issuer"),
  rejectVerificationCodeRequest
);

export default router;