import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    url: String, // frontend download link
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    tender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tender",
      required: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "withdrawn"],
      default: "pending",
    },
    comment: { type: String }, // optional issuer feedback
    files: [fileSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Application", applicationSchema);
