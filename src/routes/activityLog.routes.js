import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { isTeamLeader, verifyOrganizationAccess } from "../middleware/teamPermissions.js";
import {
  getOrganizationActivities,
  getMemberActivities,
  getResourceActivities,
  getActivityStats,
  exportActivities,
} from "../controllers/activityLog.controller.js";

const router = express.Router();

// All routes require authentication and issuer role
router.use(protect);
router.use(authorize("issuer", "admin"));

// Get organization activities (team leader only)
router.get("/:organizationId", verifyOrganizationAccess, isTeamLeader, getOrganizationActivities);

// Get member activities (team leader only)
router.get("/:organizationId/member/:memberId", verifyOrganizationAccess, isTeamLeader, getMemberActivities);

// Get resource-specific activities
router.get("/resource/:resourceId", getResourceActivities);

// Get activity statistics (team leader only)
router.get("/:organizationId/stats", verifyOrganizationAccess, isTeamLeader, getActivityStats);

// Export activities (team leader only)
router.get("/:organizationId/export", verifyOrganizationAccess, isTeamLeader, exportActivities);

export default router;
