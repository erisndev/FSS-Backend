import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    originalName: String,
    mimeType: String,
    type: String,
    size: Number,
    url: String,
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
    companyName: { type: String, required: true },
    registrationNumber: { type: String },
    bbeeLevel: { type: String },
    cidbGrading: { type: String },
    contactPerson: { type: String },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String },
    documents: [fileSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
