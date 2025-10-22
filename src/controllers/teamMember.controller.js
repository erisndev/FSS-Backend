import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import TeamInvitation from "../models/TeamInvitation.js";
import { logActivity } from "../utils/activityLogger.js";
import { sendTeamInvitationEmail } from "../utils/emails.js";
import crypto from "crypto";

// Permission presets for team members
const PERMISSION_PRESETS = {
  TEAM_LEADER: {
    canCreateTenders: true,
    canEditTenders: true,
    canDeleteTenders: true,
    canViewApplications: true,
    canAcceptReject: true,
    canManageVerificationRequests: true,
    canManageTeam: true,
  },
  FULL_ACCESS: {
    canCreateTenders: true,
    canEditTenders: true,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: true,
    canManageVerificationRequests: true,
    canManageTeam: false,
  },
  LIMITED_ACCESS: {
    canCreateTenders: true,
    canEditTenders: false,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: false,
    canManageVerificationRequests: false,
    canManageTeam: false,
  },
  VIEWER: {
    canCreateTenders: false,
    canEditTenders: false,
    canDeleteTenders: false,
    canViewApplications: true,
    canAcceptReject: false,
    canManageVerificationRequests: false,
    canManageTeam: false,
  },
};


// Get all team members for an organization
export const getTeamMembers = async (req, res) => {
  try {
    const organizationId = req.params.organizationId || req.user.organizationId;

    console.log("=== GET TEAM MEMBERS ===");
    console.log("Request params organizationId:", req.params.organizationId);
    console.log("User organizationId:", req.user?.organizationId);
    console.log("Using organizationId:", organizationId);

    // Only get active team members
    const teamMembers = await TeamMember.find({ 
      organization: organizationId,
      isActive: true 
    })
      .populate("user", "name email lastLogin")
      .sort({ role: -1, joinedAt: 1 })
      .lean();

    console.log("Found team members:", teamMembers.length);
    
    if (teamMembers.length > 0) {
      console.log("Team members:");
      teamMembers.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.user?.name} (${member.role}) - Active: ${member.isActive}`);
      });
    } else {
      console.log("No team members found!");
      // Check if any exist at all
      const allMembers = await TeamMember.find({}).lean();
      console.log("Total team members in database:", allMembers.length);
      if (allMembers.length > 0) {
        console.log("Sample organization IDs in database:");
        allMembers.slice(0, 3).forEach(m => {
          console.log(`  - ${m.organization}`);
        });
      }
    }
    console.log("========================");

    res.json(teamMembers);
  } catch (error) {
    console.error("Get team members error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get single team member by ID
export const getTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    const teamMember = await TeamMember.findById(memberId)
      .populate("user", "name email lastLogin phone")
      .populate("organization", "name email")
      .lean();

    if (!teamMember) {
      return res.status(404).json({ message: "Team member not found" });
    }

    res.json(teamMember);
  } catch (error) {
    console.error("Get team member error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update team member permissions and roles
export const updateMemberPermissions = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { permissions, permissionPreset } = req.body;

    const teamMember = await TeamMember.findById(memberId);

    if (!teamMember) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // Prevent modifying team leader
    if (teamMember.role === "team_leader") {
      return res.status(403).json({ 
        message: "Cannot modify team leader permissions" 
      });
    }

    const oldPermissions = { ...teamMember.permissions };

    // Update permissions
    if (permissionPreset && PERMISSION_PRESETS[permissionPreset]) {
      teamMember.permissions = PERMISSION_PRESETS[permissionPreset];
    } else if (permissions) {
      teamMember.permissions = { ...teamMember.permissions, ...permissions };
    }

    await teamMember.save();

    // Log activity
    await logActivity({
      organizationId: teamMember.organization,
      userId: req.user._id,
      action: "update_permissions",
      targetType: "team_member",
      targetId: teamMember._id,
      details: {
        oldPermissions,
        newPermissions: teamMember.permissions,
      },
      req,
    });

    await teamMember.populate("user", "name email");

    res.json({
      message: "Permissions updated successfully",
      teamMember,
    });
  } catch (error) {
    console.error("Update member permissions error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Remove team member from organization
export const removeTeamMember = async (req, res) => {
  try {
    const { memberId } = req.params;

    const teamMember = await TeamMember.findById(memberId);

    if (!teamMember) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // Prevent removing team leader
    if (teamMember.role === "team_leader") {
      return res.status(403).json({ 
        message: "Cannot remove team leader" 
      });
    }

    // Deactivate team member
    teamMember.isActive = false;
    await teamMember.save();

    // Deactivate user account
    await User.findByIdAndUpdate(teamMember.user, { 
      isActive: false,
      organizationId: null,
      memberRole: null,
    });

    // Log activity
    await logActivity({
      organizationId: teamMember.organization,
      userId: req.user._id,
      action: "remove_member",
      targetType: "team_member",
      targetId: teamMember._id,
      details: {
        removedMember: teamMember.user,
      },
      req,
    });

    res.json({ message: "Team member removed successfully" });
  } catch (error) {
    console.error("Remove team member error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get activity log for a team member
export const getTeamMemberActivity = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 50, page = 1, action, startDate, endDate } = req.query;

    const teamMember = await TeamMember.findById(memberId);

    if (!teamMember) {
      return res.status(404).json({ message: "Team member not found" });
    }

    const ActivityLog = (await import("../models/ActivityLog.js")).default;

    // Build query
    const query = {
      organization: teamMember.organization,
      user: teamMember.user,
    };

    if (action) {
      query.action = action;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate("user", "name email")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get team member activity error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get available permission presets
export const getPermissionPresets = async (req, res) => {
  try {
    res.json(PERMISSION_PRESETS);
  } catch (error) {
    console.error("Get permission presets error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Send team invitation email
export const inviteTeamMember = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, email, permissionPreset, customPermissions } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        message: "Name and email are required" 
      });
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.organizationId) {
      return res.status(400).json({ 
        message: "User with this email is already part of an organization" 
      });
    }

    // Check if there's already a pending invitation
    const existingInvitation = await TeamInvitation.findOne({
      organization: organizationId,
      email,
      status: "pending",
    });

    if (existingInvitation && !existingInvitation.isExpired()) {
      return res.status(400).json({ 
        message: "An invitation has already been sent to this email" 
      });
    }

    // Determine permissions
    let permissions;
    if (customPermissions) {
      permissions = customPermissions;
    } else if (permissionPreset && PERMISSION_PRESETS[permissionPreset]) {
      permissions = PERMISSION_PRESETS[permissionPreset];
    } else {
      permissions = PERMISSION_PRESETS.LIMITED_ACCESS;
    }

    // Create invitation
    const invitation = new TeamInvitation({
      organization: organizationId,
      invitedBy: req.user._id,
      name,
      email,
      permissions,
    });

    const invitationToken = invitation.generateInvitationToken();
    await invitation.save();

    // Send invitation email with link
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation/${invitationToken}`;
    
    try {
      await sendTeamInvitationEmail(
        { name, email }, 
        organization, 
        req.user.name,
        invitationLink
      );
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Don't fail the request if email fails
    }

    // Log activity
    await logActivity({
      organizationId,
      userId: req.user._id,
      action: "add_member",
      targetType: "team_member",
      details: {
        memberName: name,
        memberEmail: email,
        invitationSent: true,
      },
      req,
    });

    res.status(201).json({
      message: "Invitation sent successfully",
      invitation: {
        id: invitation._id,
        name: invitation.name,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Invite team member error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Validate invitation token
export const validateInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    // Hash the token to find the invitation
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    
    const invitation = await TeamInvitation.findOne({
      invitationToken: hashedToken,
      status: "pending",
    }).populate("organization", "name email");

    if (!invitation) {
      return res.status(404).json({ 
        message: "Invalid or expired invitation",
        valid: false 
      });
    }

    if (invitation.isExpired()) {
      return res.status(400).json({ 
        message: "Invitation has expired",
        valid: false 
      });
    }

    res.json({
      valid: true,
      invitation: {
        name: invitation.name,
        email: invitation.email,
        organizationName: invitation.organization.name,
        organizationEmail: invitation.organization.email,
        expiresAt: invitation.expiresAt,
      }
    });
  } catch (error) {
    console.error("Validate invitation error:", error);
    res.status(500).json({ message: error.message, valid: false });
  }
};

// Accept invitation and create account
export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Hash the token to find the invitation
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    
    const invitation = await TeamInvitation.findOne({
      invitationToken: hashedToken,
      status: "pending",
    }).populate("organization");

    if (!invitation) {
      return res.status(404).json({ message: "Invalid or expired invitation" });
    }

    if (invitation.isExpired()) {
      invitation.status = "expired";
      await invitation.save();
      return res.status(400).json({ message: "Invitation has expired" });
    }

    // Check if user already exists
    let user = await User.findOne({ email: invitation.email });
    
    if (user) {
      // Update existing user
      user.organizationId = invitation.organization._id;
      user.memberRole = "member";
      user.role = "issuer";
      user.company = invitation.organization.name;
      user.password = password;
      user.emailVerified = true;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        name: invitation.name,
        email: invitation.email,
        password,
        role: "issuer",
        company: invitation.organization.name,
        organizationId: invitation.organization._id,
        memberRole: "member",
        emailVerified: true,
      });
    }

    // Create team member record
    const teamMember = await TeamMember.create({
      organization: invitation.organization._id,
      user: user._id,
      role: "member",
      permissions: invitation.permissions,
      isActive: true,
    });

    // Mark invitation as accepted
    invitation.status = "accepted";
    await invitation.save();

    // Log activity
    await logActivity({
      organizationId: invitation.organization._id,
      userId: user._id,
      action: "add_member",
      targetType: "team_member",
      targetId: teamMember._id,
      details: {
        memberName: user.name,
        memberEmail: user.email,
        invitationAccepted: true,
      },
    });

    res.json({
      message: "Invitation accepted successfully. You can now login.",
      organizationEmail: invitation.organization.email,
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all pending invitations for an organization
export const getPendingInvitations = async (req, res) => {
  try {
    const organizationId = req.params.organizationId || req.user.organizationId;

    const invitations = await TeamInvitation.find({
      organization: organizationId,
      status: "pending",
    })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json(invitations);
  } catch (error) {
    console.error("Get pending invitations error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Resend invitation email
export const resendInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await TeamInvitation.findById(invitationId).populate("organization");

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation is no longer pending" });
    }

    // Generate new token and extend expiry
    const invitationToken = invitation.generateInvitationToken();
    invitation.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    await invitation.save();

    // Send invitation email
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation/${invitationToken}`;
    
    try {
      await sendTeamInvitationEmail(
        { name: invitation.name, email: invitation.email }, 
        invitation.organization, 
        req.user.name,
        invitationLink
      );
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
    }

    res.json({ message: "Invitation resent successfully" });
  } catch (error) {
    console.error("Resend invitation error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel pending invitation
export const cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await TeamInvitation.findById(invitationId);

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    invitation.status = "expired";
    await invitation.save();

    res.json({ message: "Invitation cancelled successfully" });
  } catch (error) {
    console.error("Cancel invitation error:", error);
    res.status(500).json({ message: error.message });
  }
};

export default {
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
};
