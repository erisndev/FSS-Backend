import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    originalName: String,
    mimeType: String,
    type: String,
    size: Number,
    url: String,
    label: String, // Label for the document (e.g., "Bid File Documents", "Compiled Documents", etc.)
  },
  { _id: false }
);

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "closed", "archived"],
      default: "active",
    },
    isUrgent: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    requirements: { type: [String], default: [] },

    // Company
    companyName: { type: String, required: true },
    companyAddress: { type: String },

    
    // Contacts (new frontend payload)
    technicalContactPerson: { type: String },
    technicalContactEmail: { type: String },
    technicalContactPhone: { type: String },
    generalContactPerson: { type: String },
    generalContactEmail: { type: String },
    generalContactPhone: { type: String },

    // Legacy single contact fields (kept for backward compatibility)
    contactPerson: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },

    // Tender documents (issuer issued docs)
    documents: {
      type: [fileSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verificationCode: { type: String },
    applications: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    ],
  },
  { timestamps: true }
);

// Auto-close tender if deadline passed
tenderSchema.methods.checkDeadline = function () {
  if (this.deadline < new Date() && this.status === "active") {
    this.status = "closed";
  }
};

export default mongoose.model("Tender", tenderSchema);
