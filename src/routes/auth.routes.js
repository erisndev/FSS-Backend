// auth.routes.js
import express from "express";
import { protect, authorize } from "../middleware/upload.js";
import {
  register,
  login,
  me,
  updateMe,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  requestPasswordReset,
  resetPassword,
  resendRegisterOTP,
  resendPasswordResetOTP,
  verifyRegisterOTP,
  verifyResetOTP,
} from "../controllers/auth.controller.js";

const router = express.Router();

// ---------------- AUTH ROUTES ----------------
router.post("/register", register);
router.post("/login", login);
router.post("/verify-register-otp", verifyRegisterOTP); // NEW
router.post("/verify-reset-otp", verifyResetOTP); // NEW

// ---------------- PASSWORD RESET ----------------
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

// ---------------- RESEND OTP ----------------
router.post("/resend-register-otp", resendRegisterOTP);
router.post("/resend-reset-otp", resendPasswordResetOTP);

// ---------------- CURRENT USER ----------------
router.get("/me", protect, me);
router.put("/me", protect, updateMe);

// ---------------- ADMIN ----------------
router.get("/", protect, authorize("admin"), getAllUsers);
router.get("/:id", protect, authorize("admin"), getUserById);
router.put("/:id", protect, authorize("admin"), updateUserById);
router.delete("/:id", protect, authorize("admin"), deleteUserById);

export default router;
