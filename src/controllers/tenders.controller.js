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
      deadline,
      companyName,
      contactEmail,
      budgetMin,
      budgetMax,
      tags,
      requirements,
      isUrgent,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      contactPhone,
      status,
    } = req.body;

    if (
      !title ||
      !description ||
      !category ||
      !deadline ||
      !companyName ||
      !contactEmail
    ) {
      return res.status(400).json({ message: "Missing required fields" });
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

    // Upload documents to Supabase using tender title as folder
    // Documents are expected to come with labels from the frontend
    // Define label mapping for field names
    const labelMapping = {
      bidFileDocuments: "Bid File Documents",
      compiledDocuments: "Compiled Documents",
      financialDocuments: "Financial Documents",
      technicalProposal: "Technical Proposal",
      proofOfExperience: "Proof of Experience (Reference Letter)",
    };

    let documentArray = [];
    if (req.files && Object.keys(req.files).length > 0) {
      // req.files is now an object with field names as keys
      for (const [fieldName, filesArray] of Object.entries(req.files)) {
        for (const file of filesArray) {
          const uploadedUrl = await uploadToSupabase(file, title);
          documentArray.push({
            name: file.originalname,
            url: uploadedUrl,
            size: file.size,
            type: file.mimetype,
            label: labelMapping[fieldName] || "Other",
          });
        }
      }
    }

    const tender = await Tender.create({
      title,
      description,
      category,
      deadline: new Date(deadline),
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
      isUrgent: !!isUrgent,
      tags: tagsArray,
      requirements: requirementsArray,
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      contactEmail,
      contactPhone,
      status: status || "active",
      documents: documentArray,
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

    const fieldsToUpdate = [
      "title",
      "description",
      "category",
      "budgetMin",
      "budgetMax",
      "deadline",
      "status",
      "isUrgent",
      "companyName",
      "registrationNumber",
      "bbeeLevel",
      "cidbGrading",
      "contactPerson",
      "contactEmail",
      "contactPhone",
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "budgetMin" || field === "budgetMax")
          tender[field] = Number(req.body[field]);
        else if (field === "deadline")
          tender[field] = new Date(req.body[field]);
        else if (field === "isUrgent") tender[field] = !!req.body[field];
        else tender[field] = req.body[field];
      }
    });

    // Tags & requirements
    const parseArray = (raw) => {
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
    tender.tags = parseArray(req.body.tags);
    tender.requirements = parseArray(req.body.requirements);

    // Documents - Handle existing documents
    let existingDocs = [];
    
    console.log("[updateTender] Processing documents...");
    console.log("[updateTender] req.body.existingDocuments:", req.body.existingDocuments);
    console.log("[updateTender] req.files:", req.files ? Object.keys(req.files) : "none");
    console.log("[updateTender] Current tender.documents count:", tender.documents?.length || 0);
    
    if (req.body.existingDocuments) {
      // If existingDocuments is provided, use only those
      try {
        let parsedData = typeof req.body.existingDocuments === "string"
          ? JSON.parse(req.body.existingDocuments)
          : req.body.existingDocuments;
        
        console.log("[updateTender] Parsed existingDocuments:", parsedData);
        
        // Handle both array format ["url1", "url2"] and object format {field: "url"}
        let existingUrls = [];
        if (Array.isArray(parsedData)) {
          existingUrls = parsedData;
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          // Convert object to array of URLs
          existingUrls = Object.values(parsedData).filter(url => url && typeof url === 'string');
        }
        
        console.log("[updateTender] Extracted URLs:", existingUrls);
        
        existingDocs = existingUrls.map(
          (url) =>
            tender.documents.find((d) => d.url === url) || {
              name: url.split("/").pop(),
              url,
              size: 0,
              type: "application/octet-stream",
              label: "Other",
            }
        );
        
        console.log("[updateTender] Existing docs to keep:", existingDocs.length);
      } catch (e) {
        console.error("[updateTender] Error parsing existingDocuments:", e);
        existingDocs = tender.documents || [];
      }
    } else if (!req.files || Object.keys(req.files).length === 0) {
      // If no new files and no existingDocuments specified, keep all existing documents
      console.log("[updateTender] No new files, keeping all existing documents");
      existingDocs = tender.documents || [];
    }
    // If new files are uploaded but no existingDocuments specified, keep all existing documents
    else {
      console.log("[updateTender] New files uploaded, keeping all existing documents");
      existingDocs = tender.documents || [];
    }

    // Define label mapping for field names
    const labelMapping = {
      bidFileDocuments: "Bid File Documents",
      compiledDocuments: "Compiled Documents",
      financialDocuments: "Financial Documents",
      technicalProposal: "Technical Proposal",
      proofOfExperience: "Proof of Experience (Reference Letter)",
    };

    let newDocs = [];
    if (req.files && Object.keys(req.files).length > 0) {
      // req.files is now an object with field names as keys
      for (const [fieldName, filesArray] of Object.entries(req.files)) {
        for (const file of filesArray) {
          const uploadedUrl = await uploadToSupabase(file, tender.title);
          newDocs.push({
            name: file.originalname,
            url: uploadedUrl,
            size: file.size,
            type: file.mimetype,
            label: labelMapping[fieldName] || "Other",
          });
        }
      }
    }

    tender.documents = [...existingDocs, ...newDocs];

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
