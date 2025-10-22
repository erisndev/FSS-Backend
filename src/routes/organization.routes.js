import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { isTeamLeader, verifyOrganizationAccess } from "../middleware/teamPermissions.js";
import {
  getOrganization,
  updateOrganization,
  deactivateOrganization,
  getOrganizationStats,
} from "../controllers/organization.controller.js";

const router = express.Router();

// All routes require authentication and issuer role
router.use(protect);
router.use(authorize("issuer", "admin"));

// Get organization details
router.get("/:id?", verifyOrganizationAccess, getOrganization);

// Update organization (team leader only)
router.put("/:id", verifyOrganizationAccess, isTeamLeader, updateOrganization);

// Deactivate organization (admin or team leader)
router.delete("/:id", verifyOrganizationAccess, isTeamLeader, deactivateOrganization);

// Get organization statistics
router.get("/:id/stats", verifyOrganizationAccess, getOrganizationStats);

export default router;
