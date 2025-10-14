import VerificationCodeRequest from "../models/VerificationCodeRequest.js";
import Tender from "../models/Tender.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import {
  sendVerificationCodeEmail,
  sendVerificationCodeRequestEmail,
} from "../utils/emails.js";
import crypto from "crypto";

// ------------------- REQUEST VERIFICATION CODE -------------------
export const requestVerificationCode = async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { message } = req.body;

    // Check if tender exists and is active
    const tender = await Tender.findById(tenderId).populate(
      "createdBy",
      "name email"
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

    // Check if user already has a pending request for this tender
    const existingRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        message:
          "You already have a pending verification code request for this tender",
      });
    }

    // Check if user already has an approved request that hasn't been used
    // Allow re-requesting if code was used but application wasn't submitted
    const approvedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
      codeUsed: false,
    });

    if (approvedRequest) {
      return res.status(400).json({
        message:
          "You already have an approved verification code. Please check your email.",
        hasApprovedCode: true,
      });
    }

    // Create new verification code request
    const codeRequest = await VerificationCodeRequest.create({
      tender: tenderId,
      requestedBy: req.user._id,
      message:
        message ||
        `Request for verification code to apply for tender: ${tender.title}`,
    });

    // Send email notification to tender creator
    try {
      await sendVerificationCodeRequestEmail(
        tender.createdBy,
        tender,
        req.user,
        message
      );
    } catch (emailError) {
      console.error("Error sending email to tender creator:", emailError);
      // Continue even if email fails
    }

    // Create notification for tender creator
    await Notification.create({
      user: tender.createdBy._id,
      type: "tender",
      title: "Verification Code Request",
      body: `${req.user.name} has requested a verification code for tender "${tender.title}"`,
      meta: {
        tenderId,
        requestId: codeRequest._id,
        requestType: "verificationCode",
      },
    });

    // Also notify admins
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "tender",
        title: "Verification Code Request",
        body: `${req.user.name} has requested a verification code for tender "${tender.title}"`,
        meta: {
          tenderId,
          requestId: codeRequest._id,
          requestType: "verificationCode",
        },
      });
    }

    res.status(201).json({
      message: "Verification code request submitted successfully",
      request: codeRequest,
    });
  } catch (err) {
    console.error("Error requesting verification code:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- GET VERIFICATION CODE REQUESTS (FOR ADMIN/ISSUER) -------------------
export const getVerificationCodeRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    // If user is issuer, only show requests for their tenders
    if (req.user.role === "issuer") {
      const userTenders = await Tender.find({ createdBy: req.user._id }).select(
        "_id"
      );
      const tenderIds = userTenders.map((t) => t._id);
      query.tender = { $in: tenderIds };
    }
    // Admins can see all requests

    if (status) {
      query.status = status;
    }

    const requests = await VerificationCodeRequest.find(query)
      .populate({
        path: "tender",
        select: "title description companyName category budgetMin budgetMax deadline status"
      })
      .populate({
        path: "requestedBy",
        select: "name email company phone role description"
      })
      .populate({
        path: "approvedBy",
        select: "name email company"
      })
      .sort({ createdAt: -1 });

    console.log("Sample request with populated data:", JSON.stringify(requests[0], null, 2));
    res.json(requests);
  } catch (err) {
    console.error("Error fetching verification code requests:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- APPROVE VERIFICATION CODE REQUEST -------------------
export const approveVerificationCodeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await VerificationCodeRequest.findById(requestId)
      .populate("tender")
      .populate({
        path: "requestedBy",
        select: "name email company phone role"
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
    if (
      req.user.role !== "admin" &&
      String(tender.createdBy) !== String(req.user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this request" });
    }

    // Generate verification code if it doesn't exist
    if (!tender.verificationCode) {
      tender.verificationCode = crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();
      await tender.save();
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

    res.json({
      message: "Verification code request approved and sent to bidder",
      request,
    });
  } catch (err) {
    console.error("Error approving verification code request:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- REJECT VERIFICATION CODE REQUEST -------------------
export const rejectVerificationCodeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await VerificationCodeRequest.findById(requestId)
      .populate("tender", "title createdBy")
      .populate({
        path: "requestedBy",
        select: "name email company phone role"
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
    if (
      req.user.role !== "admin" &&
      String(request.tender.createdBy) !== String(req.user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to reject this request" });
    }

    // Update request status
    request.status = "rejected";
    request.rejectionReason = reason || "Request rejected by administrator";
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

    // Check if the code matches
    if (tender.verificationCode !== verificationCode.toUpperCase()) {
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

    // Check if user has an approved request for this tender (remove codeUsed: false condition)
    const approvedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
    });

    if (!approvedRequest) {
      return res.status(400).json({
        message:
          "You don't have an approved verification code request for this tender",
      });
    }

    // Mark the code as used only if not already used
    if (!approvedRequest.codeUsed) {
      approvedRequest.codeUsed = true;
      await approvedRequest.save();
    }

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

    // Check if user has a verified (code used) request for this tender
    const verifiedRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "approved",
      codeUsed: true,
    });

    if (verifiedRequest) {
      // User has already verified the code, can proceed directly to application
      return res.json({
        isVerified: true,
        hasApplied: false,
        message:
          "Code already verified. You can proceed with your application.",
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
        message: "You have an approved code. Please enter it to proceed.",
      });
    }

    // Check if user has a pending request
    const pendingRequest = await VerificationCodeRequest.findOne({
      tender: tenderId,
      requestedBy: req.user._id,
      status: "pending",
    });

    if (pendingRequest) {
      return res.json({
        isVerified: false,
        hasApplied: false,
        hasPendingRequest: true,
        message: "Your verification code request is pending approval.",
      });
    }

    // No request exists
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
