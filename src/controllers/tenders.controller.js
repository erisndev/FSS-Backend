import Notification from "../models/Notification.js";
import Tender from "../models/Tender.js";
import Application from "../models/Application.js";
import TeamMember from "../models/TeamMember.js";
import { sendTenderNotificationEmail } from "../utils/emails.js";
import { autoCloseTenders } from "../utils/tenderUtils.js";
import { uploadToSupabase } from "../middleware/upload.js";
import { logActivity } from "../utils/activityLogger.js";
import { deleteFileFromSupabase } from "../config/supabase.js";
import crypto from "crypto";

// Create new tender
export const createTender = async (req, res) => {
  try {
    // Check permissions for team members
    if (req.user.organizationId) {
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

      if (!teamMember.permissions.canCreateTenders) {
        return res.status(403).json({
          message: "Forbidden: You don't have permission to create tenders",
        });
      }
    }

    const {
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      deadline,
      requirements,
      isUrgent,
      tags,

      companyName,
      companyAddress,

      technicalContactPerson,
      technicalContactEmail,
      technicalContactPhone,

      generalContactPerson,
      generalContactEmail,
      generalContactPhone,

      // Legacy fields (still accepted)
      contactEmail,
      contactPerson,
      contactPhone,

      status,
    } = req.body;

    // Required fields policy:
    // - active: enforce required fields
    // - draft: allow missing non-critical fields
    const effectiveStatus = status || "active";

    if (effectiveStatus !== "draft") {
      if (!title || !description || !category || !deadline || !companyName) {
        return res.status(400).json({ message: "Missing required fields" });
      }
    }

    // Parse tags
    let tagsArray = [];
    if (tags) {
      if (typeof tags === "string") {
        try {
          tagsArray = JSON.parse(tags);
        } catch {
          tagsArray = tags.split(",").map((t) => t.trim());
        }
      } else if (Array.isArray(tags)) tagsArray = tags;
    }

    // Parse requirements
    let requirementsArray = [];
    if (requirements) {
      if (typeof requirements === "string") {
        try {
          requirementsArray = JSON.parse(requirements);
        } catch {
          requirementsArray = requirements.split(",").map((r) => r.trim());
        }
      } else if (Array.isArray(requirements)) requirementsArray = requirements;
    }

    // Upload tender documents to Supabase using tender title as folder
    // Expected form-data file fields (new frontend):
    // - termsOfReference, sbd1, sbd2, sbd4DeclarationOfInterest, sbd61,
    //   bidTechnicalSubmissionTemplate, bidFinancialSubmissionTemplate,
    //   annexure1, annexure2, annexure3
    // Stored in DB as an array of { label, url, originalName, mimeType, size }

    const documentFields = [
      "termsOfReference",
      "sbd1",
      "sbd2",
      "sbd4DeclarationOfInterest",
      "sbd61",
      "bidTechnicalSubmissionTemplate",
      "bidFinancialSubmissionTemplate",
      "annexure1",
      "annexure2",
      "annexure3",
    ];

    const labelMapping = {
      termsOfReference: "Terms of Reference Document",
      sbd1: "SBD 1",
      sbd2: "SBD 2",
      sbd4DeclarationOfInterest: "SBD 4 Declaration of interest",
      sbd61: "SBD 6.1",
      bidTechnicalSubmissionTemplate: "Bid Technical Submission Template",
      bidFinancialSubmissionTemplate: "Bid Financial Submission Template",
      annexure1: "Annexure 1",
      annexure2: "Annexure 2",
      annexure3: "Annexure 3",
    };

    const normalizeDoc = (file, url, fieldName) => ({
      label: labelMapping[fieldName],
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    let documents = [];
    if (req.files && Object.keys(req.files).length > 0) {
      for (const fieldName of documentFields) {
        const filesArray = req.files[fieldName];
        if (!filesArray || filesArray.length === 0) continue;

        const file = filesArray[0];
        const uploadedUrl = await uploadToSupabase(file, title);
        documents.push(normalizeDoc(file, uploadedUrl, fieldName));
      }
    }

    const tender = await Tender.create({
      title,
      description,
      category,
      deadline: deadline ? new Date(deadline) : undefined,
      budgetMin:
        budgetMin !== undefined && budgetMin !== null && budgetMin !== ""
          ? Number(budgetMin)
          : undefined,
      budgetMax:
        budgetMax !== undefined && budgetMax !== null && budgetMax !== ""
          ? Number(budgetMax)
          : undefined,
      isUrgent: !!isUrgent,
      tags: tagsArray,
      requirements: requirementsArray,

      companyName,
      companyAddress,

      technicalContactPerson,
      technicalContactEmail,
      technicalContactPhone,
      generalContactPerson,
      generalContactEmail,
      generalContactPhone,

      // Legacy fields
      contactPerson,
      contactEmail: contactEmail || generalContactEmail || technicalContactEmail,
      contactPhone: contactPhone || generalContactPhone || technicalContactPhone,

      status: effectiveStatus,

      documents,

      createdBy: req.user._id,
      organization: req.user.organizationId || null, // Set organization if user belongs to one
      verificationCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
    });

    await sendTenderNotificationEmail(req.user.email, tender, "created");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Created",
      body: `Tender "${tender.title}" was created successfully.`,
      meta: { tenderId: tender._id },
    });

    // Log activity if user belongs to an organization
    if (req.user.organizationId) {
      await logActivity({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        action: "create_tender",
        targetType: "tender",
        targetId: tender._id,
        details: {
          tenderTitle: tender.title,
          category: tender.category,
          deadline: tender.deadline,
        },
        req,
      });
    }

    res.status(201).json(tender);
  } catch (err) {
    console.error("Error creating tender:", err);
    res.status(500).json({ message: err.message });
  }
};

// Update tender
export const updateTender = async (req, res) => {
  try {
    const { id } = req.params;
    const tender = await Tender.findById(id);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    const isAdmin = req.user.role === "admin";
    const isCreator = String(tender.createdBy) === String(req.user._id);
    const sameOrganization =
      req.user.organizationId &&
      tender.organization &&
      String(tender.organization) === String(req.user.organizationId);

    // Admin can always edit
    if (isAdmin) {
      // Continue to update logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        return res.status(403).json({
          message: "Forbidden: You don't have permission to update this tender",
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

      // Check if they have edit permission (even if they created it)
      if (!teamMember.permissions.canEditTenders) {
        return res.status(403).json({
          message: "Forbidden: You don't have permission to edit tenders",
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can edit their own tender
      if (!isCreator) {
        return res.status(403).json({
          message: "Forbidden: You can only edit your own tenders",
        });
      }
    }

    const {
      title,
      description,
      category,
      budgetMin,
      budgetMax,
      deadline,
      requirements,
      isUrgent,
      tags,

      companyName,
      companyAddress,

      technicalContactPerson,
      technicalContactEmail,
      technicalContactPhone,

      generalContactPerson,
      generalContactEmail,
      generalContactPhone,

      // Legacy fields (still accepted)
      contactEmail,
      contactPerson,
      contactPhone,

      status,
    } = req.body;

    // Mirror createTender behavior:
    // - required fields enforced only when status is not draft
    // - allow partial updates, but if switching to active, ensure requireds exist
    const effectiveStatus = status ?? tender.status ?? "active";

    if (status !== undefined) {
      tender.status = effectiveStatus;
    }

    // Update scalar fields if provided (keep existing otherwise)
    if (title !== undefined) tender.title = title;
    if (description !== undefined) tender.description = description;
    if (category !== undefined) tender.category = category;
    if (deadline !== undefined)
      tender.deadline = deadline ? new Date(deadline) : undefined;

    if (budgetMin !== undefined) {
      tender.budgetMin =
        budgetMin !== null && budgetMin !== "" ? Number(budgetMin) : undefined;
    }
    if (budgetMax !== undefined) {
      tender.budgetMax =
        budgetMax !== null && budgetMax !== "" ? Number(budgetMax) : undefined;
    }

    if (isUrgent !== undefined) tender.isUrgent = !!isUrgent;

    if (companyName !== undefined) tender.companyName = companyName;
    if (companyAddress !== undefined) tender.companyAddress = companyAddress;

    if (technicalContactPerson !== undefined)
      tender.technicalContactPerson = technicalContactPerson;
    if (technicalContactEmail !== undefined)
      tender.technicalContactEmail = technicalContactEmail;
    if (technicalContactPhone !== undefined)
      tender.technicalContactPhone = technicalContactPhone;

    if (generalContactPerson !== undefined)
      tender.generalContactPerson = generalContactPerson;
    if (generalContactEmail !== undefined)
      tender.generalContactEmail = generalContactEmail;
    if (generalContactPhone !== undefined)
      tender.generalContactPhone = generalContactPhone;

    // Legacy contact fields: keep accepting but also keep contactEmail/Phone aligned
    if (contactPerson !== undefined) tender.contactPerson = contactPerson;
    if (contactEmail !== undefined) tender.contactEmail = contactEmail;
    if (contactPhone !== undefined) tender.contactPhone = contactPhone;

    // Parse tags / requirements like createTender, but only if provided
    const parseArray = (raw) => {
      if (raw === undefined) return undefined;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return raw.split(",").map((t) => t.trim());
        }
      }
      return [];
    };

    const tagsArray = parseArray(tags);
    if (tagsArray !== undefined) tender.tags = tagsArray;

    const requirementsArray = parseArray(requirements);
    if (requirementsArray !== undefined) tender.requirements = requirementsArray;

    // Ensure legacy contactEmail/contactPhone defaults match createTender behavior
    // only if client is updating any of the related contact fields
    const touchedLegacyContact =
      contactEmail !== undefined ||
      contactPhone !== undefined ||
      generalContactEmail !== undefined ||
      generalContactPhone !== undefined ||
      technicalContactEmail !== undefined ||
      technicalContactPhone !== undefined;

    if (touchedLegacyContact) {
      tender.contactEmail =
        tender.contactEmail || tender.generalContactEmail || tender.technicalContactEmail;
      tender.contactPhone =
        tender.contactPhone || tender.generalContactPhone || tender.technicalContactPhone;
    }

    // If moving out of draft (or ensuring non-draft), enforce required fields
    if (effectiveStatus !== "draft") {
      const missing =
        !tender.title ||
        !tender.description ||
        !tender.category ||
        !tender.deadline ||
        !tender.companyName;

      if (missing) {
        return res.status(400).json({ message: "Missing required fields" });
      }
    }

    // Documents: new standardized tender documents array
    const documentFields = [
      "termsOfReference",
      "sbd1",
      "sbd2",
      "sbd4DeclarationOfInterest",
      "sbd61",
      "bidTechnicalSubmissionTemplate",
      "bidFinancialSubmissionTemplate",
      "annexure1",
      "annexure2",
      "annexure3",
    ];

    const labelMapping = {
      termsOfReference: "Terms of Reference Document",
      sbd1: "SBD 1",
      sbd2: "SBD 2",
      sbd4DeclarationOfInterest: "SBD 4 Declaration of interest",
      sbd61: "SBD 6.1",
      bidTechnicalSubmissionTemplate: "Bid Technical Submission Template",
      bidFinancialSubmissionTemplate: "Bid Financial Submission Template",
      annexure1: "Annexure 1",
      annexure2: "Annexure 2",
      annexure3: "Annexure 3",
    };

    const normalizeDoc = (file, url, fieldName) => ({
      label: labelMapping[fieldName],
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Current tender.documents is expected to be an array; if not, coerce to []
    const currentDocuments = Array.isArray(tender.documents)
      ? tender.documents
      : [];

    // existingDocuments: optional list of URLs to keep.
    // If omitted => keep all existing.
    // If provided => keep only those URLs.
    let keepUrls = null;
    if (req.body.existingDocuments !== undefined) {
      try {
        const parsed =
          typeof req.body.existingDocuments === "string"
            ? JSON.parse(req.body.existingDocuments)
            : req.body.existingDocuments;
        keepUrls = Array.isArray(parsed)
          ? parsed.filter((u) => typeof u === "string")
          : [];
      } catch {
        keepUrls = null;
      }
    }

    const shouldKeep = (doc) => {
      if (!doc?.url) return false;
      if (keepUrls === null) return true;
      return keepUrls.includes(doc.url);
    };

    // Keep docs requested
    const keptDocuments = currentDocuments.filter(shouldKeep);

    // Upload new docs and replace by label (stable identifier)
    const uploadFolder = tender.title || title || "tender";
    const uploadedDocs = [];

    if (req.files && Object.keys(req.files).length > 0) {
      for (const fieldName of documentFields) {
        const filesArray = req.files[fieldName];
        if (!filesArray || filesArray.length === 0) continue;

        const file = filesArray[0];
        const uploadedUrl = await uploadToSupabase(file, uploadFolder);
        uploadedDocs.push(normalizeDoc(file, uploadedUrl, fieldName));
      }
    }

    const byLabel = new Map();
    for (const doc of keptDocuments) {
      if (doc?.label) byLabel.set(doc.label, doc);
    }
    for (const doc of uploadedDocs) {
      byLabel.set(doc.label, doc);
    }

    tender.documents = Array.from(byLabel.values());

    const updatedTender = await tender.save();

    await sendTenderNotificationEmail(req.user.email, tender, "updated");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Updated",
      body: `Tender "${tender.title}" was updated.`,
      meta: { tenderId: tender._id },
    });

    // Log activity if user belongs to an organization
    if (req.user.organizationId) {
      await logActivity({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        action: "update_tender",
        targetType: "tender",
        targetId: tender._id,
        details: {
          tenderTitle: tender.title,
          updatedFields: Object.keys(req.body),
        },
        req,
      });
    }

    res.json({ message: "Tender updated successfully", tender: updatedTender });
  } catch (err) {
    console.error("Update tender error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Delete tender
export const deleteTender = async (req, res) => {
  try {
    console.log("[deleteTender] Start deleting tender:", req.params.id);

    const { id } = req.params;
    const tender = await Tender.findById(id);
    if (!tender) {
      console.log("[deleteTender] Tender not found:", id);
      return res.status(404).json({ message: "Tender not found" });
    }

    const isAdmin = req.user.role === "admin";
    const isCreator = String(tender.createdBy) === String(req.user._id);
    const sameOrganization =
      req.user.organizationId &&
      tender.organization &&
      String(tender.organization) === String(req.user.organizationId);

    // Admin can always delete
    if (isAdmin) {
      // Continue to delete logic
    }
    // If user belongs to an organization (team member)
    else if (req.user.organizationId) {
      // Check if tender belongs to same organization
      if (!sameOrganization) {
        console.log(
          "[deleteTender] Forbidden: tender not in same organization"
        );
        return res.status(403).json({
          message: "Forbidden: You don't have permission to delete this tender",
        });
      }

      // Get team member permissions
      const teamMember = await TeamMember.findOne({
        organization: req.user.organizationId,
        user: req.user._id,
        isActive: true,
      });

      if (!teamMember) {
        console.log("[deleteTender] Forbidden: not an active team member");
        return res.status(403).json({
          message: "Forbidden: You are not an active team member",
        });
      }

      // Check if they have delete permission (even if they created it)
      if (!teamMember.permissions.canDeleteTenders) {
        console.log("[deleteTender] Forbidden: no delete permission");
        return res.status(403).json({
          message: "Forbidden: You don't have permission to delete tenders",
        });
      }
    }
    // Individual user (not part of organization)
    else {
      // Only creator can delete their own tender
      if (!isCreator) {
        console.log("[deleteTender] Forbidden: not the creator");
        return res.status(403).json({
          message: "Forbidden: You can only delete your own tenders",
        });
      }
    }

    // Delete associated applications
    console.log("[deleteTender] Deleting applications for tender:", id);
    await Application.deleteMany({ tender: tender._id });

    // Delete tender documents from Supabase
    if (tender.documents && tender.documents.length > 0) {
      console.log("[deleteTender] Deleting documents from Supabase...");
      for (const doc of tender.documents) {
        await deleteFileFromSupabase(doc.url);
      }
    }

    // Delete the tender from DB
    await tender.deleteOne();
    console.log("[deleteTender] Tender deleted from DB:", id);

    // Notifications & email
    await sendTenderNotificationEmail(req.user.email, tender, "deleted");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Deleted",
      body: `Tender "${tender.title}" was deleted, along with its applications.`,
      meta: { tenderId: tender._id },
    });

    // Log activity if user belongs to an organization
    if (req.user.organizationId) {
      await logActivity({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        action: "delete_tender",
        targetType: "tender",
        targetId: tender._id,
        details: {
          tenderTitle: tender.title,
          category: tender.category,
        },
        req,
      });
    }

    console.log("[deleteTender] Notification created and email sent");

    res.json({ message: "Tender deleted successfully" });
  } catch (err) {
    console.error("[deleteTender] Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// List all tenders with pagination and filters
export const listTenders = async (req, res) => {
  try {
    await autoCloseTenders(); // Auto-close expired tenders

    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (search)
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];

    const pageNum = parseInt(page),
      limitNum = parseInt(limit),
      skip = (pageNum - 1) * limitNum;

    const tenders = await Tender.find(query)
      .populate("createdBy", "name email")
      .sort("-createdAt")
      .skip(skip)
      .limit(limitNum);

    const total = await Tender.countDocuments(query);

    res.json({
      tenders,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: tenders.length,
        totalDocuments: total,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get single tender by ID
export const getTender = async (req, res) => {
  try {
    await autoCloseTenders(); // Auto-close expired tenders

    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/))
      return res.status(400).json({ message: "Invalid tender ID" });

    const tender = await Tender.findById(id)
      .populate("createdBy", "name email")
      .populate({
        path: "applications",
        populate: { path: "bidder", select: "name email companyName" },
      });

    if (!tender) return res.status(404).json({ message: "Tender not found" });
    res.json(tender);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Get tenders created by user or their organization
export const getMyTenders = async (req, res) => {
  try {
    await autoCloseTenders();

    let query;

    // If user belongs to an organization, get all tenders from that organization
    if (req.user.organizationId) {
      query = { organization: req.user.organizationId };
    } else {
      // Otherwise, get only tenders created by this user
      query = { createdBy: req.user._id };
    }

    const tenders = await Tender.find(query)
      .populate("createdBy", "name email")
      .sort("-createdAt");

    res.json(tenders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Check if tender requires verification code
export const checkTenderVerification = async (req, res) => {
  try {
    const { id } = req.params;

    const tender = await Tender.findById(id).select("verificationCode title");
    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    // Check if tender requires verification
    const requiresVerification = !!tender.verificationCode;

    // If user is authenticated, check if they have already verified
    let hasVerified = false;
    if (req.user && requiresVerification) {
      const VerificationCodeRequest = (
        await import("../models/VerificationCodeRequest.js")
      ).default;
      const verifiedRequest = await VerificationCodeRequest.findOne({
        tender: id,
        requestedBy: req.user._id,
        status: "approved",
        codeUsed: true,
      });
      hasVerified = !!verifiedRequest;
    }

    res.json({
      requiresVerification,
      hasVerified,
      tenderTitle: tender.title,
    });
  } catch (err) {
    console.error("Error checking tender verification:", err);
    res.status(500).json({ message: err.message });
  }
};
