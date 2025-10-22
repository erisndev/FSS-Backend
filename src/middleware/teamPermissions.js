import TeamMember from "../models/TeamMember.js";

// Check if user has specific team permission
export const checkTeamPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Skip check if user is admin
      if (req.user.role === "admin") {
        return next();
      }

      // Check if user is an issuer with organization
      if (req.user.role !== "issuer" || !req.user.organizationId) {
        return res.status(403).json({
          message: "Access denied. Not part of an organization.",
        });
      }

      // Find team member record
      const teamMember = await TeamMember.findOne({
        user: req.user._id,
        organization: req.user.organizationId,
        isActive: true,
      });

      if (!teamMember) {
        return res.status(403).json({
          message: "Access denied. Team membership not found.",
        });
      }

      // Check if user has the required permission
      if (!teamMember.permissions[requiredPermission]) {
        return res.status(403).json({
          message: `Access denied. Missing permission: ${requiredPermission}`,
        });
      }

      // Attach team member to request for later use
      req.teamMember = teamMember;

      // Update last active timestamp
      teamMember.lastActive = new Date();
      await teamMember.save();

      next();
    } catch (error) {
      console.error("Team permission check error:", error);
      res.status(500).json({ message: "Error checking permissions" });
    }
  };
};

// Check if user is team leader
export const isTeamLeader = async (req, res, next) => {
  try {
    // Skip check if user is admin
    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.memberRole !== "team_leader") {
      return res.status(403).json({
        message: "Access denied. Only team leaders can perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Team leader check error:", error);
    res.status(500).json({ message: "Error checking team leader status" });
  }
};

// Verify user belongs to the organization
export const verifyOrganizationAccess = async (req, res, next) => {
  try {
    const organizationId = req.params.organizationId || req.params.id;

    // Skip check if user is admin
    if (req.user.role === "admin") {
      return next();
    }

    if (
      !req.user.organizationId ||
      req.user.organizationId.toString() !== organizationId
    ) {
      return res.status(403).json({
        message: "Access denied. You don't belong to this organization.",
      });
    }

    next();
  } catch (error) {
    console.error("Organization access check error:", error);
    res.status(500).json({ message: "Error verifying organization access" });
  }
};

export default { checkTeamPermission, isTeamLeader, verifyOrganizationAccess };
