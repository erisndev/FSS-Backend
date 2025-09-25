import Application from "../models/Application.js";
import Notification from "../models/Notification.js";
import Tender from "../models/Tender.js";
import User from "../models/User.js";
import {
  sendApplicationSubmittedEmail,
  sendApplicationStatusEmail,
} from "../utils/emails.js";
import { autoCloseTenders } from "../utils/tenderUtils.js";

// ------------------- APPLY TO TENDER -------------------
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

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

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

    // Map uploaded files
    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      url: `/uploads/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
    }));

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

// ------------------- GET MY APPLICATIONS -------------------
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

// ------------------- GET RECEIVED APPLICATIONS -------------------
export const receivedApplications = async (req, res) => {
  try {
    const { tenderId } = req.params;
    if (!tenderId)
      return res.status(400).json({ message: "Tender ID is required" });

    const tender = await Tender.findById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (
      String(tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
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

// ------------------- GET APPLICATION BY ID -------------------
export const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("bidder", "name email company role")
      .populate("tender", "title description deadline createdBy");

    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (
      String(application.bidder._id) !== String(req.user._id) &&
      String(application.tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    )
      return res.status(403).json({ message: "Forbidden" });

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- SET APPLICATION STATUS -------------------
export const setApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    const application = await Application.findById(id).populate("tender");
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (
      String(application.tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    )
      return res.status(403).json({ message: "Forbidden" });

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

    // ✅ If accepted, archive tender and reject other pending applications
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

// ------------------- WITHDRAW APPLICATION -------------------
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

// ------------------- GET ALL APPLICATIONS -------------------
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
