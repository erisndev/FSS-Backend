import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import { isTeamLeader, verifyOrganizationAccess } from "../middleware/teamPermissions.js";
import {
  inviteTeamMember,
  validateInvitation,
  acceptInvitation,
  getPendingInvitations,
  resendInvitation,
  cancelInvitation,
  getTeamMembers,
  getTeamMember,
  updateMemberPermissions,
  removeTeamMember,
  getTeamMemberActivity,
  getPermissionPresets,
} from "../controllers/teamMember.controller.js";

const router = express.Router();

// Public routes for invitations (no auth required)
router.get("/invitations/:token/validate", validateInvitation);
router.post("/invitations/:token/accept", acceptInvitation);

// All other routes require authentication and issuer role
router.use(protect);
router.use(authorize("issuer", "admin"));

// Get permission presets (available to all issuers)
router.get("/presets/permissions", getPermissionPresets);

// Organization-specific routes
router.post("/:organizationId/invitations", verifyOrganizationAccess, isTeamLeader, inviteTeamMember);
router.get("/:organizationId/invitations", verifyOrganizationAccess, isTeamLeader, getPendingInvitations);
router.post("/:organizationId/invitations/:invitationId/resend", verifyOrganizationAccess, isTeamLeader, resendInvitation);
router.delete("/:organizationId/invitations/:invitationId", verifyOrganizationAccess, isTeamLeader, cancelInvitation);

router.get("/:organizationId/members", verifyOrganizationAccess, getTeamMembers);
router.get("/:organizationId/members/:memberId", verifyOrganizationAccess, getTeamMember);
router.put("/:organizationId/members/:memberId", verifyOrganizationAccess, isTeamLeader, updateMemberPermissions);
router.delete("/:organizationId/members/:memberId", verifyOrganizationAccess, isTeamLeader, removeTeamMember);
router.get("/:organizationId/members/:memberId/activity", verifyOrganizationAccess, isTeamLeader, getTeamMemberActivity);

export default router;
