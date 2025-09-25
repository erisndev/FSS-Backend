import Notification from "../models/Notification.js";
import Tender from "../models/Tender.js";
import Application from "../models/Application.js";
import { sendTenderNotificationEmail } from "../utils/emails.js";
import { autoCloseTenders } from "../utils/tenderUtils.js";

// ------------------- CREATE TENDER -------------------
export const createTender = async (req, res) => {
  try {
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

    const documentArray = (req.files || []).map((file) => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      size: file.size,
      type: file.mimetype,
    }));

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
      verificationCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    });

    await sendTenderNotificationEmail(req.user.email, tender, "created");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Created",
      body: `Tender "${tender.title}" was created successfully.`,
      meta: { tenderId: tender._id },
    });

    res.status(201).json(tender);
  } catch (err) {
    console.error("Error creating tender:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- UPDATE TENDER -------------------
export const updateTender = async (req, res) => {
  try {
    const { id } = req.params;
    const tender = await Tender.findById(id);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (
      String(tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
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

    // Documents
    const existingDocs = req.body.existingDocuments
      ? (typeof req.body.existingDocuments === "string"
          ? JSON.parse(req.body.existingDocuments)
          : req.body.existingDocuments
        ).map(
          (url) =>
            tender.documents.find((d) => d.url === url) || {
              name: url.split("/").pop(),
              url,
              size: 0,
              type: "application/octet-stream",
            }
        )
      : [];
    const newDocs = (req.files || []).map((f) => ({
      name: f.originalname,
      url: `/uploads/${f.filename}`,
      size: f.size,
      type: f.mimetype,
    }));
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

    res.json({ message: "Tender updated successfully", tender: updatedTender });
  } catch (err) {
    console.error("Update tender error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- DELETE TENDER -------------------
export const deleteTender = async (req, res) => {
  try {
    const { id } = req.params;
    const tender = await Tender.findById(id);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (
      String(tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await Application.deleteMany({ tender: tender._id });
    await tender.deleteOne();

    await sendTenderNotificationEmail(req.user.email, tender, "deleted");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Deleted",
      body: `Tender "${tender.title}" was deleted, along with its applications.`,
      meta: { tenderId: tender._id },
    });

    res.json({ message: "Tender deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- LIST TENDERS -------------------
export const listTenders = async (req, res) => {
  try {
    await autoCloseTenders(); // ✅ Auto-close expired tenders

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

// ------------------- GET SINGLE TENDER -------------------
export const getTender = async (req, res) => {
  try {
    await autoCloseTenders(); // ✅ Auto-close expired tenders

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

// ------------------- GET MY TENDERS -------------------
export const getMyTenders = async (req, res) => {
  try {
    await autoCloseTenders(); // ✅ Auto-close expired tenders
    const tenders = await Tender.find({ createdBy: req.user._id }).sort(
      "-createdAt"
    );
    res.json(tenders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
