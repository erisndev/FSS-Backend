// controllers/applications.controller.js
import Tender from "../models/Tender.js";
import Application from "../models/Application.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

export const applyToTender = async (req, res) => {
  try {
    const { tenderId } = req.params;
    const tender = await Tender.findById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });
    if (new Date(tender.deadline) < new Date())
      return res.status(400).json({ message: "Deadline passed" });

    // Log files for debugging
    console.log("Files received from client:", req.files);
    console.log("Form data received:", req.body);

    const {
      bidderName,
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

    // Ensure files array exists
    const files = Array.isArray(req.files)
      ? req.files.map((f) => ({
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
          path: f.path,
          url: `${BASE_URL}/uploads/${f.filename}`,
        }))
      : [];

    const application = await Application.create({
      tender: tenderId,
      bidder: req.user._id,
      bidderName,
      registrationNumber,
      bbeeLevel,
      cidbGrading,
      contactPerson,
      email,
      phone,
      bidAmount,
      timeframe,
      message,
      files,
    });

    res.status(201).json(application);
  } catch (e) {
    console.error("Error applying to tender:", e);
    res.status(500).json({ message: e.message });
  }
};

export const myApplications = async (req, res) => {
  try {
    const apps = await Application.find({ bidder: req.user._id }).populate({
      path: "tender",
      populate: {
        path: "createdBy",
        select: "name email", // only select needed fields
      },
    });
    res.json(apps);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const receivedApplications = async (req, res) => {
  try {
    const { tenderId } = req.params;
    const apps = await Application.find({ tender: tenderId }).populate(
      "bidder",
      "name email bidderName registrationNumber"
    );
    res.json(apps);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const setApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body; // optional comment
    const app = await Application.findById(id).populate("tender");
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (
      String(app.tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!["pending", "approved", "rejected", "withdrawn"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    app.status = status;
    if (comment) app.comment = comment;
    await app.save();
    res.json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await Application.findById(id).populate("tender");
    if (!app) return res.status(404).json({ message: "Application not found" });
    if (String(app.bidder) !== String(req.user._id))
      return res.status(403).json({ message: "Forbidden" });
    if (new Date(app.tender.deadline) < new Date())
      return res.status(400).json({ message: "Deadline passed" });
    app.status = "withdrawn";
    await app.save();
    res.json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// NEW: get single application
export const getApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate("tender")
      .populate("bidder", "name email");
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Access control
    if (
      String(app.bidder._id) !== String(req.user._id) &&
      String(app.tender.createdBy) !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(app);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
