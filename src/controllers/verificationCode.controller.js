import VerificationCodeRequest from "../models/VerificationCodeRequest.js";
import Tender from "../models/Tender.js";
import User from "../models/User.js";
import TeamMember from "../models/TeamMember.js";
import Notification from "../models/Notification.js";
import {
  sendVerificationCodeEmail,
  sendVerificationCodeRequestEmail,
} from "../utils/emails.js";
import { logActivity } from "../utils/activityLogger.js";
import crypto from "crypto";

// ------------------- REQUEST VERIFICATION CODE -------------------
export const requestVerificationCode = async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { message } = req.body;

    // Check if tender exists and is active
    const tender = await Tender.findById(tenderId).populate(
      "createdBy",
      "name email companyName"
    );
    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }
    if (tender.status !== "active") {
      return res.status(400).json({ message: "Tender is not active" });
    }

    // Import Application model to check if user has already applied
    const Application = (await import("../models/Application.js")).default;

    // Check if user has already applied to this tender
    const existingApplication = await Application.findOne({
      tender: tenderId,
      bidder: req.user._id,
    });

    if (existingApplication) {
      return res.status(400).json({
        message: "You have already applied to this tender",
        hasApplied: true,
      });
    }

    // If user already has an approved request that hasn't been used, don't generate a new code
    const approvedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
      codeUsed: false,
    });

    if (approvedRequest) {
      return res.status(400).json({
        message:
          "You already have a verification code. Please check your email and apply.",
        hasApprovedCode: true,
      });
    }

    // Generate a unique per-request verification code (not tied to the tender)
    const verificationCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

    // Create new verification code request as auto-approved
    const codeRequest = await VerificationCodeRequest.create({
      tender: tenderId,
      requestedBy: req.user._id,
      message:
        message ||
        `Request for verification code to apply for tender: ${tender.title}`,
      status: "approved",
      approvalDate: new Date(),
      code: verificationCode,
    });

    // Send email with verification code directly to bidder (no approval flow)
    try {
      await sendVerificationCodeEmail(req.user, tender.title, verificationCode);
    } catch (emailError) {
      console.error("Error sending verification code email:", emailError);
    }

    // Notify bidder in-app
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Verification Code Generated",
      body: `A verification code for tender "${tender.title}" has been sent to your email.`,
      meta: {
        tenderId,
        requestId: codeRequest._id,
      },
    });

    res.status(201).json({
      message: "Verification code generated and sent successfully",
      request: codeRequest,
    });
  } catch (err) {
    console.error("Error requesting verification code:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get verification code requests (for admin/issuer/team members)
export const getVerificationCodeRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    // Admin can see all requests
    if (req.user.role === "admin") {
      // No filter - see all requests
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Get all tenders from the organization
      const orgTenders = await Tender.find({
        organization: req.user.organizationId,
      }).select("_id");

      const tenderIds = orgTenders.map((t) => t._id);
      query.tender = { $in: tenderIds };
    }
    // Individual issuer (not part of organization)
    else if (req.user.role === "issuer") {
      // Only show requests for their own tenders
      const userTenders = await Tender.find({
        createdBy: req.user._id,
      }).select("_id");

      const tenderIds = userTenders.map((t) => t._id);
      query.tender = { $in: tenderIds };
    }

    if (status) {
      query.status = status;
    }

    const requests = await VerificationCodeRequest.find(query)
      .populate({
        path: "tender",
        select:
          "title description companyName category budgetMin budgetMax deadline status organization createdBy",
      })
      .populate({
        path: "requestedBy",
        select: "name email company phone role description",
      })
      .populate({
        path: "approvedBy",
        select: "name email company",
      })
      .sort({ createdAt: -1 });

    console.log(
      "Sample request with populated data:",
      JSON.stringify(requests[0], null, 2)
    );
    res.json(requests);
  } catch (err) {
    console.error("Error fetching verification code requests:", err);
    res.status(500).json({ message: err.message });
  }
};

// Approve verification code request
export const approveVerificationCodeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await VerificationCodeRequest.findById(requestId)
      .populate("tender")
      .populate({
        path: "requestedBy",
        select: "name email company phone role",
      });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Request has already been processed" });
    }

    // Check authorization
    const tender = await Tender.findById(request.tender._id);
    const isAdmin = req.user.role === "admin";
    const isCreator = String(tender.createdBy) === String(req.user._id);
    const sameOrganization =
      req.user.organizationId &&
      tender.organization &&
      String(tender.organization) === String(req.user.organizationId);

    // Admin can always approve
    if (isAdmin) {
      // Continue to approval logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({
          message:
            "Forbidden: You don't have permission to manage verification requests",
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
          message: "Forbidden: You are not an active team member",
        });
      }

      // Check if they have permission to manage verification requests
      if (!teamMember.permissions.canManageVerificationRequests) {
        return res.status(403).json({
          message:
            "Forbidden: You don't have permission to manage verification requests",
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can approve
      if (!isCreator) {
        return res.status(403).json({
          message:
            "Forbidden: You can only manage verification requests for your own tenders",
        });
      }
    }

    // Update request status
    request.status = "approved";
    request.approvedBy = req.user._id;
    request.approvalDate = new Date();
    await request.save();

    // Send email with verification code
    await sendVerificationCodeEmail(
      request.requestedBy,
      tender.title,
      tender.verificationCode
    );

    // Create notification for the requester
    await Notification.create({
      user: request.requestedBy._id,
      type: "tender",
      title: "Verification Code Approved",
      body: `Your verification code request for tender "${tender.title}" has been approved. Check your email for the code.`,
      meta: {
        tenderId: tender._id,
        requestId: request._id,
      },
    });

    // Log activity if tender belongs to an organization
    console.log("[APPROVE] Checking activity log conditions:");
    console.log("  - tender.organization:", tender.organization);
    console.log("  - req.user.organizationId:", req.user.organizationId);

    if (tender.organization) {
      console.log(
        "[APPROVE] Logging activity for organization:",
        tender.organization
      );
      try {
        await logActivity({
          organizationId: tender.organization,
          userId: req.user._id,
          action: "approve_verification_request",
          targetType: "verification_request",
          targetId: request._id,
          details: {
            tenderId: tender._id,
            tenderTitle: tender.title,
            requestedBy: request.requestedBy.email,
            approvedBy: req.user.email,
          },
          req,
        });
        console.log("[APPROVE] Activity logged successfully");
      } catch (logError) {
        console.error("[APPROVE] Error logging activity:", logError);
      }
    } else {
      console.log("[APPROVE] No organization - activity not logged");
    }

    res.json({
      message: "Verification code request approved and sent to bidder",
      request,
    });
  } catch (err) {
    console.error("Error approving verification code request:", err);
    res.status(500).json({ message: err.message });
  }
};

// Reject verification code request
export const rejectVerificationCodeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await VerificationCodeRequest.findById(requestId)
      .populate("tender", "title createdBy organization")
      .populate({
        path: "requestedBy",
        select: "name email company phone role",
      });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Request has already been processed" });
    }

    // Check authorization
    const isAdmin = req.user.role === "admin";
    const isCreator = String(request.tender.createdBy) === String(req.user._id);
    const sameOrganization =
      req.user.organizationId &&
      request.tender.organization &&
      String(request.tender.organization) === String(req.user.organizationId);

    // Admin can always reject
    if (isAdmin) {
      // Continue to rejection logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({
          message:
            "Forbidden: You don't have permission to manage verification requests",
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
          message: "Forbidden: You are not an active team member",
        });
      }

      // Check if they have permission to manage verification requests
      if (!teamMember.permissions.canManageVerificationRequests) {
        return res.status(403).json({
          message:
            "Forbidden: You don't have permission to manage verification requests",
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can reject
      if (!isCreator) {
        return res.status(403).json({
          message:
            "Forbidden: You can only manage verification requests for your own tenders",
        });
      }
    }

    // Update request status
    request.status = "rejected";
    request.rejectionReason = reason || "Request rejected by the tender issuer";
    await request.save();

    // Create notification for the requester
    await Notification.create({
      user: request.requestedBy._id,
      type: "tender",
      title: "Verification Code Request Rejected",
      body: `Your verification code request for tender "${
        request.tender.title
      }" has been rejected. ${reason ? `Reason: ${reason}` : ""}`,
      meta: {
        tenderId: request.tender._id,
        requestId: request._id,
      },
    });

    // Log activity if tender belongs to an organization
    console.log("[REJECT] Checking activity log conditions:");
    console.log(
      "  - request.tender.organization:",
      request.tender.organization
    );
    console.log("  - req.user.organizationId:", req.user.organizationId);

    if (request.tender.organization) {
      console.log(
        "[REJECT] Logging activity for organization:",
        request.tender.organization
      );
      try {
        await logActivity({
          organizationId: request.tender.organization,
          userId: req.user._id,
          action: "reject_verification_request",
          targetType: "verification_request",
          targetId: request._id,
          details: {
            tenderId: request.tender._id,
            tenderTitle: request.tender.title,
            requestedBy: request.requestedBy.email,
            rejectedBy: req.user.email,
            reason: reason || "No reason provided",
          },
          req,
        });
        console.log("[REJECT] Activity logged successfully");
      } catch (logError) {
        console.error("[REJECT] Error logging activity:", logError);
      }
    } else {
      console.log("[REJECT] No organization - activity not logged");
    }

    res.json({
      message: "Verification code request rejected",
      request,
    });
  } catch (err) {
    console.error("Error rejecting verification code request:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- VERIFY CODE BEFORE APPLICATION -------------------
export const verifyCode = async (req, res) => {
  try {
    console.log("Verifying code with body:", req.body);
    const { tenderId } = req.params;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const tender = await Tender.findById(tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    if (tender.status !== "active") {
      return res.status(400).json({ message: "Tender is not active" });
    }

    // Check if there is an approved request with this code for this user
    const approvedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
      code: verificationCode.toUpperCase(),
      codeUsed: false,
    });

    if (!approvedRequest) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Import Application model to check if user has already applied
    const Application = (await import("../models/Application.js")).default;

    // Check if user has already applied to this tender
    const existingApplication = await Application.findOne({
      tender: tenderId,
      bidder: req.user._id,
    });

    if (existingApplication) {
      return res.status(400).json({
        message: "You have already applied to this tender",
        hasApplied: true,
      });
    }

    // Mark code as used
    approvedRequest.codeUsed = true;
    await approvedRequest.save();

    res.json({
      message:
        "Verification code is valid. You can now proceed with your application.",
      verified: true,
      tenderId,
    });
  } catch (err) {
    console.error("Error verifying code:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- GET MY VERIFICATION CODE REQUESTS -------------------
export const getMyVerificationCodeRequests = async (req, res) => {
  try {
    const requests = await VerificationCodeRequest.find({
      requestedBy: req.user._id,
    })
      .populate(
        "tender",
        "title description deadline status companyName category budgetMin budgetMax"
      )
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });

    // Filter out requests where tender has been deleted (tender is null)
    // and add a flag for deleted tenders
    const processedRequests = requests.map((request) => {
      const requestObj = request.toObject();
      if (!requestObj.tender) {
        requestObj.tenderDeleted = true;
        requestObj.tender = {
          title: "Tender Deleted",
          description: "This tender has been removed",
          status: "deleted",
        };
      }
      return requestObj;
    });

    res.json(processedRequests);
  } catch (err) {
    console.error("Error fetching user verification code requests:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- CHECK VERIFICATION STATUS -------------------
export const checkVerificationStatus = async (req, res) => {
  try {
    const { tenderId } = req.params;

    // Import Application model to check if user has already applied
    const Application = (await import("../models/Application.js")).default;

    // Check if user has already applied to this tender
    const existingApplication = await Application.findOne({
      tender: tenderId,
      bidder: req.user._id,
    });

    if (existingApplication) {
      return res.json({
        isVerified: false,
        hasApplied: true,
        message: "You have already applied to this tender",
      });
    }

    // Check if user has an approved but unused code
    const approvedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
      codeUsed: false,
    });

    if (approvedRequest) {
      return res.json({
        isVerified: false,
        hasApplied: false,
        hasApprovedCode: true,
        message: "A verification code was generated and emailed to you. Please enter it to proceed.",
      });
    }

    // No unused code exists
    return res.json({
      isVerified: false,
      hasApplied: false,
      noRequest: true,
      message: "You need to request a verification code first.",
    });
  } catch (err) {
    console.error("Error checking verification status:", err);
    res.status(500).json({ message: err.message });
  }
};
