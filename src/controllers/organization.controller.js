import Organization from "../models/Organization.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import { logActivity } from "../utils/activityLogger.js";

// Get organization details
export const getOrganization = async (req, res) => {
  try {
    const organizationId = req.params.id || req.user.organizationId;

    const organization = await Organization.findById(organizationId)
      .populate("teamLeader", "name email")
      .lean();

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Get team members count
    const membersCount = await TeamMember.countDocuments({
      organization: organizationId,
      isActive: true,
    });

    res.json({
      ...organization,
      membersCount,
    });
  } catch (error) {
    console.error("Get organization error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update organization details
export const updateOrganization = async (req, res) => {
  try {
    const organizationId = req.params.id || req.user.organizationId;
    const { name, contactPhone, address, description } = req.body;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Track changes for activity log
    const changes = {};
    if (name && name !== organization.name) {
      changes.name = { old: organization.name, new: name };
      organization.name = name;
    }

    if (
      contactPhone !== undefined &&
      contactPhone !== organization.contactPhone
    ) {
      changes.contactPhone = {
        old: organization.contactPhone,
        new: contactPhone,
      };
      organization.contactPhone = contactPhone;
    }
    if (address !== undefined && address !== organization.address) {
      changes.address = { old: organization.address, new: address };
      organization.address = address;
    }
    if (description !== undefined && description !== organization.description) {
      changes.description = { old: organization.description, new: description };
      organization.description = description;
    }

    await organization.save();

    // Log activity
    await logActivity({
      organizationId: organization._id,
      userId: req.user._id,
      action: "update_organization",
      targetType: "organization",
      targetId: organization._id,
      details: { changes },
      req,
    });

    res.json({
      message: "Organization updated successfully",
      organization,
    });
  } catch (error) {
    console.error("Update organization error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Deactivate organization (soft delete)
export const deactivateOrganization = async (req, res) => {
  try {
    const organizationId = req.params.id;

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    organization.isActive = false;
    await organization.save();

    // Deactivate all team members
    await TeamMember.updateMany(
      { organization: organizationId },
      { isActive: false }
    );

    // Deactivate all users in the organization
    await User.updateMany(
      { organizationId: organizationId },
      { isActive: false }
    );

    // Log activity
    await logActivity({
      organizationId: organization._id,
      userId: req.user._id,
      action: "update_organization",
      targetType: "organization",
      targetId: organization._id,
      details: { action: "deactivated" },
      req,
    });

    res.json({ message: "Organization deactivated successfully" });
  } catch (error) {
    console.error("Deactivate organization error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get organization statistics
export const getOrganizationStats = async (req, res) => {
  try {
    const organizationId = req.params.id || req.user.organizationId;

    // Import models here to avoid circular dependencies
    const Tender = (await import("../models/Tender.js")).default;
    const Application = (await import("../models/Application.js")).default;

    const [
      totalMembers,
      activeMembers,
      totalTenders,
      activeTenders,
      totalApplications,
    ] = await Promise.all([
      TeamMember.countDocuments({ organization: organizationId }),
      TeamMember.countDocuments({
        organization: organizationId,
        isActive: true,
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      }),
      Tender.countDocuments({ organization: organizationId }),
      Tender.countDocuments({ organization: organizationId, status: "active" }),
      Application.countDocuments({
        tender: {
          $in: await Tender.find({ organization: organizationId }).distinct(
            "_id"
          ),
        },
      }),
    ]);

    res.json({
      totalMembers,
      activeMembers,
      totalTenders,
      activeTenders,
      totalApplications,
    });
  } catch (error) {
    console.error("Get organization stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  getOrganization,
  updateOrganization,
  deactivateOrganization,
  getOrganizationStats,
};
