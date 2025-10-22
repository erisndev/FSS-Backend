import User from "../models/User.js";
import Organization from "../models/Organization.js";
import TeamMember from "../models/TeamMember.js";
import jwt from "jsonwebtoken";
import { logActivity } from "../utils/activityLogger.js";
import { generateAccessToken } from "../utils/tokenHelper.js";

// Generate JWT token
const generateToken = (userId) => {
  return generateAccessToken({ id: userId });
};

// Get team members for organization login
export const getTeamMembersForLogin = async (req, res) => {
  try {
    const { email } = req.body;

    // Find organization with this email
    const organization = await Organization.findOne({ email, isActive: true });

    if (!organization) {
      return res
        .status(404)
        .json({ message: "No organization found with this email" });
    }

    // Get all active team members
    const teamMembers = await TeamMember.find({
      organization: organization._id,
      isActive: true,
    })
      .populate("user", "name _id")
      .lean();

    if (!teamMembers || teamMembers.length === 0) {
      return res.status(404).json({ message: "No active team members found" });
    }

    // Return list of members (only names and IDs)
    const members = teamMembers.map((tm) => ({
      id: tm.user._id,
      name: tm.user.name,
      role: tm.role,
    }));

    res.json({
      organizationName: organization.name,
      members,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Team login with member selection
export const teamLogin = async (req, res) => {
  try {
    const { email, password, memberId } = req.body;

    // Find organization
    const organization = await Organization.findOne({ email, isActive: true });

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Find the specific user/member
    const user = await User.findById(memberId).select("+password");

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify user belongs to this organization
    if (
      !user.organizationId ||
      user.organizationId.toString() !== organization._id.toString()
    ) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Update team member last active
    await TeamMember.findOneAndUpdate(
      { organization: organization._id, user: user._id },
      { lastActive: new Date() }
    );

    // Log activity
    await logActivity({
      organizationId: organization._id,
      userId: user._id,
      action: "login",
      targetType: "auth",
      details: { loginMethod: "team_login" },
      req,
    });

    // Get team member info
    const teamMember = await TeamMember.findOne({
      organization: organization._id,
      user: user._id,
    });

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        organizationId: user.organizationId,
        memberRole: user.memberRole,
        permissions: teamMember?.permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export default {
  getTeamMembersForLogin,
  teamLogin,
};
