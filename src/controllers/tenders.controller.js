import Tender from "../models/Tender.js";
import { paginateQuery } from "../utils/pagination.js";

export const createTender = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      deadline,
      budgetMin,
      budgetMax,
      isUrgent,
      tags,
      requirements,
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      contactEmail,
      contactPhone,
      status,
    } = req.body;

    // Parse numbers and date
    const parsedBudgetMin = Number(budgetMin);
    const parsedBudgetMax = Number(budgetMax);
    const parsedDeadline = deadline ? new Date(deadline) : null;
    const isDeadlineValid =
      parsedDeadline instanceof Date && !isNaN(parsedDeadline.getTime());

    // Validate required fields
    if (
      !title ||
      !description ||
      !category ||
      !isDeadlineValid ||
      !companyName ||
      !registrationNumber ||
      !bbeeLevel ||
      !cidbGrading ||
      !contactPerson ||
      !contactEmail ||
      !contactPhone ||
      isNaN(parsedBudgetMin) ||
      isNaN(parsedBudgetMax)
    ) {
      return res
        .status(400)
        .json({ message: "Missing or invalid required fields" });
    }
    if (parsedBudgetMin > parsedBudgetMax) {
      return res
        .status(400)
        .json({ message: "budgetMin cannot be greater than budgetMax" });
    }

    // Handle uploaded files
    const documents = req.files
      ? req.files.map((file) => ({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          url: `/uploads/${file.filename}`,
        }))
      : [];

    // Normalize tags and requirements
    const parsedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof tags === "string"
      ? tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const parsedRequirements = Array.isArray(requirements)
      ? requirements.map((r) => String(r).trim()).filter(Boolean)
      : typeof requirements === "string"
      ? requirements
          .split(/\r?\n|,/)
          .map((r) => r.trim())
          .filter(Boolean)
      : [];

    // Create tender
    const tender = await Tender.create({
      title,
      description,
      category,
      deadline: parsedDeadline,
      budgetMin: parsedBudgetMin,
      budgetMax: parsedBudgetMax,
      isUrgent: isUrgent === "true" || isUrgent === true,
      tags: parsedTags,
      requirements: parsedRequirements,
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      contactEmail,
      contactPhone,
      status: status || "active",
      documents,
      createdBy: req.user._id,
      verificationCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    });

    res.status(201).json(tender);
  } catch (error) {
    console.error("Error creating tender:", error);
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res
        .status(400)
        .json({ message: error.message, errors: error.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Update tender documents
export const updateTender = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      deadline,
      budgetMin,
      budgetMax,
      isUrgent,
      tags,
      requirements,
      companyName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      contactEmail,
      contactPhone,
      status,
    } = req.body;

    // Parse numbers and date
    const parsedBudgetMin =
      budgetMin !== undefined ? Number(budgetMin) : undefined;
    const parsedBudgetMax =
      budgetMax !== undefined ? Number(budgetMax) : undefined;
    const parsedDeadline = deadline ? new Date(deadline) : undefined;
    if (
      deadline &&
      (!(parsedDeadline instanceof Date) ||
        isNaN(parsedDeadline.getTime()))
    ) {
      return res.status(400).json({ message: "Invalid deadline date" });
    }

    // Handle uploaded files
    const documents = req.files
      ? req.files.map((file) => ({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          url: `/uploads/${file.filename}`,
        }))
      : [];

    // Normalize tags and requirements
    const parsedTags =
      Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

    const parsedRequirements =
      Array.isArray(requirements)
        ? requirements.map((r) => String(r).trim()).filter(Boolean)
        : typeof requirements === "string"
        ? requirements
            .split(/\r?\n|,/)
            .map((r) => r.trim())
            .filter(Boolean)
        : undefined;

    // Build update object dynamically (skip undefined fields)
    const updateData = {
      ...(title && { title }),
      ...(description && { description }),
      ...(category && { category }),
      ...(parsedDeadline && { deadline: parsedDeadline }),
      ...(parsedBudgetMin !== undefined && { budgetMin: parsedBudgetMin }),
      ...(parsedBudgetMax !== undefined && { budgetMax: parsedBudgetMax }),
      ...(isUrgent !== undefined && {
        isUrgent: isUrgent === "true" || isUrgent === true,
      }),
      ...(parsedTags !== undefined && { tags: parsedTags }),
      ...(parsedRequirements !== undefined && {
        requirements: parsedRequirements,
      }),
      ...(companyName && { companyName }),
      ...(registrationNumber && { registrationNumber }),
      ...(bbeeLevel && { bbeeLevel }),
      ...(cidbGrading && { cidbGrading }),
      ...(contactPerson && { contactPerson }),
      ...(contactEmail && { contactEmail }),
      ...(contactPhone && { contactPhone }),
      ...(status && { status }),
    };

    // Append new documents if provided
    if (documents.length > 0) {
      updateData.$push = { documents: { $each: documents } };
    }

    const tender = await Tender.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!tender) {
      return res.status(404).json({ message: "Tender not found" });
    }

    res.json(tender);
  } catch (error) {
    console.error("Error updating tender:", error);
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res
        .status(400)
        .json({ message: error.message, errors: error.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const listTenders = async (req, res) => {
  try {
    const { status, category, search, page, limit } = req.query;
    const q = {};
    if (status) q.status = status;
    if (category) q.category = category;
    if (search)
      q.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    const result = await paginateQuery(Tender, q, {
      page,
      limit,
      sort: "-createdAt",
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const getTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );
    if (!tender) return res.status(404).json({ message: "Tender not found" });
    res.json(tender);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const deleteTender = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    if (
      String(tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await tender.deleteOne();
    res.json({ message: "Tender deleted" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
