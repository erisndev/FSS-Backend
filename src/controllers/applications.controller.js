import { uploadToSupabase } from "../middleware/upload.js";
import Application from "../models/Application.js";
import Notification from "../models/Notification.js";
import Tender from "../models/Tender.js";
import User from "../models/User.js";
import TeamMember from "../models/TeamMember.js";
import VerificationCodeRequest from "../models/VerificationCodeRequest.js";
import {
  sendApplicationSubmittedEmail,
  sendApplicationStatusEmail,
} from "../utils/emails.js";
import { autoCloseTenders } from "../utils/tenderUtils.js";
import { logActivity } from "../utils/activityLogger.js";

// Apply to a tender
export const applyToTender = async (req, res) => {
  try {
    console.log("Files received:", req.files);
    console.log("Request body:", req.body);
    await autoCloseTenders(); // ✅ Auto-close expired tenders

    const { tenderId } = req.params;

    // Fetch tender and populate createdBy
    const tender = await Tender.findById(tenderId).populate(
      "createdBy",
      "name email"
    );
    console.log("Authenticated user:", req.user);

    if (!tender) return res.status(404).json({ message: "Tender not found" });
    if (tender.status !== "active")
      return res
        .status(400)
        .json({ message: "Cannot apply. Tender is closed." });
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (new Date(tender.deadline) < new Date())
      return res.status(400).json({ message: "Deadline has passed" });

    // Check if tender requires verification code
    if (tender.verificationCode) {
      // Check if user has a verified code request for this tender
      const verifiedRequest = await VerificationCodeRequest.findOne({
        tender: tenderId,
        requestedBy: req.user._id,
        status: "approved",
        codeUsed: true,
      });

      if (!verifiedRequest) {
        return res.status(403).json({ 
          message: "Verification code required. Please request and verify the code before applying.",
          requiresVerification: true 
        });
      }
    }

    // Extract fields from form
    const {
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      email,
      phone,
      bidAmount,
      timeframe,
      message,
    } = req.body;

    // Validate required fields
    if (!contactPerson || !email || !phone || !bidAmount)
      return res.status(400).json({ message: "Missing required fields" });

    const bidAmountNumber = Number(bidAmount);
    if (isNaN(bidAmountNumber))
      return res.status(400).json({ message: "Bid amount must be a number" });

    // Upload application files to Supabase under tender/company folder
    let files = [];
    if (req.files && req.files.length > 0) {
      files = await Promise.all(
        req.files.map(async (file) => {
          const url = await uploadToSupabase(
            file,
            `${tender.title}/Applications/${companyName}` // folder: uploads/<tenderName>/<companyName>/
          );
          return {
            originalName: file.originalname,
            url,
            size: file.size,
            mimeType: file.mimetype,
          };
        })
      );
    }

    // Create the application
    const application = await Application.create({
      tender: tenderId,
      bidder: req.user._id,
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading: cidbGrading || "",
      contactPerson,
      email,
      phone,
      bidAmount: bidAmountNumber,
      timeframe,
      message,
      files,
    });

    // Push application ID to tender
    await Tender.findByIdAndUpdate(application.tender, {
      $push: { applications: application._id },
    });

    await application.populate([
      { path: "tender", populate: { path: "createdBy", select: "name email" } },
      { path: "bidder", select: "name email" },
    ]);

    await sendApplicationSubmittedEmail(application);

    // Notification to applicant
    await Notification.create({
      user: req.user._id,
      type: "application",
      title: "Application Submitted",
      body: `You submitted an application for tender "${application.tender.title}".`,
      meta: { tenderId, applicationId: application._id },
    });

    // Notification to tender owner (only if exists)
    if (application.tender.createdBy?._id) {
      await Notification.create({
        user: application.tender.createdBy._id,
        type: "application",
        title: "New Application Received",
        body: `Your tender "${application.tender.title}" received a new application.`,
        meta: { tenderId, applicationId: application._id },
      });
    }

    res.status(201).json(application);
  } catch (err) {
    console.error("Error applying to tender:", err);
    res.status(500).json({ message: err.message, errors: err.errors || null });
  }
};

// Get my applications
export const myApplications = async (req, res) => {
  try {
    const applications = await Application.find({
      bidder: req.user._id,
    }).populate("tender", "title description deadline");
    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get received applications for a tender
export const receivedApplications = async (req, res) => {
  try {
    const { tenderId } = req.params;
    if (!tenderId)
      return res.status(400).json({ message: "Tender ID is required" });

    const tender = await Tender.findById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    const isAdmin = req.user.role === "admin";
    const isCreator = String(tender.createdBy) === String(req.user._id);
    const sameOrganization = req.user.organizationId && tender.organization && 
                             String(tender.organization) === String(req.user.organizationId);

    // Admin can always view
    if (isAdmin) {
      // Continue to fetch logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to view applications" 
        });
      }

      // Get team member permissions
      const teamMember = await TeamMember.findOne({
        organization: req.user.organizationId,
        user: req.user._id,
        isActive: true,
      });

      if (!teamMember) {
        return res.status(403).json({ 
          message: "Forbidden: You are not an active team member" 
        });
      }

      // Check if they have view permission (even if they created it)
      if (!teamMember.permissions.canViewApplications) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to view applications" 
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can view applications
      if (!isCreator) {
        return res.status(403).json({ 
          message: "Forbidden: You can only view applications for your own tenders" 
        });
      }
    }

    const applications = await Application.find({ tender: tenderId })
      .populate("bidder", "name email company role")
      .populate("tender", "title description deadline createdBy");

    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get application by ID
export const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("bidder", "name email company role")
      .populate("tender", "title description deadline createdBy organization");

    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const isAdmin = req.user.role === "admin";
    const isApplicant = String(application.bidder._id) === String(req.user._id);
    const isCreator = String(application.tender.createdBy) === String(req.user._id);
    const sameOrganization = req.user.organizationId && application.tender.organization && 
                             String(application.tender.organization) === String(req.user.organizationId);

    // Admin or applicant can always view
    if (isAdmin || isApplicant) {
      // Continue to return logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to view this application" 
        });
      }

      // Get team member permissions
      const teamMember = await TeamMember.findOne({
        organization: req.user.organizationId,
        user: req.user._id,
        isActive: true,
      });

      if (!teamMember) {
        return res.status(403).json({ 
          message: "Forbidden: You are not an active team member" 
        });
      }

      // Check if they have view permission
      if (!teamMember.permissions.canViewApplications) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to view applications" 
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can view
      if (!isCreator) {
        return res.status(403).json({ 
          message: "Forbidden: You can only view applications for your own tenders" 
        });
      }
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Set application status (accept/reject)
export const setApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    const application = await Application.findById(id).populate("tender");
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const isAdmin = req.user.role === "admin";
    const isCreator = String(application.tender.createdBy) === String(req.user._id);
    const sameOrganization = req.user.organizationId && application.tender.organization && 
                             String(application.tender.organization) === String(req.user.organizationId);

    // Admin can always manage
    if (isAdmin) {
      // Continue to update logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to manage applications" 
        });
      }

      // Get team member permissions
      const teamMember = await TeamMember.findOne({
        organization: req.user.organizationId,
        user: req.user._id,
        isActive: true,
      });

      if (!teamMember) {
        return res.status(403).json({ 
          message: "Forbidden: You are not an active team member" 
        });
      }

      // Check if they have accept/reject permission (even if they created it)
      if (!teamMember.permissions.canAcceptReject) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission to accept or reject applications" 
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can manage
      if (!isCreator) {
        return res.status(403).json({ 
          message: "Forbidden: You can only manage applications for your own tenders" 
        });
      }
    }

    // Update application status and comment
    if (status) application.status = status;
    if (comment) application.comment = comment;

    await application.save();

    // Fetch the user who created the application
    const applicant = await User.findById(application.bidder);
    if (applicant) {
      await sendApplicationStatusEmail(applicant, application);
    }

    // Notification to applicant
    await Notification.create({
      user: applicant._id,
      type: "application",
      title: "Application Status Updated",
      body: `Your application for tender "${application.tender.title}" is now "${application.status}".`,
      meta: { tenderId: application.tender._id, applicationId: id },
    });

    // Log activity if user belongs to an organization
    if (req.user.organizationId) {
      await logActivity({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        action: status === "accepted" ? "accept_application" : status === "rejected" ? "reject_application" : "update_application",
        targetType: "application",
        targetId: application._id,
        details: {
          applicationId: application._id,
          tenderId: application.tender._id,
          tenderTitle: application.tender.title,
          newStatus: status,
          comment: comment || null,
        },
        req,
      });
    }

    // If accepted, archive tender and reject other pending applications
    if (status === "accepted") {
      const tender = await Tender.findById(application.tender._id);
      if (tender) {
        tender.status = "archived";
        await tender.save();

        // Notify tender owner
        await Notification.create({
          user: tender.createdBy,
          type: "tender",
          title: "Tender Archived",
          body: `Tender "${tender.title}" has been archived because an application was accepted.`,
          meta: { tenderId: tender._id },
        });

        // Reject other pending applications
        const otherApplications = await Application.find({
          tender: tender._id,
          status: "pending",
          _id: { $ne: application._id }, // exclude the accepted one
        });

        for (const otherApp of otherApplications) {
          otherApp.status = "rejected";
          await otherApp.save();

          const otherApplicant = await User.findById(otherApp.bidder);
          if (otherApplicant) {
            await sendApplicationStatusEmail(otherApplicant, otherApp);
          }

          await Notification.create({
            user: otherApp.bidder,
            type: "application",
            title: "Application Rejected",
            body: `Your application for tender "${tender.title}" was rejected because another application was accepted.`,
            meta: { tenderId: tender._id, applicationId: otherApp._id },
          });
        }
      }
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Withdraw application
export const withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await Application.findById(id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (
      String(application.bidder) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Remove application ID from tender's applications array
    await Tender.findByIdAndUpdate(application.tender, {
      $pull: { applications: application._id },
    });

    await application.deleteOne();

    await Notification.create({
      user: req.user._id,
      type: "application",
      title: "Application Withdrawn",
      body: `You withdrew your application for tender "${application.tender}".`,
      meta: { applicationId: application._id },
    });

    res.json({ message: "Application withdrawn successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get all applications (admin only)
export const getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("bidder", "name email company role")
      .populate("tender", "title description deadline createdBy");

    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
