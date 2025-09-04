import { Router } from "express";
import {
  register,
  login,
  me,
  updateMe,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Current user routes
router.get("/me", protect, me);
router.put("/me", protect, updateMe);

// Admin routes
router.get("/users", protect, getAllUsers);
router.get("/users/:id", protect, getUserById);
router.put("/users/:id", protect, updateUserById);
router.delete("/users/:id", protect, deleteUserById);

export default router;
