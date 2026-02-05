import User from "../models/User.js";
import Organization from "../models/Organization.js";
import TeamMember from "../models/TeamMember.js";
import jwt from "jsonwebtoken";
import {
  sendRegisterOTPEmail,
  sendResetPasswordOTPEmail,
} from "../utils/emails.js";
import Notification from "../models/Notification.js";
import { logActivity } from "../utils/activityLogger.js";
import { generateAccessToken } from "../utils/tokenHelper.js";

// Generate JWT token
const generateToken = (userId) => {
  return generateAccessToken({ id: userId });
};

// Register new user
export const register = async (req, res) => {
  try {
    const { name, email, password, role, company, description, contactPhone } =
      req.body;
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({
      name,
      email,
      password,
      role,
      company,
      description: description || "",
    });

    // If registering as issuer, create organization and team leader
    if (role === "issuer") {
      const organization = await Organization.create({
        name: company || name,
        email: email,

        contactPhone: contactPhone || "",
        teamLeader: user._id,
        isActive: true,
      });

      // Update user with organization info
      user.organizationId = organization._id;
      user.memberRole = "team_leader";
      await user.save({ validateBeforeSave: false });

      // Create team member record with ALL permissions
      await TeamMember.create({
        organization: organization._id,
        user: user._id,
        role: "team_leader",
        permissions: {
          canCreateTenders: true,
          canEditTenders: true,
          canDeleteTenders: true,
          canViewApplications: true,
          canAcceptReject: true,
          canManageVerificationRequests: true,
          canManageTeam: true,
        },
        isActive: true,
      });
    }

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.save({ validateBeforeSave: false });

    await Notification.create({
      user: user._id,
      type: "system",
      title: "Welcome to the platform",
      body: `User ${user.name} registered successfully.`,
    });

    // Notify all admins
    const admins = await User.find({ role: "admin" });
    if (admins.length > 0) {
      const adminNotifications = admins.map((admin) => ({
        user: admin._id,
        type: "system",
        title: "New User Registered",
        body: `User ${user.name} has registered on the platform.`,
      }));
      await Notification.insertMany(adminNotifications);
    }

    // Send OTP email
    await sendRegisterOTPEmail(user, otp);

    res.status(201).json({ message: "User created, OTP sent to email" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Verify registration OTP
export const verifyRegisterOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.emailOTP ||
      String(user.emailOTP).trim() !== String(otp).trim() ||
      user.emailOTPExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired registration OTP" });
    }

    user.emailVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;

    const token = generateToken(user._id);
    await user.save();

    // Get team member info if user is an issuer
    let permissions = null;
    if (user.role === "issuer" && user.organizationId) {
      const teamMember = await TeamMember.findOne({
        user: user._id,
        organization: user.organizationId,
      });
      if (teamMember) {
        permissions = teamMember.permissions;
      }
    }

    res.json({
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
        organizationId: user.organizationId,
        memberRole: user.memberRole,
        permissions: permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Verify password reset OTP
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.resetPasswordOTP ||
      String(user.resetPasswordOTP).trim() !== String(otp).trim() ||
      user.resetPasswordOTPExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset OTP" });
    }

    await user.save();

    res.json({
      message: "Password reset OTP verified. You can now set a new password.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// User login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    if (!user.emailVerified)
      return res.status(403).json({ message: "Email not verified" });

    // Check if user is part of an organization (team member or team leader)
    if (user.organizationId && user.memberRole) {
      // Get organization
      const organization = await Organization.findById(user.organizationId);

      if (organization) {
        // If user is a regular member (not team leader), they MUST use team login
        if (user.memberRole === "member") {
          return res.status(200).json({
            redirectToTeamLogin: true,
            message:
              "Team members must use the Organization login flow. Please login with your organization's shared email.",
            organizationEmail: organization.email,
            organizationName: organization.name,
          });
        }
      }
    }

    user.lastLogin = new Date();
    await user.save();

    // Get team member info if user is an issuer
    let permissions = null;
    if (user.role === "issuer" && user.organizationId) {
      const teamMember = await TeamMember.findOne({
        user: user._id,
        organization: user.organizationId,
      });
      if (teamMember) {
        permissions = teamMember.permissions;
      }
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
        organizationId: user.organizationId,
        memberRole: user.memberRole,
        permissions: permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get current user profile
export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Get team member info if user is an issuer
    let permissions = null;
    if (user.role === "issuer" && user.organizationId) {
      const teamMember = await TeamMember.findOne({
        user: user._id,
        organization: user.organizationId,
      });
      if (teamMember) {
        permissions = teamMember.permissions;
      }
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      description: user.description,
      organizationId: user.organizationId,
      memberRole: user.memberRole,
      permissions: permissions,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update current user profile
export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, company, description } = req.body;
    if (name) user.name = name;
    if (company) user.company = company;
    if (description) user.description = description;

    await user.save();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Profile Updated",
      body: `Your profile was updated successfully.`,
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Change password (requires current password)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    await Notification.create({
      user: user._id,
      type: "system",
      title: "Password Changed",
      body: `Your password was changed successfully.`,
    });

    res.json({
      message: "Password changed successfully",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "-password -emailOTP -resetPasswordOTP",
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user by ID (Admin only)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -emailOTP -resetPasswordOTP",
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update user by ID (Admin only)
export const updateUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, company, description, role, isActive } = req.body;
    if (name) user.name = name;
    if (company) user.company = company;
    if (description) user.description = description;
    if (role) user.role = role;
    if (typeof isActive === "boolean") user.isActive = isActive;

    await user.save();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Admin Update",
      body: `Your account was updated by an admin.`,
    });
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete user (Admin only)
export const deleteUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Account Deleted",
      body: `Your account was deleted by an admin.`,
    });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Request password reset
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendResetPasswordOTPEmail(user, otp);

    res.json({ message: "Password reset OTP sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reset password with OTP
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.resetPasswordOTP ||
      user.resetPasswordOTP !== otp ||
      user.resetPasswordOTPExpires < Date.now()
    )
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = password;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Resend registration OTP
export const resendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.emailVerified)
      return res.status(400).json({ message: "Email already verified" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendRegisterOTPEmail(user, otp);

    res.json({ message: "New OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Resend password reset OTP
export const resendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendResetPasswordOTPEmail(user, otp);

    res.json({ message: "New OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
