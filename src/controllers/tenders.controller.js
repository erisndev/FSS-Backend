import Notification from "../models/Notification.js";
import Tender from "../models/Tender.js";
import { sendTenderNotificationEmail } from "../utils/emails.js";

// ------------------- CREATE TENDER -------------------
export const createTender = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

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
    console.log("BODY:", req.body);
    console.log("FILES:", req.files);

    // ✅ Required fields
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

    // ✅ Budget check
    if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) {
      return res
        .status(400)
        .json({ message: "budgetMin cannot be greater than budgetMax" });
    }

    // ✅ Parse tags
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

    // ✅ Parse requirements
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

    // ✅ Handle uploaded files
    const documentArray = (req.files || []).map((file) => ({
      name: file.originalname,
      url: `/uploads/${file.filename}`, // store relative URL
      size: file.size,
      type: file.mimetype,
    }));

    console.log("Documents array prepared:", documentArray);

    // ✅ Create tender
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

    console.log("Tender created successfully:", tender._id);

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
  console.log("=== UPDATE TENDER START ===");

  try {
    const { id } = req.params;
    console.log("Tender ID:", id);

    // 1️⃣ Find the tender
    const tender = await Tender.findById(id);
    if (!tender) {
      console.log("Tender not found");
      return res.status(404).json({ message: "Tender not found" });
    }

    // 2️⃣ Check ownership
    if (
      String(tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      console.log("Forbidden access");
      return res.status(403).json({ message: "Forbidden" });
    }

    console.log(
      "Tender found, documents count:",
      tender.documents?.length || 0
    );
    console.log("Request body keys:", Object.keys(req.body));
    console.log("Files received:", req.files?.length || 0);

    // ---------------- Update fields ----------------
    const updateFields = [
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

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== "") {
        try {
          if (field === "budgetMin" || field === "budgetMax") {
            const numValue = Number(req.body[field]);
            if (!isNaN(numValue)) tender[field] = numValue;
            else console.log(`Invalid number for ${field}:`, req.body[field]);
          } else if (field === "isUrgent") {
            tender[field] =
              req.body[field] === "true" || req.body[field] === true;
          } else if (field === "deadline") {
            const dateValue = new Date(req.body[field]);
            if (!isNaN(dateValue.getTime())) tender[field] = dateValue;
            else console.log("Invalid deadline:", req.body[field]);
          } else {
            tender[field] = req.body[field];
          }
        } catch (e) {
          console.error(`Error updating ${field}:`, e);
        }
      }
    });

    // ---------------- Tags & Requirements ----------------
    const parseArrayField = (fieldName) => {
      const raw = req.body[fieldName];
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed)
            ? parsed
            : raw.split(",").map((t) => t.trim());
        } catch {
          return raw.split(",").map((t) => t.trim());
        }
      }
      return [];
    };

    tender.tags = parseArrayField("tags");
    tender.requirements = parseArrayField("requirements");

    console.log("Tags:", tender.tags);
    console.log("Requirements:", tender.requirements);

    // ---------------- Documents ----------------
    let existingDocs = [];
    let newDocs = [];

    if (req.body.existingDocuments) {
      try {
        const existingDocUrls =
          typeof req.body.existingDocuments === "string"
            ? JSON.parse(req.body.existingDocuments)
            : req.body.existingDocuments;

        if (Array.isArray(existingDocUrls)) {
          existingDocs = existingDocUrls.map((url) => {
            const doc = tender.documents.find((d) => d.url === url);
            return (
              doc || {
                name: url.split("/").pop() || "Unknown",
                url,
                size: 0,
                type: "application/octet-stream",
              }
            );
          });
        }
      } catch (e) {
        console.error("Error parsing existingDocuments:", e);
      }
    }

    if (req.files && req.files.length > 0) {
      newDocs = req.files.map((file) => ({
        name: file.originalname,
        url: `/uploads/${file.filename}`,
        size: file.size,
        type: file.mimetype,
      }));
    }

    tender.documents = [...existingDocs, ...newDocs];
    console.log("Documents count after update:", tender.documents.length);

    // ---------------- Save Tender ----------------
    const updatedTender = await tender.save();
    console.log("Tender saved successfully");

    await sendTenderNotificationEmail(req.user.email, tender, "updated");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Updated",
      body: `Tender "${tender.title}" was updated.`,
      meta: { tenderId: tender._id },
    });

    res.status(200).json({
      message: "Tender updated successfully",
      tender: updatedTender,
      debug: {
        originalDocs: tender.documents.length,
        existingDocsKept: existingDocs.length,
        newDocsAdded: newDocs.length,
      },
    });
  } catch (err) {
    console.error("=== UPDATE TENDER ERROR ===");
    console.error(err);
    const status = err.name === "ValidationError" ? 400 : 500;
    res.status(status).json({
      message: err.message,
      name: err.name,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
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
    )
      return res.status(403).json({ message: "Forbidden" });

    await tender.deleteOne();
    await sendTenderNotificationEmail(req.user.email, tender, "deleted");
    await Notification.create({
      user: req.user._id,
      type: "tender",
      title: "Tender Deleted",
      body: `Tender "${tender.title}" was deleted.`,
      meta: { tenderId: tender._id },
    });

    res.json({ message: "Tender deleted successfully" });
  } catch (err) {
    console.error("Error deleting tender:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------- LIST & GET TENDERS -------------------
export const listTenders = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const result = await Tender.find(query)
      .populate("createdBy", "name email")
      .populate("applications")
      .sort("-createdAt")
      .skip(skip)
      .limit(limitNum);

    const total = await Tender.countDocuments(query);

    res.json({
      tenders: result,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        count: result.length,
        totalDocuments: total,
      },
    });
  } catch (err) {
    console.error("Error listing tenders:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getTender = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Getting tender with ID:", id);

    // Check if ID is provided and valid
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({ message: "Invalid or missing tender ID" });
    }

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid tender ID format" });
    }

    const tender = await Tender.findById(id)
      .populate("createdBy", "name email")
      .populate({
        path: "applications",
        populate: { path: "bidder", select: "name email companyName" }, // get bidder details too
      });

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    res.json(tender);
  } catch (err) {
    console.error("Error getting tender:", err);

    let status = 500;
    let message = err.message;

    if (err.name === "CastError") {
      status = 400;
      message = "Invalid tender ID format";
    }

    res.status(status).json({ message });
  }
};

export const getMyTenders = async (req, res) => {
  try {
    const tenders = await Tender.find({ createdBy: req.user._id }).sort(
      "-createdAt"
    );
    res.json(tenders);
  } catch (err) {
    console.error("Error in getMyTenders:", err);
    res.status(500).json({ message: err.message });
  }
};
