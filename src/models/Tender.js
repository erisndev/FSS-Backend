import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    url: String,
  },
  { _id: false }
);

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    budgetMin: { type: Number, required: true },
    budgetMax: { type: Number, required: true },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "closed", "archived"],
      default: "active",
    },
    isUrgent: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    requirements: { type: [String], default: [] },

    // Company Information
    companyName: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    bbeeLevel: { type: String, required: true },
    cidbGrading: { type: String, required: true },

    // Contact Information
    contactPerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },

    documents: [fileSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verificationCode: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Tender", tenderSchema);
